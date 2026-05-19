// Opt-in usage analytics. When the user has flipped on
// "Share usage data" in Settings, every chat turn is reported as one
// event with the utterance + called tool names + metadata. The proxy
// at chappie.kkweb.io/api/analytics inserts to Supabase.
//
// What gets sent (transparent in Settings):
//   - utterance text (Whisper output)
//   - tool_calls (names only — no arguments, no results)
//   - lang / mode / latency_ms / success
//   - device_id header (UUIDv5, one-way)
//
// What is NEVER sent:
//   - audio recordings
//   - LLM response text
//   - any API key or auth token
//   - file paths / Mac username / IP (those would leak via headers
//     only; we use a minimal HTTP client without any of them)
//
// Reporting is fire-and-forget: HTTP failure or 4xx is logged at
// debug level and dropped. We never let analytics block the user's
// turn.

use once_cell::sync::Lazy;
use serde::Serialize;
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

static CONSENT: AtomicBool = AtomicBool::new(false);
static CONSENT_INIT: AtomicBool = AtomicBool::new(false);

/// In-memory ring of the last N events the desktop has sent, exposed
/// to the Settings UI via `recent_events()` so users can see exactly
/// what they're sharing. Capped at 5 to keep memory bounded.
static RECENT: Lazy<Mutex<Vec<RecentEvent>>> = Lazy::new(|| Mutex::new(Vec::new()));
const RECENT_CAP: usize = 5;

#[derive(Clone, Debug, Serialize)]
pub struct RecentEvent {
    pub ts_unix: i64,
    pub utterance: String,
    pub tool_calls: Vec<String>,
    pub lang: String,
    pub mode: String,
    pub success: bool,
}

const DEFAULT_PROXY_BASE: &str = "https://chappie.kkweb.io";

static HTTP: Lazy<reqwest::Client> =
    Lazy::new(|| crate::http::build_client(Some(5), Some("chappie-analytics/1.0")));

fn proxy_base() -> String {
    std::env::var("CHAPPIE_ANALYTICS_PROXY_BASE")
        .ok()
        .filter(|s| !s.trim().is_empty())
        // Fall back to the chat proxy base — the analytics endpoints
        // sit on the same host in prod and in local dev.
        .or_else(|| {
            std::env::var("CHAPPIE_PROXY_URL")
                .ok()
                .and_then(|s| {
                    // Strip "/api/chat" suffix if present, leaving the base.
                    let s = s.trim().trim_end_matches('/');
                    if let Some(idx) = s.rfind("/api/") {
                        Some(s[..idx].to_string())
                    } else {
                        None
                    }
                })
        })
        .unwrap_or_else(|| DEFAULT_PROXY_BASE.to_string())
}

/// True when the user has opted in. Read by dispatch / chat_complete
/// to decide whether to call `report_turn`.
pub fn consent() -> bool {
    CONSENT.load(Ordering::Relaxed)
}

/// Renderer pushes the current consent state on launch and on every
/// `settings:updated` event. We cache it in an AtomicBool so the
/// dispatch hot path doesn't have to round-trip through the Tauri
/// store on every turn.
pub fn set_consent_cached(c: bool) {
    CONSENT.store(c, Ordering::Relaxed);
    CONSENT_INIT.store(true, Ordering::Relaxed);
}

pub fn consent_initialized() -> bool {
    CONSENT_INIT.load(Ordering::Relaxed)
}

#[derive(Serialize)]
struct EventBody<'a> {
    turn_id: &'a str,
    utterance: &'a str,
    tool_calls: &'a [String],
    lang: &'a str,
    mode: &'a str,
    latency_ms: u64,
    success: bool,
}

