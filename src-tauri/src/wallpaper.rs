// Voice-driven desktop wallpaper change via the chappie.kkweb.io
// Pixabay proxy. Voice flow:
//   "壁紙を森に変えて" → LLM → set_wallpaper(query="森")
//   → fetch N image URLs (one per monitor) from the proxy
//   → download each to ~/.chappie/wallpapers/pixabay-<id>.jpg (cached)
//   → osascript "set picture of every desktop ..." with one image per
//     desktop (all monitors get DIFFERENT images per the design call)
//   → HUD pill confirmation
//
// The Pixabay API key lives server-side on the proxy; the desktop
// binary only ever sees Pixabay CDN image URLs, which we re-verify
// against an allow-list before downloading (defense in depth — the
// proxy shouldn't return anything else, but we don't trust the proxy
// to be uncompromised).
//
// Single-shot only. Auto-rotation lives in a future PR that wires
// proactive.rs to call this same `set_wallpaper()` on a tick.
//
// Why osascript and not e.g. `defaults write` on the .plist: Sonoma
// changed the wallpaper storage to a sandboxed sqlite db that
// `defaults write` no longer reaches. `tell application "System Events"
// set picture of desktop ...` still works in 14/15.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

const DEFAULT_PROXY_URL: &str = "https://chappie.kkweb.io/api/wallpaper";
const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024; // 20 MB
/// Cache TTL — files in ~/.chappie/wallpapers/ untouched for this long
/// get swept on the next `set_wallpaper` call. Bounds the cache to
/// roughly "themes the user has actually used in the last month",
/// which is what we want: a one-off "壁紙を森にして" from 6 months ago
/// shouldn't squat on disk forever.
const CACHE_TTL_SECONDS: u64 = 30 * 24 * 60 * 60;

