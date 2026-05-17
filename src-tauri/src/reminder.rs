// Persistent absolute-time reminders. Distinct from `timer.rs` because:
// - timers are relative (in N seconds) and intentionally lost across restart
// - reminders are absolute ("tomorrow 7am") and must survive app restart
//
// Storage: ~/.chappie/reminders.json (a flat array of {id, label, fires_at_unix_ms,
// recurrence}). On startup, `init` schedules everything that's still in the
// future and rolls past-due recurring reminders forward to their next fire
// (so "毎朝 7 時" survives an overnight crash gracefully). Past-due one-shots
// are dropped.
//
// Recurrence: a reminder can repeat daily / weekly (same weekday) /
// monthly (same day-of-month). The scheduling task loops for recurring
// reminders, computing the next fire time after each emit. One-shots
// fire once and remove themselves.
//
// Fires `reminder:fired` (separate from `timer:fired`) so the renderer can
// pick a phrasing tuned for "○○の時間です" instead of "○○のタイマーです".

use chrono::{Months, TimeZone};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Debug, Default)]
#[serde(rename_all = "lowercase")]
pub enum Recurrence {
    /// Fire once and forget. The original behavior.
    #[default]
    Once,
    /// Same wall-clock time every day. DST-safe via local-tz arithmetic.
    Daily,
    /// Same weekday + wall-clock time every week.
    Weekly,
    /// Same day-of-month + wall-clock time. End-of-month days roll back
    /// (Jan 31 → Feb 28/29) per `chrono::Months`.
    Monthly,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: u32,
    pub label: String,
    pub fires_at_unix_ms: i64,
    /// Defaults to `Once` so reminders.json files written before this
    /// field existed deserialize cleanly.
    #[serde(default)]
    pub recurrence: Recurrence,
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
    for mut r in entries {
        max_id = max_id.max(r.id);
        if r.fires_at_unix_ms <= now_ms {
            if r.recurrence == Recurrence::Once {
                eprintln!(
                    "[reminder] dropping past-due id={} label={:?}",
                    r.id, r.label
                );
                continue;
            }
            // Recurring: roll forward to the next fire time after now.
            // Without this, "毎朝 7 時" silently dies if the app was
            // shut down past 7am.
            let mut next = compute_next_fire(r.fires_at_unix_ms, r.recurrence);
            while next <= now_ms {
                next = compute_next_fire(next, r.recurrence);
            }
            eprintln!(
                "[reminder] rolled recurring id={} label={:?} forward",
                r.id, r.label
            );
            r.fires_at_unix_ms = next;
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
    let recurrence = info.recurrence;
    let initial_fires_at = info.fires_at_unix_ms;
    let handle = tokio::spawn(async move {
        let mut next_fires_at = initial_fires_at;
        loop {
            let now_ms = chrono::Local::now().timestamp_millis();
            let delay_ms = (next_fires_at - now_ms).max(0) as u64;
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            let _ = app_clone.emit(
                "reminder:fired",
                FiredEvent {
                    id,
                    label: label.clone(),
                },
            );
            if recurrence == Recurrence::Once {
                let mut list = REMINDERS.lock().unwrap();
                list.retain(|x| x.info.id != id);
                persist_locked(&list);
                return;
            }
            // Compute the next fire and update our persisted entry.
            // Don't break out of the task — we own this reminder for
            // its entire lifetime.
            next_fires_at = compute_next_fire(next_fires_at, recurrence);
            let mut list = REMINDERS.lock().unwrap();
            if let Some(active) = list.iter_mut().find(|x| x.info.id == id) {
                active.info.fires_at_unix_ms = next_fires_at;
            } else {
                // Cancelled while firing — exit cleanly.
                return;
            }
            persist_locked(&list);
        }
    });
    REMINDERS.lock().unwrap().push(Active { info, handle });
}

pub fn add(
    app: &AppHandle,
    fires_at_unix_ms: i64,
    label: String,
    recurrence: Recurrence,
) -> Result<Reminder, String> {
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
        recurrence,
    };
    schedule(app, info.clone());
    persist_locked(&REMINDERS.lock().unwrap());
    Ok(info)
}

/// Step `current_ms` forward by one period of `recurrence`. Uses the
/// system local timezone so DST shifts don't drift the wall-clock time.
fn compute_next_fire(current_ms: i64, recurrence: Recurrence) -> i64 {
    let dt = chrono::Local
        .timestamp_millis_opt(current_ms)
        .single()
        .unwrap_or_else(chrono::Local::now);
    let next = match recurrence {
        Recurrence::Once => dt,
        Recurrence::Daily => dt + chrono::Duration::days(1),
        Recurrence::Weekly => dt + chrono::Duration::days(7),
        Recurrence::Monthly => dt
            .checked_add_months(Months::new(1))
            .unwrap_or(dt + chrono::Duration::days(30)),
    };
    next.timestamp_millis()
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Local, TimeZone};

    fn local_ms(y: i32, m: u32, d: u32, hh: u32, mm: u32) -> i64 {
        Local
            .with_ymd_and_hms(y, m, d, hh, mm, 0)
            .single()
            .expect("ambiguous or invalid local time")
            .timestamp_millis()
    }

    fn ymd_hm(ms: i64) -> (i32, u32, u32, u32, u32) {
        let dt = Local
            .timestamp_millis_opt(ms)
            .single()
            .expect("invalid ms");
        use chrono::{Datelike, Timelike};
        (dt.year(), dt.month(), dt.day(), dt.hour(), dt.minute())
    }

    #[test]
    fn once_does_not_advance() {
        let start = local_ms(2026, 5, 17, 9, 30);
        let next = compute_next_fire(start, Recurrence::Once);
        assert_eq!(next, start);
    }

    #[test]
    fn daily_advances_one_day() {
        let start = local_ms(2026, 5, 17, 7, 0);
        let next = compute_next_fire(start, Recurrence::Daily);
        assert_eq!(ymd_hm(next), (2026, 5, 18, 7, 0));
    }

    #[test]
    fn weekly_advances_seven_days() {
        let start = local_ms(2026, 5, 17, 10, 0);
        let next = compute_next_fire(start, Recurrence::Weekly);
        assert_eq!(ymd_hm(next), (2026, 5, 24, 10, 0));
    }

    #[test]
    fn monthly_rolls_back_jan_31_to_feb_28() {
        // 2026 is not a leap year — Jan 31 should land on Feb 28.
        let start = local_ms(2026, 1, 31, 8, 0);
        let next = compute_next_fire(start, Recurrence::Monthly);
        assert_eq!(ymd_hm(next), (2026, 2, 28, 8, 0));
    }

    #[test]
    fn monthly_rolls_back_jan_31_to_feb_29_in_leap_year() {
        // 2028 is a leap year — Jan 31 should land on Feb 29.
        let start = local_ms(2028, 1, 31, 8, 0);
        let next = compute_next_fire(start, Recurrence::Monthly);
        assert_eq!(ymd_hm(next), (2028, 2, 29, 8, 0));
    }

    #[test]
    fn monthly_advances_normally_in_mid_month() {
        let start = local_ms(2026, 3, 15, 9, 0);
        let next = compute_next_fire(start, Recurrence::Monthly);
        assert_eq!(ymd_hm(next), (2026, 4, 15, 9, 0));
    }

    #[test]
    fn monthly_year_rollover() {
        let start = local_ms(2026, 12, 20, 9, 0);
        let next = compute_next_fire(start, Recurrence::Monthly);
        assert_eq!(ymd_hm(next), (2027, 1, 20, 9, 0));
    }
}
