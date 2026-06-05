// Proactive Chappie — fires renderer events when the app should speak up
// on its own (no wake-word). v1 covers two sources:
//
// - Morning briefing: weather + today's calendar headline at a user-set
//   wall-clock time (default 07:00). Once per day.
// - Calendar pre-warning: list today's events every minute; emit when an
//   event's start - lead_min is within the current tick's window. Dedupe
//   by event id so a fixed lead-time is honored even if the tick fires
//   slightly off-cycle.
//
// The tick interval is 30s (cheap, gives ±30s precision on both
// morning-brief firing time and calendar lead time without per-event
// scheduling overhead). Loop reads the latest `Config` snapshot each tick
// so settings changes from the renderer apply on the next tick without
// restart.
//
// Both features emit `proactive:fired` with a tagged payload; the
// renderer composes the user-facing string from its i18n catalog and
// routes to TTS or HUD based on system mute state (same pattern as
// `timer:fired` / `reminder:fired`).
//
// Idle state is pushed from the renderer via `notify_idle_state` but
// only stored — v2 will use it for idle chatter.

use chrono::{DateTime, Datelike, Local, NaiveTime, TimeZone, Timelike};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const TICK_SECONDS: u64 = 30;
/// Half-width of the firing window. A tick fires the morning brief or a
/// calendar pre-warning when "now" is within ±TICK_TOLERANCE of the
/// target moment. Picked to match TICK_SECONDS so the windows are
/// adjacent without overlap.
const TICK_TOLERANCE_SECONDS: i64 = 30;
/// Minimum gap between weather snapshot fetches — 30 minutes balances
/// "notice rain coming" responsiveness against Open-Meteo politeness.
const WEATHER_POLL_SECONDS: i64 = 30 * 60;
/// Per-condition cooldown so a code that flaps doesn't fire the same
/// alert over and over. 4h matches "morning shower stays as one alert
/// for the whole window".
const WEATHER_ALERT_COOLDOWN_SECONDS: i64 = 4 * 60 * 60;
/// Daily fire cap for idle chatter so the assistant doesn't become
/// annoying. Combined with the per-fire cooldown below this gives at
/// most one casual prompt every couple of hours when the user is
/// genuinely away.
const IDLE_CHATTER_DAILY_MAX: u32 = 3;
/// Minimum gap between consecutive idle-chatter fires (unix seconds).
/// 90 minutes keeps the cadence sane even if the user comes back,
/// uses Chappie briefly, and goes idle again immediately.
const IDLE_CHATTER_FIRE_COOLDOWN_SECONDS: i64 = 90 * 60;
/// If the wall clock jumps more than this between two consecutive ticks,
/// the machine was asleep (lid closed) — the process is suspended during
/// macOS sleep so the loop simply stops ticking. 3× the tick interval is
/// well clear of normal scheduling jitter while still catching even a
/// short nap. On detection we restart the idle clock so a multi-hour
/// sleep doesn't instantly cross the idle-chatter threshold and greet the
/// user the moment they reopen the lid.
const SLEEP_GAP_THRESHOLD_SECONDS: i64 = TICK_SECONDS as i64 * 3;

#[derive(Clone, Deserialize, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub morning_brief_enabled: bool,
    /// HH:MM in the user's local timezone.
    pub morning_brief_time: String,
    pub calendar_enabled: bool,
    pub calendar_lead_min: i64,
    pub weather_enabled: bool,
    pub idle_chatter_enabled: bool,
    /// Minutes of continuous idle before idle chatter fires.
    pub idle_chatter_after_min: i64,
    /// HH:MM. If start > end, the window wraps midnight (e.g. 22:00-07:00
    /// means quiet from 22:00 to 07:00 the next morning).
    pub quiet_hours_start: String,
    pub quiet_hours_end: String,
}

