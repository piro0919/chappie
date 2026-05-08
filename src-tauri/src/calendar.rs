// Read-only macOS Calendar integration. EKEventStore is not Send/Sync, so
// all EventKit calls run on a dedicated OS thread driven by an mpsc channel.
// Every call is wrapped in panic::catch_unwind + objc2::exception::catch so
// an entitlement / signing mismatch surfacing as an NSException can't take
// down the whole process. Mirrors the pattern in galopen/src-tauri/src/calendar.rs.

use chrono::{DateTime, Local, TimeZone, Utc};
use objc2_event_kit::{EKAuthorizationStatus, EKCalendar, EKEntityType, EKEventStatus, EKEventStore};
use objc2_foundation::{NSArray, NSDate};
use serde::{Deserialize, Serialize};
use std::sync::mpsc;
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

enum Cmd {
    CheckPermission(mpsc::Sender<Result<String, String>>),
    RequestPermission(mpsc::Sender<Result<bool, String>>),
    FetchEvents(Range, mpsc::Sender<Result<Vec<CalendarEvent>, String>>),
}

pub struct CalendarState {
    tx: mpsc::Sender<Cmd>,
}

static STATE: OnceLock<CalendarState> = OnceLock::new();

pub fn init() {
    let (tx, rx) = mpsc::channel::<Cmd>();
    std::thread::spawn(move || {
        let store = unsafe { EKEventStore::new() };
        for cmd in rx {
            match cmd {
                Cmd::CheckPermission(reply) => {
                    let _ = reply.send(guarded(|| check_permission_inner()));
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

fn guarded<T, F: FnOnce() -> Result<T, String>>(f: F) -> Result<T, String> {
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| unsafe {
        objc2::exception::catch(std::panic::AssertUnwindSafe(f))
    }));
    match result {
        Ok(Ok(v)) => v,
        Ok(Err(e)) => Err(format!("ObjC exception: {:?}", e)),
        Err(_) => Err("EventKit panic".to_string()),
    }
}

fn send<T>(make: impl FnOnce(mpsc::Sender<Result<T, String>>) -> Cmd) -> Result<T, String> {
    let state = STATE.get().ok_or_else(|| "calendar not initialized".to_string())?;
    let (tx, rx) = mpsc::channel();
    state.tx.send(make(tx)).map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}

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

    rx.recv().map_err(|e| format!("Permission request failed: {}", e))
}

fn fetch_events_inner(
    _store: &EKEventStore,
    _range: Range,
) -> Result<Vec<CalendarEvent>, String> {
    // Implemented in Task 4.
    Err("not implemented".to_string())
}

#[tauri::command]
pub async fn calendar_status() -> Result<String, String> {
    send(Cmd::CheckPermission)
}

#[tauri::command]
pub async fn request_calendar_access() -> Result<bool, String> {
    send(Cmd::RequestPermission)
}

pub fn calendar_status_sync() -> Result<String, String> {
    send(Cmd::CheckPermission)
}

pub fn fetch_events(range: Range) -> Result<Vec<CalendarEvent>, String> {
    send(|tx| Cmd::FetchEvents(range, tx))
}
