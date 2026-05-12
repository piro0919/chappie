// Voice-launched mini player. Opens a small always-on-top webview window
// hosting our own MiniplayerView, which embeds the YouTube IFrame Player
// API and uses `loadPlaylist({listType:'search'})` to autoplay the top
// match for whatever the user said. Going through the IFrame API rather
// than just opening youtube.com means a single voice command actually
// starts a video playing — no extra click on the search results page.
//
// Design notes vs hud.rs:
// - Interactive (no `set_ignore_cursor_events`) so users can play / pause
//   / scrub via the YouTube player UI.
// - Persistent: no auto-dismiss timer. Closes via voice ("YouTube 閉じて")
//   or by clicking the OS close button on the window.
// - Decorated: keeps the OS chrome so users can drag, resize, and close
//   without us reinventing those controls.
// - Bottom-right corner by default (less intrusive than the HUD's
//   bottom-center position) on whichever monitor the cursor is on.

use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const MINIPLAYER_LABEL: &str = "miniplayer";
const DEFAULT_W: f64 = 480.0;
const DEFAULT_H: f64 = 300.0;
const MARGIN_PX: f64 = 24.0;

fn build_app_url(query: &str) -> String {
    // Renderer route (handled in main.tsx). The query goes through as a
    // URL param so the view can pick it up via window.location.search.
    let q = urlencoding::encode(query);
    format!("index.html?view=miniplayer&q={q}")
}

fn ensure_window(app: &AppHandle, query: &str) -> Option<WebviewWindow> {
    let path = build_app_url(query);
    if let Some(win) = app.get_webview_window(MINIPLAYER_LABEL) {
        // Reuse the existing window — just re-navigate so the new query
        // takes effect. Hiding/destroying would lose the user's window
        // position if they'd dragged it.
        let target = format!("/{}", path); // App URL is relative to the app:// root
        let _ = win.eval(&format!(
            "window.location.replace({})",
            serde_json::to_string(&target).unwrap_or_else(|_| "\"\"".into())
        ));
        return Some(win);
    }
    let win = WebviewWindowBuilder::new(
        app,
        MINIPLAYER_LABEL,
        WebviewUrl::App(path.into()),
    )
    .title("Chappie Mini Player")
    .inner_size(DEFAULT_W, DEFAULT_H)
    .visible(false)
    .decorations(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(true)
    .focused(false)
    .build()
    .ok()?;
    // If the user closes the player via the window's X button (instead of
    // saying "閉じて"), we still need to tell the renderer so it drops out
    // of cancel-only mode and resumes normal wake-word handling.
    let app_for_close = app.clone();
    win.on_window_event(move |ev| {
        if matches!(ev, tauri::WindowEvent::CloseRequested { .. }) {
            let _ = app_for_close.emit("miniplayer:visible", false);
        }
    });
    Some(win)
}

fn pick_monitor(win: &WebviewWindow) -> Option<tauri::Monitor> {
    if let Ok(cursor) = win.cursor_position() {
        if let Ok(monitors) = win.available_monitors() {
            for m in monitors {
                let pos = m.position();
                let size = m.size();
                let x = cursor.x as i32;
                let y = cursor.y as i32;
                if x >= pos.x
                    && x < pos.x + size.width as i32
                    && y >= pos.y
                    && y < pos.y + size.height as i32
                {
                    return Some(m);
                }
            }
        }
    }
    win.primary_monitor().ok().flatten()
}

fn position_bottom_right(win: &WebviewWindow) {
    let Some(monitor) = pick_monitor(win) else { return };
    let scale = monitor.scale_factor();
    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();
    let win_size = win.outer_size().unwrap_or_default();

    let logical_monitor_w = monitor_size.width as f64 / scale;
    let logical_monitor_h = monitor_size.height as f64 / scale;
    let logical_win_w = win_size.width as f64 / scale;
    let logical_win_h = win_size.height as f64 / scale;
    let logical_monitor_x = monitor_pos.x as f64 / scale;
    let logical_monitor_y = monitor_pos.y as f64 / scale;

    let x = logical_monitor_x + logical_monitor_w - logical_win_w - MARGIN_PX;
    let y = logical_monitor_y + logical_monitor_h - logical_win_h - MARGIN_PX;
    let _ = win.set_position(LogicalPosition::new(x, y));
}

const VIDEO_ID_RE_LEN: usize = 11;

fn extract_video_id(input: &str) -> Option<String> {
    let s = input.trim();
    if s.len() == VIDEO_ID_RE_LEN
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Some(s.to_string());
    }
    let url = url::Url::parse(s).ok()?;
    let host = url.host_str()?;
    if host == "youtu.be" {
        let id = url.path().trim_start_matches('/');
        if id.len() == VIDEO_ID_RE_LEN {
            return Some(id.to_string());
        }
    }
    if host.ends_with("youtube.com") {
        if let Some((_, v)) = url.query_pairs().find(|(k, _)| k == "v") {
            if v.len() == VIDEO_ID_RE_LEN {
                return Some(v.into_owned());
            }
        }
        if let Some(stripped) = url.path().strip_prefix("/embed/") {
            let id: String = stripped.chars().take(VIDEO_ID_RE_LEN).collect();
            if id.len() == VIDEO_ID_RE_LEN {
                return Some(id);
            }
        }
    }
    None
}