#[derive(Default)]
struct State {
    config: Config,
    /// `YYYY-MM-DD` (local) of the last morning brief fire so we don't
    /// re-fire if the loop's tick window straddles the target time.
    last_morning_brief_date: Option<String>,
    /// Calendar event ids that have already been pre-warned in the
    /// current day. Cleared at midnight (detected when the local date
    /// changes between ticks).
    fired_event_ids: HashSet<String>,
    last_tick_date: Option<String>,
    /// Unix-seconds wall-clock time of the previous tick. Compared against
    /// the current tick to detect a sleep/wake gap (the process is frozen
    /// during macOS sleep, so a far-larger-than-`TICK_SECONDS` jump means
    /// the lid was closed in between). `None` until the first tick runs.
    last_tick_unix: Option<i64>,
    /// Most recent idle/busy flag pushed by the renderer.
    idle: bool,
    /// Unix-seconds timestamp of the most recent idle→busy
    /// transition (i.e. when the user last fell idle). `None` when the
    /// renderer is currently busy. Used by idle-chatter to know how
    /// long the user has been quiet.
    idle_since_unix: Option<i64>,
    /// Last time idle chatter fired (unix seconds). Compared against
    /// `IDLE_CHATTER_FIRE_COOLDOWN_SECONDS` so a once-per-day phrase
    /// budget can't all burn in the same hour.
    last_idle_chatter_unix: Option<i64>,
    /// `YYYY-MM-DD` (local) of the day whose count is tracked in
    /// `idle_chatter_count`. Rolls over at midnight (handled by the
    /// existing date-rollover branch in `tick`).
    idle_chatter_count_date: Option<String>,
    /// Number of idle-chatter fires today. Capped at
    /// `IDLE_CHATTER_DAILY_MAX`.
    idle_chatter_count: u32,
    /// Last time (unix seconds) we fetched the weather snapshot — used
    /// to gate the 30-minute polling cadence for weather alerts.
    last_weather_check_unix: Option<i64>,
    /// Last fetched weather snapshot (code, temp). Compared against
    /// the current snapshot to detect "rain just started" and "temp
    /// swing >= 5°C".
    last_weather_snapshot: Option<(u32, f64)>,
    /// Last fire time (unix seconds) of each weather-alert condition,
    /// keyed by `WeatherCondition::id_str()`. Used for the per-
    /// condition 4-hour cooldown so a flapping rain code doesn't
    /// fire repeatedly.
    last_weather_alert: std::collections::HashMap<&'static str, i64>,
}

static STATE: Lazy<Mutex<State>> = Lazy::new(|| Mutex::new(State::default()));

pub fn set_config(cfg: Config) {
    if let Ok(mut s) = STATE.lock() {
        s.config = cfg;
    }
}

pub fn notify_idle(idle: bool) {
    if let Ok(mut s) = STATE.lock() {
        s.idle = idle;
        s.idle_since_unix = if idle {
            Some(Local::now().timestamp())
        } else {
            None
        };
    }
}

pub fn init(app: &AppHandle) {
    let app_clone = app.clone();
    // `tauri::async_runtime::spawn` instead of `tokio::spawn` because
    // setup() runs before Tauri attaches the tokio runtime to the
    // current thread — bare tokio::spawn panics with "no reactor
    // running" at startup. This matches `timer::start_tray_title_ticker`.
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(TICK_SECONDS)).await;
            tick(&app_clone).await;
        }
    });
}