#[derive(Debug, Deserialize)]
struct ProxyImage {
    url: String,
    id: u64,
    #[allow(dead_code)]
    photographer: Option<String>,
    #[allow(dead_code)]
    photographer_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProxyResponse {
    images: Vec<ProxyImage>,
}

#[derive(Debug, Serialize)]
pub struct SetWallpaperResult {
    pub monitors: usize,
    pub paths: Vec<String>,
}

pub async fn set_wallpaper(app: &AppHandle, query: &str) -> Result<SetWallpaperResult, String> {
    let q = query.trim();
    if q.is_empty() {
        return Err("query is empty".into());
    }
    let monitor_count = count_monitors(app)?;

    let images = fetch_image_urls(q, monitor_count).await?;
    if images.is_empty() {
        return Err("no images found".into());
    }

    // Sweep stale cache entries before downloading — cheap dir scan,
    // bounds disk usage without needing a startup hook. Best-effort:
    // a failure here mustn't block the actual wallpaper change.
    let _ = sweep_stale_cache();

    let paths = download_all(&images).await?;
    apply_wallpaper(&paths, monitor_count)?;

    Ok(SetWallpaperResult {
        monitors: monitor_count,
        paths: paths.iter().map(|p| p.to_string_lossy().into()).collect(),
    })
}

fn count_monitors(app: &AppHandle) -> Result<usize, String> {
    // Any existing window works for monitor enumeration; the main one
    // is created at startup. If none exist (shouldn't happen post-init)
    // fall back to 1 monitor — better to set one wallpaper than fail.
    let Some(win) = app.webview_windows().into_values().next() else {
        return Ok(1);
    };
    let monitors = win
        .available_monitors()
        .map_err(|e| format!("available_monitors: {e}"))?;
    Ok(monitors.len().max(1))
}

fn proxy_url() -> String {
    std::env::var("CHAPPIE_WALLPAPER_PROXY_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_PROXY_URL.to_string())
}

async fn fetch_image_urls(query: &str, n: usize) -> Result<Vec<ProxyImage>, String> {
    let device_id = crate::device_id::get_or_init()?;
    let url = format!(
        "{base}?q={q}&n={n}",
        base = proxy_url(),
        q = urlencoding_minimal(query),
        n = n,
    );
    let client = crate::http::build_client(Some(15), Some("chappie-wallpaper/1.0"));
    let resp = client
        .get(&url)
        .header("X-Chappie-Device-Id", device_id)
        .send()
        .await
        .map_err(|e| format!("proxy fetch: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("proxy {status}: {}", body.chars().take(200).collect::<String>()));
    }
    let body: ProxyResponse = resp
        .json()
        .await
        .map_err(|e| format!("proxy json: {e}"))?;

    // Defense in depth: re-verify each URL is on a Pixabay CDN host.
    // The proxy shouldn't return anything else, but we don't trust it
    // blindly — the desktop binary is the one that downloads + writes
    // the file to disk.
    let filtered: Vec<ProxyImage> = body
        .images
        .into_iter()
        .filter(|img| is_pixabay_url(&img.url))
        .collect();
    Ok(filtered)
}

fn is_pixabay_url(url: &str) -> bool {
    // Pixabay serves images from pixabay.com and cdn.pixabay.com.
    // Both must be https; reject http and any other host.
    let url = url.to_lowercase();
    url.starts_with("https://pixabay.com/") || url.starts_with("https://cdn.pixabay.com/")
}

/// Minimal URL encoder for the query string slot. reqwest can do this
/// via Query, but writing the URL by hand here keeps the call site
/// simple and avoids re-allocating a HashMap for one parameter.
fn urlencoding_minimal(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => out.push(c),
            other => {
                let mut buf = [0u8; 4];
                for byte in other.encode_utf8(&mut buf).bytes() {
                    out.push_str(&format!("%{:02X}", byte));
                }
            }
        }
    }
    out
}

fn cache_dir() -> Result<PathBuf, String> {
    let mut p = dirs::home_dir().ok_or_else(|| "no home dir".to_string())?;
    p.push(".chappie");
    p.push("wallpapers");
    std::fs::create_dir_all(&p).map_err(|e| format!("create cache dir: {e}"))?;
    Ok(p)
}

/// Delete pixabay-*.jpg files whose mtime is older than CACHE_TTL_SECONDS.
/// Best-effort — any individual unlink error is swallowed so a permission
/// blip doesn't break the user-facing wallpaper change. Returns the count
/// of files removed so tests can assert on it.
fn sweep_stale_cache() -> std::io::Result<usize> {
    let dir = cache_dir().map_err(std::io::Error::other)?;
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(CACHE_TTL_SECONDS))
        .unwrap_or(std::time::UNIX_EPOCH);
    let mut removed = 0usize;
    for entry in std::fs::read_dir(&dir)? {
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or_default();
        // Only sweep files we own — leave anything else alone in case
        // the user has dropped their own images here.
        if !name.starts_with("pixabay-") {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        let Ok(modified) = meta.modified() else { continue };
        if modified < cutoff && std::fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

async fn download_all(images: &[ProxyImage]) -> Result<Vec<PathBuf>, String> {
    let dir = cache_dir()?;
    let client = crate::http::build_client(Some(30), Some("chappie-wallpaper/1.0"));
    let mut out = Vec::with_capacity(images.len());
    for img in images {
        let path = dir.join(format!("pixabay-{}.jpg", img.id));
        if path.exists() && std::fs::metadata(&path).map(|m| m.len() > 0).unwrap_or(false) {
            out.push(path);
            continue;
        }
        download_one(&client, &img.url, &path).await?;
        out.push(path);
    }
    Ok(out)
}

async fn download_one(client: &reqwest::Client, url: &str, dest: &Path) -> Result<(), String> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("image fetch: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("image {}: {}", resp.status(), url));
    }
    if let Some(len) = resp.content_length() {
        if len > MAX_IMAGE_BYTES {
            return Err(format!("image too large: {len} bytes"));
        }
    }
    // Stream-write to .part then rename so a half-downloaded image
    // doesn't get picked up by a future cache hit check.
    let tmp = dest.with_extension("jpg.part");
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("image body: {e}"))?;
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(format!("image too large: {} bytes (post-read)", bytes.len()));
    }
    std::fs::write(&tmp, &bytes).map_err(|e| format!("write image: {e}"))?;
    std::fs::rename(&tmp, dest).map_err(|e| format!("rename image: {e}"))?;
    Ok(())
}

fn apply_wallpaper(paths: &[PathBuf], monitor_count: usize) -> Result<(), String> {
    if paths.is_empty() {
        return Err("no images to apply".into());
    }
    // If we got fewer images than monitors (proxy short-changed us),
    // fill the remaining slots by cycling through what we have.
    let mut per_monitor: Vec<&PathBuf> = Vec::with_capacity(monitor_count);
    for i in 0..monitor_count {
        per_monitor.push(&paths[i % paths.len()]);
    }
    let script = build_applescript(&per_monitor);
    run_osascript(&script)
}

