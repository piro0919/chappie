// Open a file-manager window at a well-known folder (downloads, desktop,
// documents, etc.) or a literal path. Resolution prefers user-specific dirs
// from the `dirs` crate over hardcoded paths so the tool respects where the
// user has actually moved them. macOS uses Finder via `open`; Windows uses
// Explorer.

use std::path::PathBuf;
use std::process::Command;

fn resolve(target: &str) -> Result<PathBuf, String> {
    let key = target.trim().to_ascii_lowercase();
    let path = match key.as_str() {
        "" | "home" | "~" | "ホーム" => dirs::home_dir(),
        "downloads" | "download" | "ダウンロード" => dirs::download_dir(),
        "desktop" | "デスクトップ" => dirs::desktop_dir(),
        "documents" | "document" | "書類" | "ドキュメント" => dirs::document_dir(),
        "pictures" | "picture" | "ピクチャ" | "写真" => dirs::picture_dir(),
        "music" | "ミュージック" | "音楽" => dirs::audio_dir(),
        "movies" | "movie" | "ムービー" | "動画" => dirs::video_dir(),
        "applications" | "application" | "apps" | "アプリ" | "アプリケーション" => {
            #[cfg(target_os = "windows")]
            {
                std::env::var_os("ProgramFiles").map(PathBuf::from)
            }
            #[cfg(not(target_os = "windows"))]
            {
                Some(PathBuf::from("/Applications"))
            }
        }
        "trash" | "ゴミ箱" => {
            #[cfg(target_os = "windows")]
            {
                // The Recycle Bin is a virtual shell folder, handled directly
                // in `open()`; resolve() never gets here on Windows.
                None
            }
            #[cfg(not(target_os = "windows"))]
            {
                dirs::home_dir().map(|h| h.join(".Trash"))
            }
        }
        _ => {
            // Literal path. Expand a leading ~ for convenience.
            if let Some(stripped) = target.strip_prefix("~/") {
                dirs::home_dir().map(|h| h.join(stripped))
            } else if target == "~" {
                dirs::home_dir()
            } else {
                Some(PathBuf::from(target))
            }
        }
    };
    path.ok_or_else(|| format!("couldn't resolve target: {target}"))
}

#[cfg(target_os = "macos")]
fn launch<S: AsRef<std::ffi::OsStr>>(arg: S) -> Result<(), String> {
    let status = Command::new("open")
        .arg(arg)
        .status()
        .map_err(|e| format!("open spawn: {e}"))?;
    if !status.success() {
        return Err(format!("open exited {status}"));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn launch<S: AsRef<std::ffi::OsStr>>(arg: S) -> Result<(), String> {
    // explorer.exe routinely returns exit code 1 even on success, so we only
    // surface a failure to *spawn* it, not its exit status.
    Command::new("explorer")
        .arg(arg)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("explorer spawn: {e}"))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn launch<S: AsRef<std::ffi::OsStr>>(arg: S) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(arg)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("xdg-open spawn: {e}"))
}

pub fn open(target: &str) -> Result<PathBuf, String> {
    // Windows virtual shell folders that have no filesystem path.
    #[cfg(target_os = "windows")]
    {
        let key = target.trim().to_ascii_lowercase();
        if matches!(key.as_str(), "trash" | "ゴミ箱") {
            launch("shell:RecycleBinFolder")?;
            return Ok(PathBuf::from("Recycle Bin"));
        }
    }

    let path = resolve(target)?;
    if !path.exists() {
        return Err(format!("path does not exist: {}", path.display()));
    }
    launch(&path)?;
    Ok(path)
}