async fn tick(app: &AppHandle) {
    let (cfg, last_brief_date, prev_tick_date, fired_ids, prev_tick_unix) = {
        let s = match STATE.lock() {
            Ok(s) => s,
            Err(_) => return,
        };
        (
            s.config.clone(),
            s.last_morning_brief_date.clone(),
            s.last_tick_date.clone(),
            s.fired_event_ids.clone(),
            s.last_tick_unix,
        )
    };

    // No master switch — if all sources are off we just skip
    // everything below. The 30s tick still runs (cheap) so toggling
    // one back on takes effect immediately.
    if !cfg.morning_brief_enabled
        && !cfg.calendar_enabled
        && !cfg.weather_enabled
        && !cfg.idle_chatter_enabled
    {
        return;
    }

    let now = Local::now();
    let today = format_date(&now);
    let now_unix = now.timestamp();

    // Sleep/wake guard. The process is suspended during macOS sleep, so a
    // jump far larger than the tick interval since the previous tick means
    // the lid was closed in between. Idle time accumulated while asleep
    // isn't real "user has been quiet" time — without this, `idle_since`
    // (set when the user last fell idle, before sleep) makes `idle_elapsed`
    // instantly exceed the threshold on wake and idle-chatter greets the
    // user the moment they reopen the lid. Restart the idle clock from the
    // wake instant (only when already idle — don't fabricate an idle start
    // while the renderer is busy) so a fresh `after_min` of real quiet is
    // required again. Always refresh `last_tick_unix` for the next compare.
    {
        let slept = prev_tick_unix
            .map(|t| now_unix - t > SLEEP_GAP_THRESHOLD_SECONDS)
            .unwrap_or(false);
        if let Ok(mut s) = STATE.lock() {
            if slept && s.idle_since_unix.is_some() {
                s.idle_since_unix = Some(now_unix);
            }
            s.last_tick_unix = Some(now_unix);
        }
    }

    // Midnight rollover — drop yesterday's calendar dedupe set and
    // the idle-chatter daily counter (kept in sync via the same
    // date stamp so both reset together).
    if prev_tick_date.as_deref() != Some(today.as_str()) {
        if let Ok(mut s) = STATE.lock() {
            s.fired_event_ids.clear();
            s.idle_chatter_count = 0;
            s.idle_chatter_count_date = Some(today.clone());
            s.last_tick_date = Some(today.clone());
        }
    }

    if in_quiet_hours(&now, &cfg.quiet_hours_start, &cfg.quiet_hours_end) {
        return;
    }

    // ----- ① Morning briefing -----
    if cfg.morning_brief_enabled
        && last_brief_date.as_deref() != Some(today.as_str())
        && is_within_target_window(&now, &cfg.morning_brief_time)
    {
        if let Some(payload) = compose_morning_brief().await {
            let _ = app.emit("proactive:fired", &payload);
            if let Ok(mut s) = STATE.lock() {
                s.last_morning_brief_date = Some(today);
            }
        }
    }

    // ----- ③ Weather alert -----
    if cfg.weather_enabled {
        let (last_check, last_snap, alerts) = {
            let s = STATE.lock().ok();
            match s {
                Some(s) => (
                    s.last_weather_check_unix,
                    s.last_weather_snapshot,
                    s.last_weather_alert.clone(),
                ),
                None => (None, None, std::collections::HashMap::new()),
            }
        };
        let due = last_check
            .map(|t| now_unix - t >= WEATHER_POLL_SECONDS)
            .unwrap_or(true);
        if due {
            if let Some(snapshot) = fetch_weather_snapshot().await {
                if let Some(prev) = last_snap {
                    for condition in detect_weather_alerts(prev, snapshot) {
                        let last = alerts.get(condition.id()).copied().unwrap_or(0);
                        if now_unix - last < WEATHER_ALERT_COOLDOWN_SECONDS {
                            continue;
                        }
                        let payload = ProactiveFired::WeatherAlert {
                            detail: condition.detail_jp(),
                        };
                        let _ = app.emit("proactive:fired", &payload);
                        if let Ok(mut s) = STATE.lock() {
                            s.last_weather_alert.insert(condition.id(), now_unix);
                        }
                    }
                }
                if let Ok(mut s) = STATE.lock() {
                    s.last_weather_check_unix = Some(now_unix);
                    s.last_weather_snapshot = Some(snapshot);
                }
            }
        }
    }

    // ----- ④ Idle chatter -----
    if cfg.idle_chatter_enabled && cfg.idle_chatter_after_min > 0 {
        let (idle_since, count, last_fire) = {
            let s = STATE.lock().ok();
            match s {
                Some(s) => (s.idle_since_unix, s.idle_chatter_count, s.last_idle_chatter_unix),
                None => (None, 0, None),
            }
        };
        if let Some(since) = idle_since {
            let idle_elapsed = now_unix - since;
            let after_secs = cfg.idle_chatter_after_min * 60;
            let cooldown_ok = last_fire
                .map(|t| now_unix - t >= IDLE_CHATTER_FIRE_COOLDOWN_SECONDS)
                .unwrap_or(true);
            if idle_elapsed >= after_secs
                && count < IDLE_CHATTER_DAILY_MAX
                && cooldown_ok
            {
                // Which line to speak is chosen renderer-side from the
                // time-of-day-aware idle-chatter pool — Rust only signals
                // that a fire is due, plus any optional context.
                let context = compose_idle_chatter_context().await;
                let payload = ProactiveFired::IdleChatter { context };
                let _ = app.emit("proactive:fired", &payload);
                if let Ok(mut s) = STATE.lock() {
                    s.idle_chatter_count = s.idle_chatter_count.saturating_add(1);
                    s.last_idle_chatter_unix = Some(now_unix);
                    // Reset idle_since so a continuous idle stretch
                    // doesn't re-fire on the next tick — the next
                    // fire requires a busy interlude AND another
                    // full `after_min` of idle, OR (in practice) a
                    // fresh idle transition after the user briefly
                    // wakes the assistant.
                    s.idle_since_unix = Some(now_unix);
                }
            }
        }
    }

    // ----- ② Calendar pre-warning -----
    if cfg.calendar_enabled && cfg.calendar_lead_min > 0 {
        // Permission check is cheap and gates fetch_events from
        // surfacing prompts; if denied/unset we just no-op.
        let granted = crate::calendar::calendar_status_sync()
            .map(|s| s == "granted")
            .unwrap_or(false);
        if granted {
            let events = crate::calendar::fetch_events(crate::calendar::Range::Today)
                .unwrap_or_default();
            for ev in events {
                if ev.is_all_day {
                    continue;
                }
                if fired_ids.contains(&ev.id) {
                    continue;
                }
                let Some(start) = parse_rfc3339_local(&ev.start) else {
                    continue;
                };
                let target = start - chrono::Duration::minutes(cfg.calendar_lead_min);
                let delta = (now - target).num_seconds().abs();
                if delta > TICK_TOLERANCE_SECONDS {
                    continue;
                }
                let payload = ProactiveFired::CalendarWarning {
                    lead_min: cfg.calendar_lead_min,
                    title: ev.title.clone(),
                };
                let _ = app.emit("proactive:fired", &payload);
                if let Ok(mut s) = STATE.lock() {
                    s.fired_event_ids.insert(ev.id);
                }
            }
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum ProactiveFired {
    #[serde(rename_all = "camelCase")]
    MorningBrief {
        weather: String,
        temp: i32,
        event_count: usize,
        first_time: Option<String>,
        first_title: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    CalendarWarning { lead_min: i64, title: String },
    #[serde(rename_all = "camelCase")]
    WeatherAlert { detail: String },
    #[serde(rename_all = "camelCase")]
    IdleChatter {
        /// Optional context bundle (time band, next event, current
        /// weather, long-term topics) injected into the renderer's
        /// LLM prompt so the chatter feels grounded instead of
        /// canned. Empty string means "no context available" and
        /// the renderer falls back to a context-less prompt.
        context: String,
    },
}

async fn compose_morning_brief() -> Option<ProactiveFired> {
    let (weather, temp) = fetch_current_weather().await?;

    let event_count;
    let first_time;
    let first_title;
    let granted = crate::calendar::calendar_status_sync()
        .map(|s| s == "granted")
        .unwrap_or(false);
    if granted {
        let now = Local::now();
        let events = crate::calendar::fetch_events(crate::calendar::Range::Today)
            .unwrap_or_default();
        let upcoming: Vec<_> = events
            .into_iter()
            .filter(|ev| {
                if ev.is_all_day {
                    return false;
                }
                parse_rfc3339_local(&ev.start)
                    .map(|t| t >= now)
                    .unwrap_or(false)
            })
            .collect();
        event_count = upcoming.len();
        first_time = upcoming
            .first()
            .and_then(|ev| parse_rfc3339_local(&ev.start))
            .map(|t| format!("{:02}:{:02}", t.hour(), t.minute()));
        first_title = upcoming.first().map(|ev| ev.title.clone());
    } else {
        event_count = 0;
        first_time = None;
        first_title = None;
    }

    Some(ProactiveFired::MorningBrief {
        weather,
        temp,
        event_count,
        first_time,
        first_title,
    })
}

/// Bundle of available context for idle chatter — time band, next
/// calendar event, current weather, long-term topics. Each source is
/// best-effort; sources that fail or are empty are omitted rather
/// than reported as "unknown" so the resulting prompt stays tight.
/// The renderer concatenates this string into the LLM system prompt
/// so the chatter feels grounded rather than canned.
async fn compose_idle_chatter_context() -> String {
    let mut sections: Vec<String> = Vec::new();

    // Time band — cheap, always available.
    let now = Local::now();
    let band = match now.hour() {
        5..=10 => "朝",
        11..=16 => "昼間",
        17..=21 => "夕方〜夜",
        _ => "深夜",
    };
    sections.push(format!("現在の時間帯: {band} ({}時台)。", now.hour()));

    // Next event today.
    if crate::calendar::calendar_status_sync()
        .map(|s| s == "granted")
        .unwrap_or(false)
    {
        let events =
            crate::calendar::fetch_events(crate::calendar::Range::Today).unwrap_or_default();
        let upcoming = events.into_iter().find(|ev| {
            if ev.is_all_day {
                return false;
            }
            parse_rfc3339_local(&ev.start)
                .map(|t| t > now)
                .unwrap_or(false)
        });
        if let Some(ev) = upcoming {
            if let Some(start) = parse_rfc3339_local(&ev.start) {
                let mins = (start - now).num_minutes().max(0);
                sections.push(format!(
                    "次の予定: {:02}:{:02} から「{}」(あと {} 分)。",
                    start.hour(),
                    start.minute(),
                    ev.title,
                    mins,
                ));
            }
        }
    }

    // Current weather (uses the same snapshot path as weather alerts;
    // best-effort so it stays silent when location is unavailable).
    if let Some((code, temp)) = fetch_weather_snapshot().await {
        sections.push(format!(
            "現在の天気: {}, {:.0}℃。",
            crate::weather::weather_code_label(code),
            temp,
        ));
    }

    // Long-term topics — already a multi-line formatted block when
    // present, empty otherwise. Append verbatim.
    let topics = crate::topics::prompt_section();
    if !topics.trim().is_empty() {
        sections.push(topics);
    }

    sections.join("\n")
}

/// Snapshot used by the weather-alert pipeline. Returns (weather_code,
/// temp_c) so the detector can compare codes and temperatures
/// numerically. Distinct from `fetch_current_weather` which returns
/// the JP-formatted weather text for the morning brief.
async fn fetch_weather_snapshot() -> Option<(u32, f64)> {
    let (lat, lon, _) = crate::location_native::get_location().ok()?;
    let snap = crate::weather::current_snapshot(lat, lon).await.ok()?;
    Some((snap.weather_code, snap.temp_c))
}

#[derive(Clone, Debug)]
enum WeatherCondition {
    /// Rain code appeared where the prior snapshot wasn't raining.
    /// Phrased as "雨が降り始めた" — actionable in the present.
    RainStarted { code: u32 },
    /// Severe weather code (thunder / hail / heavy snow). Independent
    /// of prior state because severe warnings shouldn't depend on
    /// having seen a non-severe sample first.
    SevereWeather { code: u32 },
    /// Temperature shifted by >=5°C from the prior poll. Both
    /// directions matter (cold front / heatwave), so the detail text
    /// names the direction.
    TempSwing { from: f64, to: f64 },
}

impl WeatherCondition {
    fn id(&self) -> &'static str {
        match self {
            WeatherCondition::RainStarted { .. } => "rain",
            WeatherCondition::SevereWeather { .. } => "severe",
            WeatherCondition::TempSwing { .. } => "tempSwing",
        }
    }

    /// Detail text shown to the user. JP-only for v1 (same trade-off
    /// as the morning brief weather noun).
    fn detail_jp(&self) -> String {
        match self {
            WeatherCondition::RainStarted { code } => {
                format!("{}が降り始めました。", crate::weather::weather_code_label(*code))
            }
            WeatherCondition::SevereWeather { code } => {
                format!("{}の予報です。", crate::weather::weather_code_label(*code))
            }
            WeatherCondition::TempSwing { from, to } => {
                let direction = if to > from { "上がりました" } else { "下がりました" };
                format!("気温が {:.0}℃ から {:.0}℃ に{direction}。", from, to)
            }
        }
    }
}

fn is_rain_code(code: u32) -> bool {
    matches!(code, 51..=67 | 80..=82)
}

fn is_severe_code(code: u32) -> bool {
    // Thunderstorm / hail / heavy snow / heavy rain / freezing rain.
    matches!(code, 65 | 75 | 82 | 86 | 95 | 96 | 99)
}

fn detect_weather_alerts(prev: (u32, f64), curr: (u32, f64)) -> Vec<WeatherCondition> {
    let mut out = Vec::new();
    let (prev_code, prev_temp) = prev;
    let (curr_code, curr_temp) = curr;
    if is_rain_code(curr_code) && !is_rain_code(prev_code) {
        out.push(WeatherCondition::RainStarted { code: curr_code });
    }
    if is_severe_code(curr_code) && !is_severe_code(prev_code) {
        out.push(WeatherCondition::SevereWeather { code: curr_code });
    }
    if (curr_temp - prev_temp).abs() >= 5.0 {
        out.push(WeatherCondition::TempSwing {
            from: prev_temp,
            to: curr_temp,
        });
    }
    out
}

/// Returns (weather_text, temp_celsius). Weather text is always in
/// Japanese for v1 — see weather::weather_code_to_jp. Non-JP users get
/// a JP weather noun inside an otherwise-localized sentence, which is
/// imperfect but ships. Future work: expose weather_code as an integer
/// and map per-locale on the renderer side.
async fn fetch_current_weather() -> Option<(String, i32)> {
    let (lat, lon, _) = match crate::location_native::get_location() {
        Ok(v) => v,
        Err(_) => return None,
    };
    // Reach into weather's HTTP layer through the public string API.
    // The formatted output has a known structure: lines like
    //   "現在: <cond>, <temp>℃, 風速 …"
    // — we parse the first weather/temp pair out of it. Adding a
    // structured public fn to weather.rs would be cleaner but doubles
    // the surface area for one caller; revisit if v2 needs the parsed
    // values too.
    let raw = crate::weather::lookup_by_coords(lat, lon, "current", None)
        .await
        .ok()?;
    for line in raw.lines() {
        if let Some(rest) = line.strip_prefix("現在: ") {
            let parts: Vec<&str> = rest.splitn(3, ", ").collect();
            if parts.len() < 2 {
                continue;
            }
            let cond = parts[0].to_string();
            let temp_str = parts[1].trim_end_matches('℃');
            let temp: f64 = temp_str.parse().ok()?;
            return Some((cond, temp.round() as i32));
        }
    }
    None
}

fn format_date(dt: &DateTime<Local>) -> String {
    format!("{:04}-{:02}-{:02}", dt.year(), dt.month(), dt.day())
}

fn parse_hhmm(s: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(s.trim(), "%H:%M").ok()
}

fn parse_rfc3339_local(s: &str) -> Option<DateTime<Local>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Local))
}

