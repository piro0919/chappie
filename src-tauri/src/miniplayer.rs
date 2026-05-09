// Voice-launched mini player. Opens a small always-on-top webview window
// pointed at a YouTube URL (or any other URL we end up wanting to support
// in the future). The webview loads the page directly — no chappie
// renderer in the loop — so YouTube's own player UI is what the user sees
// and interacts with. The chappie value-add is the voice trigger and the
// window management (size, position, close).
//
// Design notes vs hud.rs:
// - Interactive (no `set_ignore_cursor_events`) so users can play / pause
//   / scrub via the YouTube UI.
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

fn ensure_window(app: &AppHandle, url: url::Url) -> Option<WebviewWindow> {
    if let Some(win) = app.get_webview_window(MINIPLAYER_LABEL) {
        // Reuse the existing window — just navigate it to the new URL.
        // Tauri's webview navigation is via the underlying webkit shell;
        // hiding then showing a fresh build would lose the user's window
        // position if they'd dragged it.
        let _ = win.eval(&format!("window.location.href = {}", json_string(url.as_str())));
        return Some(win);
    }
    let win = WebviewWindowBuilder::new(
        app,
        MINIPLAYER_LABEL,
        WebviewUrl::External(url),
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

fn json_string(s: &str) -> String {
    // Tiny helper so we can interpolate a URL safely into a JS expression.
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".to_string())
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

/// Build a YouTube URL from a free-form query. If `query` already looks
/// like a YouTube URL or a bare 11-char video id, route it as a direct
/// watch URL; otherwise treat it as a search query.
fn youtube_url(query: &str) -> String {
    let q = query.trim();
    if q.starts_with("http://") || q.starts_with("https://") {
        return q.to_string();
    }
    // Bare video id (YouTube ids are exactly 11 chars from a known set).
    if q.len() == 11 && q.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return format!("https://www.youtube.com/watch?v={q}");
    }
    let encoded = urlencoding::encode(q);
    format!("https://www.youtube.com/results?search_query={encoded}")
}

pub fn show_youtube(app: &AppHandle, query: &str) -> Result<(), String> {
    let url_str = youtube_url(query);
    let url = url::Url::parse(&url_str).map_err(|e| format!("invalid url: {e}"))?;
    let win = ensure_window(app, url).ok_or_else(|| "failed to create miniplayer window".to_string())?;
    let _ = win.set_size(LogicalSize::new(DEFAULT_W, DEFAULT_H));
    position_bottom_right(&win);
    let _ = win.show();
    Ok(())
}

pub fn hide(app: &AppHandle) -> bool {
    if let Some(win) = app.get_webview_window(MINIPLAYER_LABEL) {
        let _ = win.hide();
        true
    } else {
        false
    }
}
