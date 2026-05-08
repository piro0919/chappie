// Thin wrapper around macOS `screencapture(1)`. The interactive selection
// mode blocks until the user finishes the marquee (or hits Esc), so we run
// the command on a blocking thread to keep the tokio runtime responsive.

use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct ScreenshotResult {
    pub path: Option<String>,
    pub copied_to_clipboard: bool,
    pub cancelled: bool,
}

pub async fn capture(mode: &str, destination: &str) -> Result<ScreenshotResult, String> {
    let to_clipboard = destination != "file";
    let mut args: Vec<String> = vec!["-x".into()]; // suppress shutter sound
    if mode == "selection" {
        args.push("-i".into());
    }

    let path: Option<String> = if to_clipboard {
        args.push("-c".into());
        None
    } else {
        let dir = dirs::desktop_dir().ok_or_else(|| "desktop dir unavailable".to_string())?;
        let stamp = chrono::Local::now().format("%Y-%m-%d %H.%M.%S");
        let p = dir.join(format!("Screenshot {stamp}.png"));
        let s = p.to_string_lossy().into_owned();
        args.push(s.clone());
        Some(s)
    };

    let path_for_check = path.clone();
    let status = tokio::task::spawn_blocking(move || {
        Command::new("screencapture").args(&args).status()
    })
    .await
    .map_err(|e| format!("join: {e}"))?
    .map_err(|e| format!("spawn: {e}"))?;

    if !status.success() {
        return Err(format!("screencapture exited with status {status}"));
    }

    // `screencapture -i` returns 0 even when the user cancels with Esc.
    // Detect cancellation: file mode → no file created; clipboard mode →
    // we can't tell reliably, so trust exit code (LLM phrasing is fine).
    let cancelled = match &path_for_check {
        Some(p) => !std::path::Path::new(p).exists(),
        None => false,
    };

    Ok(ScreenshotResult {
        path: if cancelled { None } else { path_for_check },
        copied_to_clipboard: to_clipboard && !cancelled,
        cancelled,
    })
}
