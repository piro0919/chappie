// Lightweight tool-usage counter. Persists to ~/.chappie/tool_usage.json so
// the assistant has data to decide which tools are dead weight before pruning
// the kitchen-sink. Recorded at the entry of `tools::execute_tool` (after MCP
// routing, so MCP tools are counted too via the same code path).

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Mutex;

// --- Personalized tool routing (hot set) ---------------------------------
//
// We build a per-user "hot set" of frequently/recently used tools from the
// counts above, so the dispatcher can send only those (plus an escape tool)
// instead of the full ~60-tool kitchen sink. See docs: personalized routing.
//
// score = count * exp(-ln2 * age_days / HALF_LIFE_DAYS)
//   - HALF_LIFE_DAYS: a tool unused for this many days loses half its weight
//   - MIN_SCORE: floor a tool must clear to join the hot set
//   - MAX_HOT: cap on hot-set size
//   - MIN_HOT_FLOOR: below this many qualifying tools we return None so the
//     caller falls back to all_tools() — trimming a tiny set isn't worth the
//     prompt-cache fragmentation (cold start / very light users).
const HALF_LIFE_DAYS: f64 = 30.0;
const MIN_SCORE: f64 = 1.0;
const MAX_HOT: usize = 20;
const MIN_HOT_FLOOR: usize = 6;

// The hot set is memoized once per process so the tools-array prefix stays
// stable within a session (keeps prompt-cache hits high). New habits are
// picked up on next launch; in-session misses are absorbed by the escape
// tool fallback.
static HOT_SET: Lazy<Mutex<Option<Option<HashSet<String>>>>> = Lazy::new(|| Mutex::new(None));

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Entry {
    pub count: u64,
    pub last_used_at_unix_ms: i64,
}

#[derive(Clone, Serialize)]
pub struct UsageRow {
    pub name: String,
    pub count: u64,
    pub last_used_at_unix_ms: i64,
}

static USAGE: Lazy<Mutex<HashMap<String, Entry>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static LOADED: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

// Personalized routing enabled flag. Defaults ON; the renderer pushes the
// persisted setting on launch and on every `settings:updated` (mirrors the
// analytics consent caching pattern) so the dispatch hot path never has to
// round-trip the Tauri store.
static PERSONALIZED_ENABLED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(true);

/// True when personalized (hot-set) tool routing is enabled.
pub fn personalized_enabled() -> bool {
    PERSONALIZED_ENABLED.load(std::sync::atomic::Ordering::Relaxed)
}

/// Renderer pushes the current toggle state on launch and on `settings:updated`.
#[tauri::command]
pub fn set_personalized_routing_cached(enabled: bool) {
    PERSONALIZED_ENABLED.store(enabled, std::sync::atomic::Ordering::Relaxed);
}

fn store_path() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    let _ = std::fs::create_dir_all(&p);
    p.push("tool_usage.json");
    Some(p)
}

fn ensure_loaded() {
    let mut loaded = LOADED.lock().unwrap();
    if *loaded {
        return;
    }
    *loaded = true;
    let Some(path) = store_path() else { return };
    let Ok(bytes) = std::fs::read(&path) else {
        return;
    };
    let Ok(entries): Result<HashMap<String, Entry>, _> = serde_json::from_slice(&bytes) else {
        eprintln!("[tool_usage] failed to parse {}", path.display());
        return;
    };
    *USAGE.lock().unwrap() = entries;
}

fn persist_locked(map: &HashMap<String, Entry>) {
    let Some(path) = store_path() else { return };
    if let Ok(json) = serde_json::to_string_pretty(map) {
        let _ = std::fs::write(path, json);
    }
}

pub fn record(name: &str) {
    ensure_loaded();
    let now = chrono::Local::now().timestamp_millis();
    let mut map = USAGE.lock().unwrap();
    let entry = map.entry(name.to_string()).or_default();
    entry.count += 1;
    entry.last_used_at_unix_ms = now;
    persist_locked(&map);
}

#[tauri::command]
pub fn list_tool_usage() -> Vec<UsageRow> {
    list()
}