fn is_within_target_window(now: &DateTime<Local>, target_hhmm: &str) -> bool {
    let Some(t) = parse_hhmm(target_hhmm) else {
        return false;
    };
    let target = match Local
        .with_ymd_and_hms(
            now.year(),
            now.month(),
            now.day(),
            t.hour(),
            t.minute(),
            0,
        )
        .single()
    {
        Some(v) => v,
        None => return false,
    };
    (now.signed_duration_since(target).num_seconds().abs()) <= TICK_TOLERANCE_SECONDS
}

fn in_quiet_hours(now: &DateTime<Local>, start: &str, end: &str) -> bool {
    let (Some(s), Some(e)) = (parse_hhmm(start), parse_hhmm(end)) else {
        return false;
    };
    // Default quiet hours are start=07:00, end=22:00 — this is the
    // "WAKING window", inverted. The Settings UI labels these as
    // "quiet hours" but the v1 semantics treat the range [start, end)
    // as the ACTIVE window so that the defaults (7-22) match the
    // expected "loud during the day, quiet at night" behavior without
    // requiring the user to invert the times themselves.
    let n = now.time();
    let active = if s <= e {
        n >= s && n < e
    } else {
        n >= s || n < e
    };
    !active
}

#[cfg(test)]
mod tests {
    use super::*;

