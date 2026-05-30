// Read-only macOS Calendar integration. EKEventStore is not Send/Sync, so
// all EventKit calls run on a dedicated OS thread driven by an mpsc channel.
// Every call is wrapped in panic::catch_unwind + objc2::exception::catch so
// an entitlement / signing mismatch surfacing as an NSException can't take
// down the whole process. Mirrors the pattern in galopen/src-tauri/src/calendar.rs.

// Calendar is a macOS-only (EventKit) integration. On Windows there is no
// v1 equivalent (see the platform-support table in README), so this module
// compiles down to graceful "not_supported" stubs on non-macOS targets —
// the `list_events` tool then reports that calendar access is unavailable
// rather than failing the build. The shared data types (`CalendarEvent`,
// `Range`) stay cross-platform so callers don't need `#[cfg]` of their own.

use serde::{Deserialize, Serialize};

#[cfg(target_os = "macos")]
use chrono::{DateTime, Local, TimeZone, Utc};
#[cfg(target_os = "macos")]
use objc2_event_kit::{EKAuthorizationStatus, EKCalendar, EKEntityType, EKEventStatus, EKEventStore};
#[cfg(target_os = "macos")]
use objc2_foundation::{NSArray, NSDate};
#[cfg(target_os = "macos")]
use std::sync::mpsc;
#[cfg(target_os = "macos")]
use std::sync::OnceLock;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    /// RFC3339 string for timed events, `YYYY-MM-DD` for all-day events.
    pub start: String,
    pub end: String,
    pub is_all_day: bool,
    pub location: Option<String>,
    pub calendar_name: Option<String>,
}

pub enum Range {
    Today,
    Tomorrow,
    Upcoming,
}

#[cfg(target_os = "macos")]
enum Cmd {
    CheckPermission(mpsc::Sender<Result<String, String>>),
    RequestPermission(mpsc::Sender<Result<bool, String>>),
    FetchEvents(Range, mpsc::Sender<Result<Vec<CalendarEvent>, String>>),
}

#[cfg(target_os = "macos")]
pub struct CalendarState {
    tx: mpsc::Sender<Cmd>,
}

#[cfg(target_os = "macos")]
static STATE: OnceLock<CalendarState> = OnceLock::new();

#[cfg(target_os = "macos")]
pub fn init() {
    let (tx, rx) = mpsc::channel::<Cmd>();
    std::thread::spawn(move || {
        let store = unsafe { EKEventStore::new() };
        for cmd in rx {
            match cmd {
                Cmd::CheckPermission(reply) => {
                    let _ = reply.send(guarded(check_permission_inner));
                }
                Cmd::RequestPermission(reply) => {
                    let _ = reply.send(guarded(|| request_permission_inner(&store)));
                }
                Cmd::FetchEvents(range, reply) => {
                    let _ = reply.send(guarded(|| fetch_events_inner(&store, range)));
                }
            }
        }
    });
    let _ = STATE.set(CalendarState { tx });
}

#[cfg(target_os = "macos")]
use crate::objc_util::guarded_result as guarded;

#[cfg(target_os = "macos")]
fn send<T>(make: impl FnOnce(mpsc::Sender<Result<T, String>>) -> Cmd) -> Result<T, String> {
    let state = STATE.get().ok_or_else(|| "calendar not initialized".to_string())?;
    let (tx, rx) = mpsc::channel();
    state.tx.send(make(tx)).map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}

#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn check_permission_inner() -> Result<String, String> {
    let status = unsafe { EKEventStore::authorizationStatusForEntityType(EKEntityType::Event) };
    let s = if status == EKAuthorizationStatus::FullAccess
        || status == EKAuthorizationStatus::Authorized
    {
        "granted"
    } else if status == EKAuthorizationStatus::Denied {
        "denied"
    } else if status == EKAuthorizationStatus::Restricted {
        "restricted"
    } else {
        "not_determined"
    };
    Ok(s.to_string())
}

#[cfg(target_os = "macos")]
fn request_permission_inner(store: &EKEventStore) -> Result<bool, String> {
    let (tx, rx) = mpsc::channel();
    let tx_arc = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
    let tx_clone = tx_arc.clone();

    let completion = block2::RcBlock::new(
        move |granted: objc2::runtime::Bool, _error: *mut objc2_foundation::NSError| {
            if let Some(sender) = tx_clone.lock().unwrap().take() {
                let _ = sender.send(granted.as_bool());
            }
        },
    );

    unsafe {
        let _: () = objc2::msg_send![store, requestFullAccessToEventsWithCompletion: &*completion];
    }

    rx.recv().map_err(|e| format!("Permission request failed: {e}"))
}