/// Hit the YouTube oEmbed endpoint to verify a video both exists AND is
/// embeddable from a third-party origin. Returns `true` for 200, `false`
/// for any error / non-200 (404 = doesn't exist, 401 = private, 403/etc =
/// embed disabled). Short timeout because we're often validating multiple
/// candidates and the user is waiting for playback to start.
async fn is_embeddable(client: &reqwest::Client, video_id: &str) -> bool {
    let watch_url = format!("https://www.youtube.com/watch?v={video_id}");
    let oembed = format!(
        "https://www.youtube.com/oembed?url={}&format=json",
        urlencoding::encode(&watch_url)
    );
    match client
        .get(&oembed)
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
    {
        Ok(r) => r.status().is_success(),
        Err(_) => false,
    }
}

/// Hit YouTube's web search results page and pull out the first batch of
/// videoId hits. Used as a server-side fallback when the LLM's own
/// candidate URLs all 404 / fail oEmbed — typical for niche / Japanese
/// content the LLM doesn't reliably know real IDs for (e.g. オモコロ).
///
/// We deliberately avoid the YouTube Data API: it requires a per-user
/// API key and quota management. Scraping the public results page works
/// without any auth and only needs us to harvest the videoIds — actual
/// embed-validity is still verified through oEmbed downstream.
///
/// Returns up to `limit` distinct video IDs in result-page order. Empty
/// vec on any network / parse failure (caller falls back to opening the
/// browser search page so the user still sees something).
async fn search_video_ids(query: &str, limit: usize) -> Vec<String> {
    let url = format!(
        "https://www.youtube.com/results?search_query={}",
        urlencoding::encode(query)
    );
    let client = reqwest::Client::new();
    let req = client
        .get(&url)
        // YouTube ships a different (cookie-walled) HTML if it thinks the
        // request is from a generic crawler. A desktop UA + Accept-Language
        // gets us the same `ytInitialData` blob the browser would see.
        .header(
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        )
        .header("Accept-Language", "ja,en;q=0.8")
        .timeout(std::time::Duration::from_secs(5));
    let body = match req.send().await {
        Ok(r) if r.status().is_success() => match r.text().await {
            Ok(t) => t,
            Err(_) => return Vec::new(),
        },
        _ => return Vec::new(),
    };
    // Manual scan for `"videoId":"XXXXXXXXXXX"` — avoids pulling regex in
    // for one pattern. Validates the 11-char alphanumeric/-/_ shape and
    // dedupes while preserving first-seen order so the page's top hit
    // stays in the lead.
    let needle = b"\"videoId\":\"";
    let bytes = body.as_bytes();
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    let mut i = 0;
    while i + needle.len() + VIDEO_ID_RE_LEN < bytes.len() {
        if &bytes[i..i + needle.len()] == needle {
            let start = i + needle.len();
            let id_bytes = &bytes[start..start + VIDEO_ID_RE_LEN];
            let all_valid = id_bytes
                .iter()
                .all(|b| b.is_ascii_alphanumeric() || *b == b'-' || *b == b'_');
            if all_valid && bytes.get(start + VIDEO_ID_RE_LEN) == Some(&b'"') {
                if let Ok(s) = std::str::from_utf8(id_bytes) {
                    let id = s.to_string();
                    if seen.insert(id.clone()) {
                        out.push(id);
                        if out.len() >= limit {
                            return out;
                        }
                    }
                }
            }
            i = start + VIDEO_ID_RE_LEN;
        } else {
            i += 1;
        }
    }
    out
}

/// Try a list of candidate video URLs/IDs from the LLM and play the
/// first one that's actually embeddable. Returns the chosen video id on
/// success, or `None` if nothing was playable.
pub async fn show_first_playable(
    app: &AppHandle,
    candidates: &[String],
) -> Option<String> {
    crate::linfo!(
        app,
        "miniplayer",
        "show_first_playable: {} candidate(s)",
        candidates.len()
    );
    if candidates.is_empty() {
        return None;
    }
    let client = reqwest::Client::new();
    for raw in candidates {
        let Some(video_id) = extract_video_id(raw) else {
            crate::linfo!(
                app,
                "miniplayer",
                "  skip {raw:?} (could not extract video id)"
            );
            continue;
        };
        let ok = is_embeddable(&client, &video_id).await;
        crate::linfo!(
            app,
            "miniplayer",
            "  {} {video_id} (from {raw:?})",
            if ok { "OK" } else { "embed-blocked" }
        );
        if ok {
            if let Some(win) = ensure_window(app, &video_id) {
                let _ = win.set_size(LogicalSize::new(DEFAULT_W, DEFAULT_H));
                position_bottom_right(&win);
                let _ = win.show();
                // Tell the renderer the player is up so it can switch the
                // mic-event filter to "cancel-only" mode — without this the
                // YouTube audio leaking back into the mic gets transcribed
                // and (re-)triggers tool calls in a loop.
                let _ = app.emit("miniplayer:visible", true);
                return Some(video_id);
            }
        }
    }
    None
}

/// Server-side YouTube search → oEmbed-validate → miniplayer. Used as a
/// fallback when the LLM's own candidates all failed (or it didn't have
/// any). Returns the played video id on success, or None if the search
/// itself returned nothing playable.
pub async fn show_first_search_hit(app: &AppHandle, query: &str) -> Option<String> {
    if query.trim().is_empty() {
        return None;
    }
    let hits = search_video_ids(query, 8).await;
    crate::linfo!(
        app,
        "miniplayer",
        "search '{query}' -> {} hit(s)",
        hits.len()
    );
    if hits.is_empty() {
        return None;
    }
    show_first_playable(app, &hits).await
}

pub fn hide(app: &AppHandle) -> bool {
    if let Some(win) = app.get_webview_window(MINIPLAYER_LABEL) {
        let _ = win.hide();
        let _ = app.emit("miniplayer:visible", false);
        true
    } else {
        false
    }
}
