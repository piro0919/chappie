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
    AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindow,
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
                return Some(video_id);
            }
        }
    }
    None
}

pub fn hide(app: &AppHandle) -> bool {
    if let Some(win) = app.get_webview_window(MINIPLAYER_LABEL) {
        let _ = win.hide();
        true
    } else {
        false
    }
}
