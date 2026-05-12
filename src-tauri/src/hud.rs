// Transient on-screen overlay shown when the audio channel may not be
// reaching the user (e.g. system muted) or when a tool's effect is worth
// confirming visually. The HUD window is created in tauri.conf.json with
// label "hud" — frameless, transparent, always-on-top, mouse passthrough.
//
// API: `show(app, text, duration_ms)` from Rust. We position the window
// at the top-center of the primary monitor on every show (so display /
// resolution changes don't strand it), then emit `hud:show` with the
// payload — the renderer fades the message in/out and notifies us when
// it's done so we hide the window again.

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

const HUD_LABEL: &str = "hud";

fn ensure_window(app: &AppHandle) -> Option<WebviewWindow> {
    if let Some(win) = app.get_webview_window(HUD_LABEL) {
        return Some(win);
    }
    let win = WebviewWindowBuilder::new(
        app,
        HUD_LABEL,
        WebviewUrl::App("index.html?view=hud".into()),
    )
    .title("Chappie HUD")
    .inner_size(720.0, 240.0)
    .visible(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .focused(false)
    .shadow(false)
    .build()
    .ok()?;
    let _ = win.set_size(LogicalSize::new(720.0, 240.0));
    let _ = win.set_ignore_cursor_events(true);
    #[cfg(debug_assertions)]
    win.open_devtools();
    Some(win)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HudPayload {
    pub text: String,
    pub duration_ms: u64,
    // Active tray character at the time the HUD is shown. Used by the
    // renderer to pick a portrait that matches whichever voice the user
    // is conversing with. Sourced from `tray::current_character()`.
    pub character: crate::tray::TrayCharacter,
}

fn pick_monitor(win: &WebviewWindow) -> Option<tauri::Monitor> {
    // Prefer the monitor under the cursor so multi-display users see the
    // HUD on whatever screen they're actively working on. Fall back to
    // the primary monitor when the cursor position can't be resolved.
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

fn position_bottom_center(win: &WebviewWindow) {
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

    let x = logical_monitor_x + (logical_monitor_w - logical_win_w) / 2.0;
    // ~120pt above the bottom edge (above Dock if visible).
    let y = logical_monitor_y + logical_monitor_h - logical_win_h - 120.0;

    let _ = win.set_position(LogicalPosition::new(x, y));
}

pub fn show(app: &AppHandle, text: impl Into<String>, duration_ms: u64) {
    let Some(win) = ensure_window(app) else {
        return;
    };
    let _ = win.set_ignore_cursor_events(true);
    position_bottom_center(&win);
    let _ = win.show();
    let payload = HudPayload {
        text: text.into(),
        duration_ms,
        character: crate::tray::current_character(),
    };
    // The window may not be ready to receive events immediately on first
    // launch (webview still loading). Re-emit a couple of times to cover
    // that race; the listener is idempotent.
    let _ = app.emit("hud:show", payload.clone());
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        let _ = app_clone.emit("hud:show", payload);
    });
}

#[tauri::command]
pub fn hud_dismiss(app: AppHandle) {
    if let Some(win) = app.get_webview_window(HUD_LABEL) {
        let _ = win.hide();
    }
}

#[tauri::command]
pub fn hud_show(app: AppHandle, text: String, duration_ms: u64) {
    show(&app, text, duration_ms);
}