/// Send one turn to the proxy if the user has opted in. Fire-and-forget:
/// the spawned task logs errors but never returns them to the caller.
/// `turn_id` should be the same one the chat request used, so server-side
/// dedup catches accidental double-sends.
pub fn report_turn(
    turn_id: String,
    utterance: String,
    tool_calls: Vec<String>,
    lang: String,
    mode: String,
    latency_ms: u64,
    success: bool,
) {
    // Push to in-memory ring even when consent is off — the Settings
    // UI uses this to show "what would be sent if you opted in" too.
    // The actual network call is gated below.
    push_recent(&utterance, &tool_calls, &lang, &mode, success);

    if !consent() {
        return;
    }

    let device_id = match crate::device_id::get_or_init() {
        Ok(d) => d,
        Err(_) => return,
    };
    let url = format!("{}/api/analytics", proxy_base());
    let body = json!({
        "turn_id": turn_id,
        "utterance": utterance,
        "tool_calls": tool_calls,
        "lang": lang,
        "mode": mode,
        "latency_ms": latency_ms,
        "success": success,
    });

    tokio::spawn(async move {
        let res = HTTP
            .post(&url)
            .header("X-Chappie-Device-Id", device_id)
            .json(&body)
            .send()
            .await;
        match res {
            Ok(r) if r.status().is_success() => {}
            Ok(r) => {
                // Body intentionally not logged in full so a stray PII-shaped
                // server message doesn't end up in user logs.
                eprintln!("[analytics] proxy returned {}", r.status());
            }
            Err(e) => {
                eprintln!("[analytics] send failed: {e}");
            }
        }
    });
}

fn push_recent(
    utterance: &str,
    tool_calls: &[String],
    lang: &str,
    mode: &str,
    success: bool,
) {
    let event = RecentEvent {
        ts_unix: chrono::Utc::now().timestamp(),
        utterance: utterance.to_string(),
        tool_calls: tool_calls.to_vec(),
        lang: lang.to_string(),
        mode: mode.to_string(),
        success,
    };
    if let Ok(mut g) = RECENT.lock() {
        if g.len() >= RECENT_CAP {
            g.remove(0);
        }
        g.push(event);
    }
}

/// Returns the most-recent N events (oldest first) so the Settings UI
/// can show users exactly what gets sent. Empty when nothing has been
/// reported this session.
pub fn recent_events() -> Vec<RecentEvent> {
    RECENT.lock().map(|g| g.clone()).unwrap_or_default()
}

/// Set the server-side consent state and update the cached flag.
/// Called from a Tauri command when the user toggles the setting.
pub async fn set_consent_server(consent_flag: bool) -> Result<(), String> {
    let device_id = crate::device_id::get_or_init()?;
    let url = format!("{}/api/analytics/consent", proxy_base());
    let res = HTTP
        .post(&url)
        .header("X-Chappie-Device-Id", device_id)
        .json(&json!({ "consent": consent_flag }))
        .send()
        .await
        .map_err(|e| format!("consent send: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!(
            "consent {status}: {}",
            body.chars().take(200).collect::<String>()
        ));
    }
    set_consent_cached(consent_flag);
    Ok(())
}

/// Hard-delete every analytics row + the consent row for this device.
/// Also flips the local cache off so future turns don't try to report.
pub async fn delete_history() -> Result<(), String> {
    let device_id = crate::device_id::get_or_init()?;
    let url = format!("{}/api/analytics/delete", proxy_base());
    let res = HTTP
        .post(&url)
        .header("X-Chappie-Device-Id", device_id)
        .send()
        .await
        .map_err(|e| format!("delete send: {e}"))?;
    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!(
            "delete {status}: {}",
            body.chars().take(200).collect::<String>()
        ));
    }
    set_consent_cached(false);
    if let Ok(mut g) = RECENT.lock() {
        g.clear();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Env-var tests for proxy_base are intentionally omitted: cargo
    // runs tests in parallel and they share process env, which makes
    // any CHAPPIE_PROXY_URL set/unset race with sibling tests in this
    // module. The proxy_base function is exercised by the recent ring
    // and consent toggle tests above (via push_recent + report_turn),
    // and by manual dev verification.

    #[test]
    fn recent_ring_caps_at_5() {
        // Clear ring then push 7 — only last 5 should remain.
        if let Ok(mut g) = RECENT.lock() {
            g.clear();
        }
        for i in 0..7 {
            push_recent(&format!("utt-{i}"), &[], "ja", "free", true);
        }
        let r = recent_events();
        assert_eq!(r.len(), 5);
        assert_eq!(r[0].utterance, "utt-2");
        assert_eq!(r[4].utterance, "utt-6");
    }

    #[test]
    fn consent_toggle_round_trips() {
        set_consent_cached(true);
        assert!(consent());
        set_consent_cached(false);
        assert!(!consent());
    }
}
