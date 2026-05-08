// Open a Finder window at a well-known macOS folder (downloads, desktop,
// applications, etc.) or a literal path. Resolution prefers user-specific
// dirs from the `dirs` crate over hardcoded `~/Downloads` so the tool
// respects xdg-style overrides where the user has moved them.

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
            Some(PathBuf::from("/Applications"))
        }
        "trash" | "ゴミ箱" => dirs::home_dir().map(|h| h.join(".Trash")),
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

pub fn open(target: &str) -> Result<PathBuf, String> {
    let path = resolve(target)?;
    if !path.exists() {
        return Err(format!("path does not exist: {}", path.display()));
    }
    let status = Command::new("open")
        .arg(&path)
        .status()
        .map_err(|e| format!("open spawn: {e}"))?;
    if !status.success() {
        return Err(format!("open exited {status}"));
    }
    Ok(path)
}
