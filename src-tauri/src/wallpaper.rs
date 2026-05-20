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

#[derive(Debug, Serialize)]
pub struct PotdResult {
    pub title: Option<String>,
    pub description: Option<String>,
    pub monitors: usize,
}

/// Set every monitor's wallpaper to Wikimedia's "Picture of the day".
/// Unlike `set_wallpaper`, this hits Wikimedia directly (no proxy, no
/// key) — the image lives on Commons. We pull the POTD from the English
/// "featured" feed (the picture is language-agnostic; en is the most
/// reliably populated feed) and re-verify the URL host before download.
pub async fn set_wallpaper_potd(app: &AppHandle) -> Result<PotdResult, String> {
    let monitor_count = count_monitors(app)?;
    let potd = fetch_potd().await?;

    let _ = sweep_stale_cache();

    let dir = cache_dir()?;
    let client = crate::http::build_client(Some(30), Some("chappie-wallpaper/1.0"));
    let dest = dir.join(format!("potd-{}.jpg", potd.cache_key));

    if !(dest.exists() && std::fs::metadata(&dest).map(|m| m.len() > 0).unwrap_or(false)) {
        // Prefer the upscaled thumbnail (bounded size, good resolution);
        // fall back to the smaller thumbnail Wikimedia handed us.
        let mut downloaded = false;
        for url in &potd.urls {
            if download_one(&client, url, &dest).await.is_ok() {
                downloaded = true;
                break;
            }
        }
        if !downloaded {
            return Err("could not download picture of the day".into());
        }
    }

    apply_wallpaper(&[dest], monitor_count)?;

    Ok(PotdResult {
        title: potd.title,
        description: potd.description,
        monitors: monitor_count,
    })
}

#[derive(Debug, Serialize)]
pub struct ArtworkResult {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub monitors: usize,
}

/// Set every monitor's wallpaper to a public-domain artwork from the Art
/// Institute of Chicago. No key. `query` filters by artist/keyword (e.g.
/// "ゴッホ", "landscape"); empty picks from a day-rotated set of themes so
/// "名画を壁紙に" still returns something fresh. Images come from the
/// museum's IIIF endpoint (www.artic.edu), re-verified before download.
pub async fn set_artwork_wallpaper(
    app: &AppHandle,
    query: &str,
) -> Result<ArtworkResult, String> {
    let monitor_count = count_monitors(app)?;
    let art = fetch_artwork(query).await?;

    let _ = sweep_stale_cache();

    let dir = cache_dir()?;
    let client = crate::http::build_client(Some(30), Some("chappie-wallpaper/1.0"));
    let dest = dir.join(format!("artic-{}.jpg", art.image_id));
    if !(dest.exists() && std::fs::metadata(&dest).map(|m| m.len() > 0).unwrap_or(false)) {
        download_one(&client, &art.url, &dest).await?;
    }

    apply_wallpaper(&[dest], monitor_count)?;

    Ok(ArtworkResult {
        title: art.title,
        artist: art.artist,
        monitors: monitor_count,
    })
}

struct Artwork {
    url: String,
    image_id: String,
    title: Option<String>,
    artist: Option<String>,
}

#[derive(Deserialize)]
struct ArticSearch {
    data: Vec<ArticArt>,
    config: ArticConfig,
}

#[derive(Deserialize)]
struct ArticArt {
    title: Option<String>,
    image_id: Option<String>,
    artist_title: Option<String>,
    is_public_domain: Option<bool>,
}

#[derive(Deserialize)]
struct ArticConfig {
    iiif_url: String,
}

