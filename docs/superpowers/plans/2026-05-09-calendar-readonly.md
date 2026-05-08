# Calendar (Read-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `list_events` LLM tool that reads upcoming events from macOS Calendar (EventKit) and surfaces them through Chappie's existing voice / HUD pipeline.

**Architecture:** New `src-tauri/src/calendar.rs` owns an `EKEventStore` on a dedicated OS thread and exposes async fetch / permission commands via an `mpsc` channel. The LLM tool calls into it from `openai.rs::execute_tool` (shared by Gemini / Anthropic). Permission UI mirrors mic / screen-recording blocks in `SettingsView.tsx`.

**Tech Stack:** Rust (Tauri v2, `objc2-event-kit` 0.3), TypeScript (React 19, Tauri JS API), macOS EventKit. No unit-test framework in repo — verification is `cargo build` + `pnpm tauri dev` manual flow per task.

**Reference implementation:** `~/Repository/galopen/src-tauri/src/calendar.rs` (working pattern for EKEventStore on a dedicated thread with panic + ObjC exception guards).

**Spec:** `docs/superpowers/specs/2026-05-09-calendar-readonly-design.md`

---

## File Structure

Create:
- `src-tauri/src/calendar.rs` — EKEventStore-backed state + Tauri commands + `fetch_events` for the LLM.

Modify:
- `src-tauri/Cargo.toml` — add `objc2-event-kit`.
- `src-tauri/Entitlements.plist` — add calendars entitlement.
- `src-tauri/Info.plist` — add `NSCalendarsFullAccessUsageDescription` (and `NSCalendarsUsageDescription` for older macOS).
- `src-tauri/src/lib.rs` — `mod calendar`, register Tauri commands, init state, manage state.
- `src-tauri/src/openai.rs` — `list_events` tool definition + `execute_tool` branch.
- `src-tauri/src/capabilities.rs` — example phrases per language.
- `src/views/SettingsView.tsx` — calendar permission block.
- `src/views/SettingsView.module.css` — only if new layout primitives needed (likely reuse existing classes).
- `src/i18n/messages.ts` — 9-language labels for the calendar block.
- `CLAUDE.md` — Rust Backend / Frontend / Key Design sections.
- `README.md` — feature list / examples.
- `landing-page/` content matching `capabilities.rs` examples (path resolved during the LP task).
- Memory: `project_roadmap_ideas.md` (move to ✅ list) and `project_provider_test_status.md` (record verification result).

---

## Task 1: Add `objc2-event-kit` dependency

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add the dep**

Open `src-tauri/Cargo.toml` and add `objc2-event-kit` near the other `objc2` lines (search for `objc2-foundation = "0.3"`). Replace any plain `objc2-foundation = "0.3"` line so it pulls the features we need, and add `objc2-event-kit` immediately below:

```toml
objc2-foundation = { version = "0.3", features = ["NSDate", "NSArray", "NSPredicate", "NSString", "NSError", "NSURL"] }
objc2-event-kit = { version = "0.3.2", features = [
    "EKTypes",
    "EKObject",
    "EKCalendar",
    "EKCalendarItem",
    "EKEvent",
    "EKEventStore",
] }
```

If `objc2-foundation` already has a feature list, merge the missing features in instead of replacing.

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: `Finished` with no errors. Warnings about unused deps OK at this stage.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore(deps): add objc2-event-kit for calendar integration"
```

---

## Task 2: Add macOS Calendar entitlement & usage description

**Files:**
- Modify: `src-tauri/Entitlements.plist`
- Modify: `src-tauri/Info.plist`

- [ ] **Step 1: Add the calendars entitlement**

Edit `src-tauri/Entitlements.plist`. Inside the existing `<dict>` add:

```xml
    <key>com.apple.security.personal-information.calendars</key>
    <true/>
```

Final file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.personal-information.location</key>
    <true/>
    <key>com.apple.security.personal-information.calendars</key>
    <true/>
</dict>
</plist>
```

- [ ] **Step 2: Add usage descriptions**

Edit `src-tauri/Info.plist`. Inside the existing `<dict>` add:

```xml
    <key>NSCalendarsFullAccessUsageDescription</key>
    <string>Used to read your upcoming events so Chappie can speak them out loud.</string>
    <key>NSCalendarsUsageDescription</key>
    <string>Used to read your upcoming events so Chappie can speak them out loud.</string>
```

