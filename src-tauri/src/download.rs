// Shared streaming-download helper.
//
// Three places used to hand-roll the same reqwest → .part file → rename
// pattern: `model.rs` (Whisper), `speaker.rs` (ECAPA-TDNN), and
// `embedding.rs` (e5). They differ only in event names and progress
// payload extras, so the common loop lives here.
//
// The caller is responsible for emitting any `<prefix>:ready` event —
// ready payloads vary (single path vs. multi-file) and aren't worth
// abstracting.

use futures_util::StreamExt;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::AsyncWriteExt;

/// True if `p` exists and is non-empty. Treats any IO error as missing.
pub async fn file_exists_nonempty(p: &Path) -> bool {
    match tokio::fs::metadata(p).await {
        Ok(m) => m.len() > 0,
        Err(_) => false,
    }
}

/// Stream-download `url` to `dest`, emitting `<event_prefix>:progress`
/// events with `{ received, total, ...extras }` payloads. Writes through
/// a `<filename>.part` sidecar and atomically renames on success.
pub async fn download_with_progress<R: Runtime>(
    app: &AppHandle<R>,
    url: &str,
    dest: &Path,
    event_prefix: &str,
    extras: Option<Value>,
) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("mkdir: {e}"))?;
    }
    let res = reqwest::get(url).await.map_err(|e| format!("request: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }
    let total = res.content_length().unwrap_or(0);
    let tmp = part_path(dest);
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|e| format!("create tmp: {e}"))?;
    let mut stream = res.bytes_stream();
    let mut received: u64 = 0;
    let progress_event = format!("{event_prefix}:progress");
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("chunk: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write: {e}"))?;
        received += chunk.len() as u64;
        let mut payload = json!({ "received": received, "total": total });
        if let (Some(Value::Object(extras_map)), Value::Object(map)) = (&extras, &mut payload) {
            for (k, v) in extras_map {
                map.insert(k.clone(), v.clone());
            }
        }
        let _ = app.emit(&progress_event, payload);
    }
    file.flush().await.map_err(|e| format!("flush: {e}"))?;
    drop(file);
    tokio::fs::rename(&tmp, dest)
        .await
        .map_err(|e| format!("rename: {e}"))?;
    Ok(())
}

fn part_path(dest: &Path) -> PathBuf {
    let mut p = dest.to_path_buf();
    let fname = p
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("download");
    p.set_file_name(format!("{fname}.part"));
    p
}
