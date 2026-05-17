// Lightweight tool-usage counter. Persists to ~/.chappie/tool_usage.json so
// the assistant has data to decide which tools are dead weight before pruning
// the kitchen-sink. Recorded at the entry of `tools::execute_tool` (after MCP
// routing, so MCP tools are counted too via the same code path).

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

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