#[cfg(target_os = "macos")]
fn fetch_events_inner(
    store: &EKEventStore,
    range: Range,
) -> Result<Vec<CalendarEvent>, String> {
    let now = Local::now();
    let today = now.date_naive();

    let (start_local, end_local, max_count) = match range {
        Range::Today => (
            now.naive_local(),
            today
                .and_hms_opt(23, 59, 59)
                .ok_or("Failed to build today end")?,
            10usize,
        ),
        Range::Tomorrow => {
            let tomorrow = today + chrono::Duration::days(1);
            (
                tomorrow
                    .and_hms_opt(0, 0, 0)
                    .ok_or("Failed to build tomorrow start")?,
                tomorrow
                    .and_hms_opt(23, 59, 59)
                    .ok_or("Failed to build tomorrow end")?,
                10usize,
            )
        }
        Range::Upcoming => {
            let end = today + chrono::Duration::days(7);
            (
                now.naive_local(),
                end.and_hms_opt(23, 59, 59)
                    .ok_or("Failed to build upcoming end")?,
                10usize,
            )
        }
    };

    let start_utc = Local
        .from_local_datetime(&start_local)
        .single()
        .ok_or("Failed to convert start to UTC")?
        .with_timezone(&Utc);
    let end_utc = Local
        .from_local_datetime(&end_local)
        .single()
        .ok_or("Failed to convert end to UTC")?
        .with_timezone(&Utc);

    let start_nsdate = NSDate::dateWithTimeIntervalSince1970(start_utc.timestamp() as f64);
    let end_nsdate = NSDate::dateWithTimeIntervalSince1970(end_utc.timestamp() as f64);

    unsafe { store.refreshSourcesIfNecessary() };
    unsafe { store.reset() };

    let predicate = unsafe {
        store.predicateForEventsWithStartDate_endDate_calendars(
            &start_nsdate,
            &end_nsdate,
            None::<&NSArray<EKCalendar>>,
        )
    };
    let ek_events = unsafe { store.eventsMatchingPredicate(&predicate) };

    let mut events: Vec<CalendarEvent> = ek_events
        .iter()
        .filter_map(|e| {
            let status = unsafe { e.status() };
            if status == EKEventStatus::Canceled {
                return None;
            }
            // Use msg_send! with Option types for nullable ObjC properties so
            // we don't trip Retained's non-null assertions.
            let title: Option<objc2::rc::Retained<objc2_foundation::NSString>> =
                unsafe { objc2::msg_send![&*e, title] };
            let title = title.map(|s| s.to_string()).unwrap_or_default();
            let start_date: Option<objc2::rc::Retained<NSDate>> =
                unsafe { objc2::msg_send![&*e, startDate] };
            let end_date: Option<objc2::rc::Retained<NSDate>> =
                unsafe { objc2::msg_send![&*e, endDate] };
            let start_date = start_date?;
            let end_date = end_date?;
            let is_all_day = unsafe { e.isAllDay() };
            let location: Option<objc2::rc::Retained<objc2_foundation::NSString>> =
                unsafe { objc2::msg_send![&*e, location] };
            let location = location.map(|s| s.to_string());
            let calendar_name: Option<String> = {
                let cal: Option<objc2::rc::Retained<EKCalendar>> =
                    unsafe { objc2::msg_send![&*e, calendar] };
                cal.map(|c| {
                    let t: objc2::rc::Retained<objc2_foundation::NSString> =
                        unsafe { c.title() };
                    t.to_string()
                })
            };

            let start_dt =
                DateTime::<Utc>::from_timestamp(start_date.timeIntervalSince1970() as i64, 0)?;
            let end_dt =
                DateTime::<Utc>::from_timestamp(end_date.timeIntervalSince1970() as i64, 0)?;

            let (start_str, end_str) = if is_all_day {
                (
                    start_dt.with_timezone(&Local).format("%Y-%m-%d").to_string(),
                    end_dt.with_timezone(&Local).format("%Y-%m-%d").to_string(),
                )
            } else {
                (
                    start_dt.with_timezone(&Local).to_rfc3339(),
                    end_dt.with_timezone(&Local).to_rfc3339(),
                )
            };

            let id_base: Option<objc2::rc::Retained<objc2_foundation::NSString>> =
                unsafe { objc2::msg_send![&*e, eventIdentifier] };
            let id_base = id_base.map(|s| s.to_string()).unwrap_or_default();
            let id = format!("{}_{}", id_base, start_dt.timestamp());

            Some(CalendarEvent {
                id,
                title,
                start: start_str,
                end: end_str,
                is_all_day,
                location,
                calendar_name,
            })
        })
        .collect();

    events.sort_by(|a, b| a.start.cmp(&b.start));
    events.truncate(max_count);
    Ok(events)
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn calendar_status() -> Result<String, String> {
    send(Cmd::CheckPermission)
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn request_calendar_access() -> Result<bool, String> {
    send(Cmd::RequestPermission)
}

#[cfg(target_os = "macos")]
pub fn calendar_status_sync() -> Result<String, String> {
    send(Cmd::CheckPermission)
}

/// Synchronous (blocking) form of `request_calendar_access`, used by the
/// `list_events` tool handler so it can trigger the system prompt
/// in-context when the user first asks about their schedule.
#[cfg(target_os = "macos")]
pub fn request_access_sync() -> Result<bool, String> {
    send(Cmd::RequestPermission)
}

#[cfg(target_os = "macos")]
pub fn fetch_events(range: Range) -> Result<Vec<CalendarEvent>, String> {
    send(|tx| Cmd::FetchEvents(range, tx))
}

// ---------------------------------------------------------------------------
// Non-macOS stubs. Calendar has no v1 equivalent on Windows/Linux, so the
// API surface is preserved but reports "not_supported". `list_events`'
// status check (`== "granted"`) falls through to a graceful "calendar
// access unavailable" reply, and the proactive scheduler skips its
// calendar branches because the status never reads "granted".
// ---------------------------------------------------------------------------

#[cfg(not(target_os = "macos"))]
pub fn init() {}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn calendar_status() -> Result<String, String> {
    Ok("not_supported".to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn request_calendar_access() -> Result<bool, String> {
    Ok(false)
}

#[cfg(not(target_os = "macos"))]
pub fn calendar_status_sync() -> Result<String, String> {
    Ok("not_supported".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn request_access_sync() -> Result<bool, String> {
    Ok(false)
}

#[cfg(not(target_os = "macos"))]
pub fn fetch_events(_range: Range) -> Result<Vec<CalendarEvent>, String> {
    Err("calendar is not supported on this platform".to_string())
}