fn build_applescript(per_monitor: &[&PathBuf]) -> String {
    let mut script = String::from("tell application \"System Events\"\n");
    for (i, path) in per_monitor.iter().enumerate() {
        let posix = path.to_string_lossy().replace('"', "\\\"");
        // AppleScript desktop indexing is 1-based.
        script.push_str(&format!(
            "  set picture of desktop {idx} to (\"{posix}\" as POSIX file)\n",
            idx = i + 1,
        ));
    }
    script.push_str("end tell\n");
    script
}

fn run_osascript(script: &str) -> Result<(), String> {
    let out = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("osascript spawn: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pixabay_url_accepted() {
        assert!(is_pixabay_url("https://cdn.pixabay.com/photo/2020/01/01/12/00/abc.jpg"));
        assert!(is_pixabay_url("https://pixabay.com/get/abc.jpg"));
    }

    #[test]
    fn non_pixabay_url_rejected() {
        assert!(!is_pixabay_url("https://evil.example.com/x.jpg"));
        assert!(!is_pixabay_url("http://pixabay.com/x.jpg")); // http rejected
        assert!(!is_pixabay_url("https://pixabay.com.evil.com/x.jpg"));
    }

    #[test]
    fn applescript_for_one_monitor() {
        let p = PathBuf::from("/tmp/a.jpg");
        let s = build_applescript(&[&p]);
        assert!(s.contains("desktop 1"));
        assert!(!s.contains("desktop 2"));
        assert!(s.contains("/tmp/a.jpg"));
    }

    #[test]
    fn applescript_for_three_monitors() {
        let p1 = PathBuf::from("/tmp/a.jpg");
        let p2 = PathBuf::from("/tmp/b.jpg");
        let p3 = PathBuf::from("/tmp/c.jpg");
        let s = build_applescript(&[&p1, &p2, &p3]);
        assert!(s.contains("desktop 1"));
        assert!(s.contains("desktop 2"));
        assert!(s.contains("desktop 3"));
        assert!(s.contains("a.jpg"));
        assert!(s.contains("b.jpg"));
        assert!(s.contains("c.jpg"));
    }

    #[test]
    fn applescript_escapes_double_quotes_in_path() {
        let p = PathBuf::from("/tmp/has\"quote.jpg");
        let s = build_applescript(&[&p]);
        assert!(s.contains(r#"has\"quote.jpg"#));
    }

    #[test]
    fn urlencoding_handles_japanese() {
        let s = urlencoding_minimal("森");
        // 森 = e6 a3 ae in UTF-8
        assert_eq!(s, "%E6%A3%AE");
    }

    #[test]
    fn urlencoding_passes_safe_chars() {
        assert_eq!(urlencoding_minimal("hello-world.JPG_v2~"), "hello-world.JPG_v2~");
    }

    #[test]
    fn sweep_preserves_fresh_and_foreign_files() {
        // Sandbox HOME so we don't touch the real ~/.chappie. mtime
        // backdating would need an extra dev-dep (filetime crate),
        // so this test only verifies the negative-space behavior:
        // fresh pixabay files and non-pixabay files always survive a
        // sweep. The "stale files actually get deleted" path is
        // exercised manually during dev (or in a future integration
        // test with a fs::utime polyfill).
        let tmp = std::env::temp_dir().join(format!("chappie-wallpaper-sweep-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let prev_home = std::env::var_os("HOME");
        std::env::set_var("HOME", &tmp);

        let dir = cache_dir().unwrap();
        let fresh = dir.join("pixabay-123.jpg");
        let foreign = dir.join("not-ours.jpg");
        std::fs::write(&fresh, b"x").unwrap();
        std::fs::write(&foreign, b"x").unwrap();

        sweep_stale_cache().unwrap();
        assert!(fresh.exists(), "fresh pixabay file must survive");
        assert!(foreign.exists(), "non-pixabay file must survive");

        let _ = std::fs::remove_dir_all(&tmp);
        if let Some(h) = prev_home {
            std::env::set_var("HOME", h);
        } else {
            std::env::remove_var("HOME");
        }
    }
}