Both keys are intentional: `NSCalendarsFullAccessUsageDescription` is required on macOS 14+, `NSCalendarsUsageDescription` is honored on older versions. Same English string for both — translation is renderer-side via i18n; the system prompt always shows the macOS-locale version, English keeps it predictable.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Entitlements.plist src-tauri/Info.plist
git commit -m "feat(calendar): add macOS calendar entitlement and usage description"
```

---

## Task 3: Create `calendar.rs` skeleton — types, thread, permission

**Files:**
- Create: `src-tauri/src/calendar.rs`

- [ ] **Step 1: Write the file**

Create `src-tauri/src/calendar.rs` with the full content below. This sets up `CalendarState`, the dedicated thread, and permission commands. Event fetching gets added in Task 4.

```rust
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

pub fn fetch_events(range: Range) -> Result<Vec<CalendarEvent>, String> {
    send(|tx| Cmd::FetchEvents(range, tx))
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: `Finished` with no errors. The `unused_imports` warnings on `DateTime / TimeZone / Utc / NSArray / NSDate / EKCalendar / EKEventStatus / Local / Serialize / Deserialize` are OK — they're consumed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/calendar.rs
git commit -m "feat(calendar): add calendar.rs skeleton with permission commands"
```

---

## Task 4: Implement `fetch_events_inner`

**Files:**
- Modify: `src-tauri/src/calendar.rs`

- [ ] **Step 1: Replace the `fetch_events_inner` stub**

In `src-tauri/src/calendar.rs`, replace the stub with the real implementation:

```rust
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
            10,
        ),
        Range::Tomorrow => {
            let tomorrow = today + chrono::Duration::days(1);
            (
                tomorrow.and_hms_opt(0, 0, 0).ok_or("Failed to build tomorrow start")?,
                tomorrow.and_hms_opt(23, 59, 59).ok_or("Failed to build tomorrow end")?,
                10,
            )
        }
        Range::Upcoming => {
            let end = today + chrono::Duration::days(7);
            (
                now.naive_local(),
                end.and_hms_opt(23, 59, 59).ok_or("Failed to build upcoming end")?,
                10,
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

    let start_nsdate = unsafe { NSDate::dateWithTimeIntervalSince1970(start_utc.timestamp() as f64) };
    let end_nsdate = unsafe { NSDate::dateWithTimeIntervalSince1970(end_utc.timestamp() as f64) };

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
            let title = unsafe { e.title() }
                .map(|s| s.to_string())
                .unwrap_or_default();
            let start_date = unsafe { e.startDate() }?;
            let end_date = unsafe { e.endDate() }?;
            let is_all_day = unsafe { e.isAllDay() };
            let location = unsafe { e.location() }.map(|s| s.to_string());
            let calendar_name = unsafe { objc2::msg_send![&*e, calendar] }
                .map(|c: objc2::rc::Retained<EKCalendar>| unsafe { c.title() }.to_string());

            let start_dt = DateTime::<Utc>::from_timestamp(
                start_date.timeIntervalSince1970() as i64, 0,
            )?;
            let end_dt = DateTime::<Utc>::from_timestamp(
                end_date.timeIntervalSince1970() as i64, 0,
            )?;

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

            // Recurring events share eventIdentifier — append start to make it unique.
            let id_base = unsafe { e.eventIdentifier() }
                .map(|s| s.to_string())
                .unwrap_or_default();
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
```

The `objc2::msg_send![&*e, calendar]` call returns `Option<Retained<EKCalendar>>`; if the binding's typed accessor exists in the version we resolve, swap to `unsafe { e.calendar() }`. Either form works — we use `msg_send!` because galopen's reference uses it for nullable-property safety.

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: `Finished`. If `objc2-event-kit 0.3.2` exposes the typed `calendar()` accessor and complains about the `msg_send!` form, swap to `unsafe { e.calendar() }`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/calendar.rs
git commit -m "feat(calendar): implement fetch_events for today/tomorrow/upcoming"
```

---

## Task 5: Wire calendar into `lib.rs`

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Register the module**

In `src-tauri/src/lib.rs`, find the alphabetical `mod` block at the top (around line 5) and insert:

```rust
mod calendar;
```

right after `mod caffeinate;` so the alphabetical order is preserved.

- [ ] **Step 2: Register the Tauri commands**

Inside the `invoke_handler(tauri::generate_handler![ … ])` block (around line 164), add two new entries near `screen_permission::*`:

```rust
            calendar::calendar_status,
            calendar::request_calendar_access,
```

- [ ] **Step 3: Initialize calendar state at setup**

In the `.setup(|app| { … })` block, find the line `reminder::init(&app.handle());` (around line 191). Add right above it:

```rust
            calendar::init();
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: `Finished` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(calendar): wire calendar module into lib.rs"
```

---

## Task 6: Add `list_events` LLM tool

**Files:**
- Modify: `src-tauri/src/openai.rs`

- [ ] **Step 1: Add the tool definition**

In `src-tauri/src/openai.rs::all_tools()`, add this object inside the JSON array (place it next to the other day-to-day tools, e.g. after `take_screenshot` at around line 563):

```json
{
    "type": "function",
    "function": {
        "name": "list_events",
        "description": "macOS のカレンダーから予定を取得します。「今日の予定は？」「明日のスケジュール教えて」「次の予定は？」のような質問で呼び出してください。range='today' は今この瞬間から今日の終わりまで、'tomorrow' は明日丸一日、'upcoming' は今から1週間以内で先頭10件までを返します。返却が空配列なら予定なし。権限未許可なら error='permission_denied' を返すので、その場合はユーザーに『設定 → カレンダー権限を許可してください』と案内してください。",
        "parameters": {
            "type": "object",
            "properties": {
                "range": {
                    "type": "string",
                    "enum": ["today", "tomorrow", "upcoming"],
                    "description": "today=現在以降の今日、tomorrow=明日、upcoming=今から1週間。"
                }
            },
            "required": ["range"],
            "additionalProperties": false
        }
    }
}
```

Use Rust string syntax matching neighboring entries (the file uses `serde_json::json!` so the JSON object literal goes inside that macro).

- [ ] **Step 2: Add the `execute_tool` branch**

In `src-tauri/src/openai.rs::execute_tool`, add a new arm in the `match name` block (place near other tools alphabetically, e.g. before `"list_notes"`):

```rust
"list_events" => {
    let range = args
        .get("range")
        .and_then(|v| v.as_str())
        .unwrap_or("today");
    // Permission gate first so the LLM gets a clear hint instead of an empty list.
    match crate::calendar::calendar_status_sync() {
        Ok(s) if s == "granted" => {}
        Ok(s) => {
            return serde_json::json!({
                "error": "permission_denied",
                "status": s,
                "hint": "設定からカレンダーへのアクセスを許可してください。"
            })
            .to_string();
        }
        Err(e) => {
            return serde_json::json!({ "error": "calendar_unavailable", "detail": e })
                .to_string();
        }
    }
    let parsed_range = match range {
        "tomorrow" => crate::calendar::Range::Tomorrow,
        "upcoming" => crate::calendar::Range::Upcoming,
        _ => crate::calendar::Range::Today,
    };
    match crate::calendar::fetch_events(parsed_range) {
        Ok(events) => serde_json::json!({ "events": events }).to_string(),
        Err(e) => serde_json::json!({ "error": "calendar_unavailable", "detail": e })
            .to_string(),
    }
}
```

- [ ] **Step 3: Add a sync permission helper in `calendar.rs`**

Add this small wrapper to `src-tauri/src/calendar.rs` (just below `pub fn fetch_events(...)`):

```rust
pub fn calendar_status_sync() -> Result<String, String> {
    send(Cmd::CheckPermission)
}
```

`calendar_status` (the Tauri command) is `async`, so we need a sync entry point that `execute_tool` (which already runs in async context but can call blocking `send`) can use cheaply.

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: `Finished` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/openai.rs src-tauri/src/calendar.rs
git commit -m "feat(calendar): add list_events tool to the LLM toolset"
```

---

## Task 7: Add capability examples (9 languages)

**Files:**
- Modify: `src-tauri/src/capabilities.rs`

- [ ] **Step 1: Add a "Calendar" category to each language function**

In each of `capabilities_ja / en / es / fr / de / zh / pt / ko / it`, insert a new tuple in the `categories` slice. Place it between the "Time" / time-equivalent and "Weather" / weather-equivalent categories. Use these strings:

| Lang | Category label | Example phrases |
|------|---------------|------------------|
| ja | カレンダー | "今日の予定は？", "明日のスケジュール教えて", "次の予定は？" |
| en | Calendar | "What's on my calendar today?", "Tomorrow's schedule?", "What's next?" |
| es | Calendario | "¿Qué tengo hoy?", "Agenda de mañana", "¿Qué sigue?" |
| fr | Agenda | "Quel est mon planning aujourd'hui ?", "Mon agenda de demain", "Et après ?" |
| de | Kalender | "Was steht heute an?", "Mein Plan für morgen", "Was kommt als Nächstes?" |
| zh | 日历 | "我今天有什么安排？", "明天的日程", "下一个安排是什么？" |
| pt | Agenda | "O que tenho hoje?", "Minha agenda de amanhã", "Qual é o próximo?" |
| ko | 캘린더 | "오늘 일정은?", "내일 스케줄 알려줘", "다음 일정은?" |
| it | Calendario | "Cos'ho in agenda oggi?", "L'agenda di domani", "Qual è il prossimo?" |

Pattern (using ja as the example):

```rust
        ("カレンダー", &[
            "今日の予定は？",
            "明日のスケジュール教えて",
            "次の予定は？",
        ]),
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/capabilities.rs
git commit -m "feat(calendar): add calendar category to capabilities (9 langs)"
```

---

## Task 8: Add i18n labels for the Settings UI

**Files:**
- Modify: `src/i18n/messages.ts`

- [ ] **Step 1: Find the `settings.screenAccess` keys**

Search `src/i18n/messages.ts` for `settings.screenAccess` to locate the screen-recording label group. We will add a parallel `settings.calendar*` group right after it for every language.

- [ ] **Step 2: Add the keys per language**

For each language object, add these keys (sample values for Japanese; translate per language using the table below):

```ts
"settings.calendarAccess": "カレンダーへのアクセス",
"settings.calendarGranted": "許可済み",
"settings.calendarDenied": "未許可",
"settings.calendarRequest": "カレンダーへのアクセスを許可",
"settings.calendarDeniedNote": "macOS のシステム設定 → プライバシーとセキュリティ → カレンダー で Chappie を有効化してください。",
```

| Lang | calendarAccess | calendarGranted | calendarDenied | calendarRequest | calendarDeniedNote |
|------|----------------|-----------------|-----------------|-------------------|---------------------|
| ja | カレンダーへのアクセス | 許可済み | 未許可 | カレンダーへのアクセスを許可 | macOS のシステム設定 → プライバシーとセキュリティ → カレンダー で Chappie を有効化してください。 |
| en | Calendar access | Granted | Denied | Grant calendar access | Open System Settings → Privacy & Security → Calendars and enable Chappie. |
| es | Acceso al calendario | Concedido | Denegado | Permitir acceso al calendario | Abre Configuración → Privacidad y seguridad → Calendarios y habilita Chappie. |
| fr | Accès à l'agenda | Autorisé | Refusé | Autoriser l'accès à l'agenda | Ouvre Réglages → Confidentialité et sécurité → Calendriers et active Chappie. |
| de | Kalenderzugriff | Erteilt | Verweigert | Kalenderzugriff erlauben | Öffne Systemeinstellungen → Datenschutz & Sicherheit → Kalender und aktiviere Chappie. |
| zh | 日历访问权限 | 已授权 | 未授权 | 授权访问日历 | 打开系统设置 → 隐私与安全性 → 日历，启用 Chappie。 |
| pt | Acesso ao calendário | Concedido | Negado | Permitir acesso ao calendário | Abra Ajustes → Privacidade e Segurança → Calendários e ative Chappie. |
| ko | 캘린더 접근 권한 | 허용됨 | 거부됨 | 캘린더 접근 허용 | 시스템 설정 → 개인정보 보호 및 보안 → 캘린더에서 Chappie를 활성화하세요. |
| it | Accesso al calendario | Concesso | Negato | Consenti accesso al calendario | Apri Impostazioni → Privacy e sicurezza → Calendari e abilita Chappie. |

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/messages.ts
git commit -m "feat(calendar): add settings i18n labels for calendar access (9 langs)"
```

---

## Task 9: Add the calendar permission block to Settings

**Files:**
- Modify: `src/views/SettingsView.tsx`

- [ ] **Step 1: Add a status type and state**

Near the top of the component, alongside `screenStatus`:

```tsx
type CalendarStatus = "granted" | "denied" | "not_determined" | "restricted";
const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>("not_determined");
```

- [ ] **Step 2: Add a refresh function and effect**

Place near the existing `refreshScreenStatus` (around line 75–95). Add:

```tsx
const refreshCalendarStatus = useCallback(async () => {
  try {
    const status = await invoke<CalendarStatus>("calendar_status");
    setCalendarStatus(status);
  } catch (e) {
    console.error("[settings] calendar_status failed", e);
  }
}, []);
```

Then in the existing `useEffect` that calls `refreshScreenStatus`, add a call to `refreshCalendarStatus()` alongside it. Reuse the same effect — don't add a separate one.

- [ ] **Step 3: Add the request handler**

Add next to `requestScreenAccess`:

```tsx
const requestCalendarAccess = useCallback(async () => {
  try {
    const granted = await invoke<boolean>("request_calendar_access");
    console.info("[settings] request_calendar_access ->", granted);
    await refreshCalendarStatus();
  } catch (e) {
    console.error("[settings] request_calendar_access", e);
  }
}, [refreshCalendarStatus]);
```

- [ ] **Step 4: Render the block**

Find the screen-recording JSX block (search for `settings.screenAccess`). Below its closing tag (the wrapping `<section>` or `<div>`), paste the calendar block, mirroring the screen-recording structure exactly:

```tsx
<section className={styles.section}>
  <h3 className={styles.sectionTitle}>{t("settings.calendarAccess")}</h3>
  <div className={styles.statusRow}>
    <span
      className={`${styles.badge} ${calendarStatus === "granted" ? styles.badgeGranted : styles.badgeDenied}`}
    >
      {calendarStatus === "granted"
        ? t("settings.calendarGranted")
        : t("settings.calendarDenied")}
    </span>
  </div>
  {calendarStatus !== "granted" && (
    <button
      type="button"
      className={styles.primaryButton}
      onClick={requestCalendarAccess}
    >
      {t("settings.calendarRequest")}
    </button>
  )}
  {calendarStatus === "denied" && (
    <p className={styles.note}>{t("settings.calendarDeniedNote")}</p>
  )}
</section>
```

If the actual JSX in `SettingsView.tsx` uses different class / element names than above, match the screen-recording block 1:1 in the same file (don't invent new patterns — just copy the structure used for screen recording and swap the labels / state / handler).

- [ ] **Step 5: Type-check & format**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/views/SettingsView.tsx
git commit -m "feat(calendar): add calendar permission block to settings"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (run-only)

- [ ] **Step 1: Boot dev**

Run: `pnpm tauri dev`
Expected: app launches, tray icon appears.

- [ ] **Step 2: Trigger the permission prompt**

Open Settings from the tray, click the new "カレンダーへのアクセスを許可" button.
Expected: macOS shows the system calendar prompt (not "denied" silently). Approve it. The badge flips to "許可済み".

If no prompt appears: check `Console.app` for `EventKit panic` / `ObjC exception` / TCC entries. Most likely cause is the entitlement / Info.plist not actually being bundled — verify with `codesign -d --entitlements - /path/to/Chappie.app` after a `pnpm tauri build`.

- [ ] **Step 3: Voice test — events present**

With at least one event on today's calendar, say "チャッピー" then "今日の予定は？".
Expected:
- Console shows `list_events` tool call.
- LLM speaks back the event title + time.
- HUD shows the same content if the system is muted.

- [ ] **Step 4: Voice test — empty day**

Pick a day with no events (e.g. say "明日の予定は？" on a free day).
Expected: LLM says "明日は予定ないよ" or equivalent — not an error.

- [ ] **Step 5: Voice test — permission denied path**

Revoke calendar permission via macOS System Settings → Privacy & Security → Calendars → uncheck Chappie. Restart the app. Say "今日の予定は？".
Expected: LLM responds with an instruction to grant calendar access via Settings (because the tool returns `{ error: "permission_denied" }`).

- [ ] **Step 6: Provider sweep**

Repeat Step 3 once each with API keys for the providers we have working memory entries for: OpenAI, Gemini, Anthropic. Skip xAI / OpenRouter unless we want to update `project_provider_test_status.md` proactively.
Expected: tool fires on each provider. Note any failures for the memory update task.

- [ ] **Step 7: Capabilities self-introduction**

Say "何ができるの？".
Expected: response now includes the new "カレンダー" category with the example phrases.

- [ ] **Step 8: Commit any tweaks**

If any code changes were needed in this task, commit them with a `fix(calendar): …` message.

---

## Task 11: Sync docs (CLAUDE.md, README, LP)

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: LP files under `landing-page/` (resolve exact path during the task)

- [ ] **Step 1: CLAUDE.md — Rust backend section**

In `CLAUDE.md`, in the "Rust Backend" bullet list (the one that already lists `audio.rs`, `reminder.rs`, etc.), insert a new bullet alphabetically between `caffeinate.rs` and `clipboard.rs`:

```
- `calendar.rs` — read-only macOS Calendar access via EventKit. Owns an `EKEventStore` on a dedicated thread (not Send/Sync) with mpsc command routing and panic + ObjC exception guards (mirrors `mic_permission.rs` rule). Exposes `list_events(range)` to the LLM with `today` / `tomorrow` / `upcoming` (next 7 days, top 10). Permission flow: always call `requestFullAccessToEvents`, never short-circuit on cached status.
```

- [ ] **Step 2: CLAUDE.md — openai.rs tool list**

In the `openai.rs` paragraph that enumerates available tools, add `list_events` to the comma-separated list.

- [ ] **Step 3: CLAUDE.md — capabilities.rs note**

If there's a "When you add a new tool, add a matching example to capabilities.rs" reminder (there is, around the `capabilities.rs` description), no change needed — it already covers this.

- [ ] **Step 4: README — feature list**

In `README.md`, find the feature list (look for the "Notes" / "Music" / "Volume" entries). Add a "Calendar" entry with the same shape, with these example phrases: "What's on my calendar today?", "Tomorrow's schedule?", "What's next?".

- [ ] **Step 5: LP — example phrases**

Find the LP file(s) that list spoken example phrases (search for an existing example like "What's playing?" or "Read the clipboard"). Add three calendar examples consistent with `capabilities.rs::capabilities_en`:

- "What's on my calendar today?"
- "Tomorrow's schedule?"
- "What's next?"

If the LP has a localized JSON, also add the Japanese phrases from `capabilities.rs::capabilities_ja`. Match the shape used by other locales — don't invent new keys.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md landing-page
git commit -m "docs(calendar): sync README, CLAUDE.md, and LP for list_events tool"
```

---

## Task 12: Update memory entries

**Files:**
- Modify: `/Users/piro/.claude/projects/-Users-piro-Repository-chappie-desktop/memory/project_roadmap_ideas.md`
- Modify: `/Users/piro/.claude/projects/-Users-piro-Repository-chappie-desktop/memory/project_provider_test_status.md`

- [ ] **Step 1: Move calendar item to ✅ list**

In `project_roadmap_ideas.md`:
- Remove the parenthetical line about calendar integration ("カレンダー連携（galopen 統合 = …）はやや重め、優先度中。") from the "直近候補" section.
- Add to the "完了" list:

```
- ✅ `list_events`（読み取り専用のカレンダー連携、`calendar.rs` で EventKit を専用スレッド + panic/ObjC ガードでラップ、range=today/tomorrow/upcoming、最大10件、権限未許可は permission_denied で LLM に Settings 案内、2026-05-09）
```

- [ ] **Step 2: Update provider test status**

In `project_provider_test_status.md`, append the verification result from Task 10 Step 6 (which providers were exercised against `list_events`, which passed).

- [ ] **Step 3: Verify**

These files live outside the git repo (in `~/.claude/projects/...`), so no git commit. Just save.

---

## Self-Review Notes (already applied)

- Spec coverage:
  - calendar.rs scaffolding: Task 3.
  - fetch_events impl: Task 4.
  - lib.rs wiring: Task 5.
  - LLM tool: Task 6.
  - Permission UI: Task 9.
  - Permission plist + entitlement: Task 2.
  - Cargo dep: Task 1.
  - capabilities.rs: Task 7.
  - i18n: Task 8.
  - LP / README / CLAUDE.md sync: Task 11.
  - Memory sync: Task 12.
  - Manual test plan from spec: Task 10.
- Type consistency: `Range` enum (`Today` / `Tomorrow` / `Upcoming`) is referenced consistently in Tasks 3, 4, 6. `CalendarEvent` shape (id / title / start / end / is_all_day / location / calendar_name) is used consistently between Task 3 (declaration) and Task 4 (population). `calendar_status` Tauri command vs. `calendar_status_sync` helper are explicitly distinguished in Task 6.
- No placeholders. All code blocks contain actual code.
