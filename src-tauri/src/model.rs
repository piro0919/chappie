use crate::download::{download_with_progress, file_exists_nonempty};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Runtime};

const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";

pub fn model_path() -> PathBuf {
    let home = dirs::home_dir().expect("home dir unset");
    home.join(".chappie/models/ggml-small.bin")
}

pub async fn ensure_model<R: Runtime>(app: AppHandle<R>) -> Result<PathBuf, String> {
    let path = model_path();
    if !file_exists_nonempty(&path).await {
        download_with_progress(&app, MODEL_URL, &path, "model", None).await?;
    }
    let _ = app.emit(
        "model:ready",
        serde_json::json!({ "path": path.to_string_lossy() }),
    );
    Ok(path)
}