    fn local_dt(y: i32, mo: u32, d: u32, h: u32, mi: u32, s: u32) -> DateTime<Local> {
        Local.with_ymd_and_hms(y, mo, d, h, mi, s).single().unwrap()
    }

    #[test]
    fn within_target_window_exact() {
        let now = local_dt(2026, 5, 18, 7, 0, 0);
        assert!(is_within_target_window(&now, "07:00"));
    }

    #[test]
    fn within_target_window_tolerant() {
        let now = local_dt(2026, 5, 18, 7, 0, 25);
        assert!(is_within_target_window(&now, "07:00"));
    }

    #[test]
    fn outside_target_window() {
        let now = local_dt(2026, 5, 18, 7, 1, 0);
        assert!(!is_within_target_window(&now, "07:00"));
    }

    #[test]
    fn active_window_normal() {
        // 7-22 is the active window — 12:00 is loud, 03:00 is quiet.
        let noon = local_dt(2026, 5, 18, 12, 0, 0);
        let dawn = local_dt(2026, 5, 18, 3, 0, 0);
        assert!(!in_quiet_hours(&noon, "07:00", "22:00"));
        assert!(in_quiet_hours(&dawn, "07:00", "22:00"));
    }

    #[test]
    fn active_window_wraps_midnight() {
        // 22-07 wraps: loud after 22 or before 07, quiet otherwise.
        let evening = local_dt(2026, 5, 18, 23, 0, 0);
        let morning = local_dt(2026, 5, 18, 5, 0, 0);
        let noon = local_dt(2026, 5, 18, 12, 0, 0);
        assert!(!in_quiet_hours(&evening, "22:00", "07:00"));
        assert!(!in_quiet_hours(&morning, "22:00", "07:00"));
        assert!(in_quiet_hours(&noon, "22:00", "07:00"));
    }
}