pub fn list() -> Vec<UsageRow> {
    ensure_loaded();
    let map = USAGE.lock().unwrap();
    let mut rows: Vec<UsageRow> = map
        .iter()
        .map(|(name, e)| UsageRow {
            name: name.clone(),
            count: e.count,
            last_used_at_unix_ms: e.last_used_at_unix_ms,
        })
        .collect();
    rows.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));
    rows
}

/// Recency-decayed score for a single tool. Pure (testable) helper.
fn decayed_score(count: u64, last_used_at_unix_ms: i64, now_ms: i64) -> f64 {
    if count == 0 {
        return 0.0;
    }
    let age_ms = (now_ms - last_used_at_unix_ms).max(0) as f64;
    let age_days = age_ms / (1000.0 * 60.0 * 60.0 * 24.0);
    let decay = (-std::f64::consts::LN_2 * age_days / HALF_LIFE_DAYS).exp();
    count as f64 * decay
}

/// Pure hot-set computation over (name, count, last_used) rows. Returns None
/// when fewer than MIN_HOT_FLOOR tools qualify (caller should use all_tools).
/// `end_conversation` is always unioned in when a hot set is returned.
fn compute_hot_set(rows: &[UsageRow], now_ms: i64) -> Option<HashSet<String>> {
    let mut scored: Vec<(&str, f64)> = rows
        .iter()
        .map(|r| {
            (
                r.name.as_str(),
                decayed_score(r.count, r.last_used_at_unix_ms, now_ms),
            )
        })
        .filter(|(_, s)| *s >= MIN_SCORE)
        .collect();
    if scored.len() < MIN_HOT_FLOOR {
        return None;
    }
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(MAX_HOT);
    let mut set: HashSet<String> = scored.into_iter().map(|(n, _)| n.to_string()).collect();
    set.insert("end_conversation".to_string());
    Some(set)
}

/// Memoized per-user hot set. None means "no useful hot set — use all_tools".
/// Computed once per process from tool_usage.json.
pub fn hot_tool_names() -> Option<HashSet<String>> {
    let mut cache = HOT_SET.lock().unwrap();
    if let Some(cached) = cache.as_ref() {
        return cached.clone();
    }
    let rows = list();
    let now_ms = chrono::Local::now().timestamp_millis();
    let computed = compute_hot_set(&rows, now_ms);
    *cache = Some(computed.clone());
    computed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(name: &str, count: u64, last_ms: i64) -> UsageRow {
        UsageRow {
            name: name.to_string(),
            count,
            last_used_at_unix_ms: last_ms,
        }
    }

    const DAY_MS: i64 = 1000 * 60 * 60 * 24;

    #[test]
    fn recent_low_count_outranks_old_high_count() {
        let now = 1_000 * DAY_MS;
        // old tool: high count but ~120 days stale (4 half-lives → /16)
        let old = decayed_score(40, now - 120 * DAY_MS, now);
        // fresh tool: modest count, used today
        let fresh = decayed_score(5, now, now);
        assert!(fresh > old, "fresh {fresh} should outrank old {old}");
    }

    #[test]
    fn returns_none_below_floor() {
        let now = 100 * DAY_MS;
        let rows = vec![row("a", 3, now), row("b", 2, now)];
        assert!(compute_hot_set(&rows, now).is_none());
    }

    #[test]
    fn returns_set_with_end_conversation_when_enough() {
        let now = 100 * DAY_MS;
        let rows: Vec<UsageRow> = (0..8).map(|i| row(&format!("t{i}"), 5, now)).collect();
        let set = compute_hot_set(&rows, now).expect("hot set");
        assert!(set.contains("end_conversation"));
        assert!(set.contains("t0"));
        assert_eq!(set.len(), 9); // 8 tools + end_conversation
    }

    #[test]
    fn caps_at_max_hot_plus_end_conversation() {
        let now = 100 * DAY_MS;
        let rows: Vec<UsageRow> = (0..40).map(|i| row(&format!("t{i}"), 10, now)).collect();
        let set = compute_hot_set(&rows, now).expect("hot set");
        assert_eq!(set.len(), MAX_HOT + 1);
    }
}
