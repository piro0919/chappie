// Persistent absolute-time reminders. Distinct from `timer.rs` because:
// - timers are relative (in N seconds) and intentionally lost across restart
// - reminders are absolute ("tomorrow 7am") and must survive app restart
//
// Storage: ~/.chappie/reminders.json (a flat array of {id, label, fires_at_unix_ms}).
// On startup, `init` drops past-due entries and schedules each remaining one
// with tokio::spawn. New reminders are written through immediately.
//
// Fires `reminder:fired` (separate from `timer:fired`) so the renderer can
// pick a phrasing tuned for "○○の時間です" instead of "○○のタイマーです".

use chrono::TimeZone;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;

#[derive(Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: u32,
    pub label: String,
    pub fires_at_unix_ms: i64,
}

struct Active {
    info: Reminder,
    handle: JoinHandle<()>,
}

static REMINDERS: Lazy<Mutex<Vec<Active>>> = Lazy::new(|| Mutex::new(Vec::new()));
static NEXT_ID: Lazy<Mutex<u32>> = Lazy::new(|| Mutex::new(1));

#[derive(Clone, Serialize)]
struct FiredEvent {
    id: u32,
    label: String,
}

fn store_path() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    let _ = std::fs::create_dir_all(&p);
    p.push("reminders.json");
    Some(p)
}

fn persist_locked(reminders: &[Active]) {
    let Some(path) = store_path() else { return };
    let entries: Vec<&Reminder> = reminders.iter().map(|r| &r.info).collect();
    if let Ok(json) = serde_json::to_string_pretty(&entries) {
        let _ = std::fs::write(path, json);
    }
}

pub fn init(app: &AppHandle) {
    let Some(path) = store_path() else { return };
    let Ok(bytes) = std::fs::read(&path) else { return };
    let Ok(entries): Result<Vec<Reminder>, _> = serde_json::from_slice(&bytes) else {
        eprintln!("[reminder] failed to parse {}", path.display());
        return;
    };
    let now_ms = chrono::Local::now().timestamp_millis();
    let mut max_id: u32 = 0;
    for r in entries {
        max_id = max_id.max(r.id);
        if r.fires_at_unix_ms <= now_ms {
            eprintln!(
                "[reminder] dropping past-due id={} label={:?}",
                r.id, r.label
            );
            continue;
        }
        schedule(app, r);
    }
    *NEXT_ID.lock().unwrap() = max_id + 1;
    persist_locked(&REMINDERS.lock().unwrap());
}

fn schedule(app: &AppHandle, info: Reminder) {
    let app_clone = app.clone();
    let id = info.id;
    let label = info.label.clone();
    let fires_at = info.fires_at_unix_ms;
    let handle = tokio::spawn(async move {
        let now_ms = chrono::Local::now().timestamp_millis();
        let delay_ms = (fires_at - now_ms).max(0) as u64;
        tokio::time::sleep(Duration::from_millis(delay_ms)).await;
        let _ = app_clone.emit("reminder:fired", FiredEvent { id, label });
        let mut list = REMINDERS.lock().unwrap();
        list.retain(|x| x.info.id != id);
        persist_locked(&list);
    });
    REMINDERS.lock().unwrap().push(Active { info, handle });
}

pub fn add(app: &AppHandle, fires_at_unix_ms: i64, label: String) -> Result<Reminder, String> {
    let now_ms = chrono::Local::now().timestamp_millis();
    if fires_at_unix_ms <= now_ms {
        return Err("fires_at_unix_ms must be in the future".into());
    }
    let id = {
        let mut n = NEXT_ID.lock().unwrap();
        let v = *n;
        *n += 1;
        v
    };
    let info = Reminder {
        id,
        label,
        fires_at_unix_ms,
    };
    schedule(app, info.clone());
    persist_locked(&REMINDERS.lock().unwrap());
    Ok(info)
}

pub fn list() -> Vec<Reminder> {
    let mut v: Vec<Reminder> = REMINDERS
        .lock()
        .unwrap()
        .iter()
        .map(|r| r.info.clone())
        .collect();
    v.sort_by_key(|r| r.fires_at_unix_ms);
    v
}

pub fn cancel(id: u32) -> bool {
    let mut list = REMINDERS.lock().unwrap();
    if let Some(pos) = list.iter().position(|x| x.info.id == id) {
        let entry = list.swap_remove(pos);
        entry.handle.abort();
        persist_locked(&list);
        true
    } else {
        false
    }
}

pub fn cancel_all() -> usize {
    let mut list = REMINDERS.lock().unwrap();
    let n = list.len();
    for entry in list.drain(..) {
        entry.handle.abort();
    }
    persist_locked(&list);
    n
}

// Parse "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM[:SS]" in the user's local
// timezone and return epoch milliseconds.
pub fn parse_local_at(input: &str) -> Result<i64, String> {
    let input = input.trim();
    let normalized = input.replace('T', " ");
    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
    ];
    for fmt in formats {
        if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(&normalized, fmt) {
            let local = chrono::Local
                .from_local_datetime(&naive)
                .single()
                .ok_or_else(|| format!("ambiguous local time: {input}"))?;
            return Ok(local.timestamp_millis());
        }
    }
    Err(format!(
        "couldn't parse '{input}'; expected YYYY-MM-DD HH:MM (local time)"
    ))
}
