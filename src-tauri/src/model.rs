use futures_util::StreamExt;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::AsyncWriteExt;

const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";

pub fn model_path() -> PathBuf {
    let home = dirs::home_dir().expect("home dir unset");
    home.join(".chappie/models/ggml-base.bin")
}

pub async fn ensure_model<R: Runtime>(app: AppHandle<R>) -> Result<PathBuf, String> {
    let path = model_path();
    if path.exists() {
        if let Ok(meta) = tokio::fs::metadata(&path).await {
            if meta.len() > 0 {
                let _ = app.emit(
                    "model:ready",
                    serde_json::json!({ "path": path.to_string_lossy() }),
                );
                return Ok(path);
            }
        }
    }
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("mkdir: {e}"))?;
    }

    let res = reqwest::get(MODEL_URL)
        .await
        .map_err(|e| format!("request: {e}"))?;
    let total = res.content_length().unwrap_or(0);
    let mut received: u64 = 0;
    let mut stream = res.bytes_stream();

    let tmp = path.with_extension("bin.part");
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|e| format!("create tmp: {e}"))?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("chunk: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write: {e}"))?;
        received += chunk.len() as u64;
        let _ = app.emit(
            "model:progress",
            serde_json::json!({ "received": received, "total": total }),
        );
    }
    file.flush().await.map_err(|e| format!("flush: {e}"))?;
    drop(file);
    tokio::fs::rename(&tmp, &path)
        .await
        .map_err(|e| format!("rename: {e}"))?;
    let _ = app.emit(
        "model:ready",
        serde_json::json!({ "path": path.to_string_lossy() }),
    );
    Ok(path)
}
