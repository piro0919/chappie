// In-process timer manager. Timers are scheduled via tokio::spawn; on fire we
// emit `timer:fired` so the renderer can announce via TTS. The list is kept
// in memory only — restarting the app drops pending timers (intentional for
// MVP; reminders that survive restart belong in a separate `reminder` tool).

use once_cell::sync::Lazy;
use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;

#[derive(Clone, Serialize)]
pub struct TimerInfo {
    pub id: u32,
    pub label: String,
    pub duration_seconds: u64,
    pub fires_at_unix_ms: i64,
}

struct ActiveTimer {
    info: TimerInfo,
    handle: JoinHandle<()>,
}

static TIMERS: Lazy<Mutex<Vec<ActiveTimer>>> = Lazy::new(|| Mutex::new(Vec::new()));
static NEXT_ID: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(1));

#[derive(Clone, Serialize)]
struct FiredEvent {
    id: u32,
    label: String,
}

pub fn set_timer(app: &AppHandle, duration_seconds: u64, label: String) -> TimerInfo {
    let id = {
        let mut n = NEXT_ID.lock().unwrap();
        let v = *n;
        *n += 1;
        v
    };
    let fires_at_unix_ms =
        chrono::Local::now().timestamp_millis() + (duration_seconds as i64) * 1000;
    let info = TimerInfo {
        id,
        label: label.clone(),
        duration_seconds,
        fires_at_unix_ms,
    };

    let app_clone = app.clone();
    let label_clone = label;
    let handle = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(duration_seconds)).await;
        let _ = app_clone.emit(
            "timer:fired",
            FiredEvent {
                id,
                label: label_clone,
            },
        );
        let mut t = TIMERS.lock().unwrap();
        t.retain(|x| x.info.id != id);
    });

    TIMERS.lock().unwrap().push(ActiveTimer {
        info: info.clone(),
        handle,
    });
    info
}

pub fn list_timers() -> Vec<TimerInfo> {
    TIMERS
        .lock()
        .unwrap()
        .iter()
        .map(|t| t.info.clone())
        .collect()
}

pub fn cancel_timer(id: u32) -> bool {
    let mut t = TIMERS.lock().unwrap();
    if let Some(pos) = t.iter().position(|x| x.info.id == id) {
        let entry = t.swap_remove(pos);
        entry.handle.abort();
        true
    } else {
        false
    }
}

pub fn cancel_all() -> usize {
    let mut t = TIMERS.lock().unwrap();
    let n = t.len();
    for entry in t.drain(..) {
        entry.handle.abort();
    }
    n
}

// Periodically refresh the menu-bar tray title with the shortest remaining
// timer (format: "M:SS"). When no timers are running, clears the title so
// only the icon shows. Runs forever — call once from app setup.
pub fn start_tray_title_ticker(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        let mut last_title = String::new();
        loop {
            interval.tick().await;

            let now_ms = chrono::Local::now().timestamp_millis();
            let next_remaining_secs = TIMERS
                .lock()
                .unwrap()
                .iter()
                .map(|t| ((t.info.fires_at_unix_ms - now_ms).max(0) / 1000) as u64)
                .min();

            let timer_part = match next_remaining_secs {
                Some(secs) if secs > 0 => {
                    let m = secs / 60;
                    let s = secs % 60;
                    format!("{m}:{s:02}")
                }
                _ => String::new(),
            };
            let update_pending = crate::tray::UPDATE_AVAILABLE
                .load(std::sync::atomic::Ordering::Relaxed);
            let title = match (update_pending, timer_part.is_empty()) {
                (true, true) => "🔔".to_string(),
                (true, false) => format!("🔔 {timer_part}"),
                (false, _) => timer_part,
            };

            if title == last_title {
                continue;
            }
            if let Some(tray) = app.tray_by_id("main") {
                let _ = tray.set_title(Some(title.as_str()));
            }
            last_title = title;
        }
    });
}

pub fn format_duration(seconds: u64) -> String {
    let h = seconds / 3600;
    let m = (seconds % 3600) / 60;
    let s = seconds % 60;
    let mut out = String::new();
    if h > 0 {
        out.push_str(&format!("{h}時間"));
    }
    if m > 0 {
        out.push_str(&format!("{m}分"));
    }
    if s > 0 || (h == 0 && m == 0) {
        out.push_str(&format!("{s}秒"));
    }
    out
}