async fn fetch_artwork(query: &str) -> Result<Artwork, String> {
    let q = query.trim();
    let q = if q.is_empty() { default_art_theme() } else { q };
    let url = format!(
        "https://api.artic.edu/api/v1/artworks/search?q={}&fields=id,title,image_id,artist_title,is_public_domain&limit=20",
        urlencoding_minimal(q)
    );
    let body: ArticSearch = crate::mcp::HTTP
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("artic search: {e}"))?
        .json()
        .await
        .map_err(|e| format!("artic json: {e}"))?;

    // The IIIF base must be the museum's own host — defense in depth
    // before we download and write the file.
    let iiif = body.config.iiif_url.trim_end_matches('/').to_string();
    if !iiif.to_lowercase().starts_with("https://www.artic.edu/") {
        return Err("unexpected IIIF host".into());
    }

    // Keep only public-domain works that actually have an image, then
    // pick one pseudo-randomly so repeat calls vary.
    let mut candidates: Vec<ArticArt> = body
        .data
        .into_iter()
        .filter(|a| a.is_public_domain == Some(true) && a.image_id.is_some())
        .collect();
    if candidates.is_empty() {
        return Err("no public-domain artwork found".into());
    }
    let idx = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0) as usize)
        % candidates.len();
    let pick = candidates.swap_remove(idx);
    let image_id = pick.image_id.unwrap();

    // 1686px wide is a good wallpaper render; `full/{w},/0/default.jpg`
    // is the cached IIIF size pattern the museum recommends.
    let url = format!("{iiif}/{image_id}/full/1686,/0/default.jpg");
    Ok(Artwork {
        url,
        image_id,
        title: pick.title,
        artist: pick.artist_title,
    })
}

/// Day-rotated default search themes so "名画を壁紙に" (no specific artist)
/// still feels fresh on repeat use.
fn default_art_theme() -> &'static str {
    const THEMES: &[&str] = &[
        "impressionism landscape",
        "ukiyo-e",
        "still life",
        "post-impressionism",
        "japanese print",
        "starry night sky painting",
        "seascape",
    ];
    let day = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() / 86_400)
        .unwrap_or(0) as usize;
    THEMES[day % THEMES.len()]
}

struct Potd {
    /// Candidate image URLs, tried in order (best resolution first).
    urls: Vec<String>,
    title: Option<String>,
    description: Option<String>,
    cache_key: String,
}

async fn fetch_potd() -> Result<Potd, String> {
    use chrono::Datelike;
    let now = chrono::Utc::now();
    let (y, m, d) = (now.year(), now.month(), now.day());
    let url = format!(
        "https://en.wikipedia.org/api/rest_v1/feed/featured/{:04}/{:02}/{:02}",
        y, m, d
    );
    let v: serde_json::Value = crate::mcp::HTTP
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("featured feed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("featured json: {e}"))?;
    let image = v
        .get("image")
        .ok_or_else(|| "no picture of the day in feed".to_string())?;

    let thumb = image
        .get("thumbnail")
        .and_then(|t| t.get("source"))
        .and_then(|s| s.as_str())
        .filter(|s| is_wikimedia_url(s));
    let original = image
        .get("image")
        .and_then(|t| t.get("source"))
        .and_then(|s| s.as_str())
        .filter(|s| is_wikimedia_url(s));

    let mut urls = Vec::new();
    if let Some(t) = thumb {
        // Wikimedia thumb URLs embed the width as `/{N}px-`; bumping it
        // to 1920 yields a wallpaper-sized render without fetching the
        // (often >20 MB) original.
        if let Some(upscaled) = upscale_thumb(t, 1920) {
            urls.push(upscaled);
        }
        urls.push(t.to_string());
    }
    if let Some(o) = original {
        urls.push(o.to_string());
    }
    if urls.is_empty() {
        return Err("picture of the day URL not on Wikimedia host".into());
    }

    let title = image
        .get("title")
        .and_then(|s| s.as_str())
        .map(String::from);
    let description = image
        .get("description")
        .and_then(|d| d.get("text"))
        .and_then(|s| s.as_str())
        .map(String::from);

    Ok(Potd {
        urls,
        title,
        description,
        cache_key: format!("{:04}{:02}{:02}", y, m, d),
    })
}

/// Rewrite a Wikimedia thumbnail URL to a different pixel width by
/// swapping the `/{N}px-` segment. Returns None if the URL doesn't match
/// the expected thumbnail shape.
fn upscale_thumb(url: &str, width: u32) -> Option<String> {
    let idx = url.rfind("px-")?;
    let start = url[..idx].rfind('/')? + 1;
    // Everything between the last '/' and "px-" must be digits.
    if url[start..idx].is_empty() || !url[start..idx].bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    Some(format!("{}{}{}", &url[..start], width, &url[idx..]))
}

fn is_wikimedia_url(url: &str) -> bool {
    url.to_lowercase().starts_with("https://upload.wikimedia.org/")
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
        if !name.starts_with("pixabay-") && !name.starts_with("potd-") {
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
