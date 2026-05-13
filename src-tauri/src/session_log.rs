// Persistent raw conversation log. Every user/assistant turn is appended
// as one JSON line to ~/.chappie/log/YYYY-MM-DD.jsonl so that the
// long-term-memory layer (summarizer.rs / future rag.rs) has a permanent
// substrate to recall from.
//
// Distinct from memory.rs: memory.json holds LLM-curated facts; the
// session log is the raw conversational stream the curated facts and
// daily summaries are derived from. Users wipe logs via Settings (or
// manually) without losing curated memories.

use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
pub struct Turn {
    pub ts: i64,
    pub user: String,
    pub assistant: String,
    pub provider: String,
    pub model: String,
}

fn log_dir() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    p.push("log");
    let _ = std::fs::create_dir_all(&p);
    Some(p)
}

fn file_for(date: NaiveDate) -> Option<PathBuf> {
    let mut p = log_dir()?;
    p.push(format!("{}.jsonl", date.format("%Y-%m-%d")));
    Some(p)
}

/// Append one user/assistant pair to today's jsonl. Best-effort: failures
/// are logged and swallowed because losing a single log line should never
/// break the conversation path.
pub fn append_turn(user: &str, assistant: &str, provider: &str, model: &str) {
    let user_trim = user.trim();
    let asst_trim = assistant.trim();
    if user_trim.is_empty() && asst_trim.is_empty() {
        return;
    }
    let Some(path) = file_for(Local::now().date_naive()) else {
        return;
    };
    let turn = Turn {
        ts: Local::now().timestamp_millis(),
        user: user_trim.to_string(),
        assistant: asst_trim.to_string(),
        provider: provider.to_string(),
        model: model.to_string(),
    };
    let Ok(mut line) = serde_json::to_string(&turn) else {
        return;
    };
    line.push('\n');
    match OpenOptions::new().create(true).append(true).open(&path) {
        Ok(mut f) => {
            let _ = f.write_all(line.as_bytes());
        }
        Err(e) => {
            eprintln!("[session_log] open {} failed: {e}", path.display());
        }
    }
    // Feed the rag index so this turn is immediately recall-able. No-op
    // if the embedding model isn't loaded.
    crate::rag::index_turn(turn.ts, user_trim, asst_trim);
}

/// Read all turns for a specific date. Returns empty if no file exists or
/// the file is unreadable / malformed.
pub fn load_date(date: NaiveDate) -> Vec<Turn> {
    let Some(path) = file_for(date) else {
        return Vec::new();
    };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    text.lines()
        .filter_map(|line| serde_json::from_str::<Turn>(line.trim()).ok())
        .collect()
}

/// All dates that have a non-empty log file, oldest-first.
pub fn dates_with_logs() -> Vec<NaiveDate> {
    let Some(dir) = log_dir() else {
        return Vec::new();
    };
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut out: Vec<NaiveDate> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let stem = name.strip_suffix(".jsonl")?;
            NaiveDate::parse_from_str(stem, "%Y-%m-%d").ok()
        })
        .collect();
    out.sort();
    out
}

/// Delete a specific day's log file. Used by Settings "forget this day"
/// flow (Phase D). Returns true if a file was actually removed.
#[allow(dead_code)]
pub fn clear_date(date: NaiveDate) -> bool {
    let Some(path) = file_for(date) else {
        return false;
    };
    std::fs::remove_file(&path).is_ok()
}

/// Wipe all logs. Used by Settings "forget everything" flow.
#[allow(dead_code)]
pub fn clear_all() -> bool {
    let Some(dir) = log_dir() else {
        return false;
    };
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return false;
    };
    let mut ok = true;
    for e in entries.flatten() {
        if e.path().extension().and_then(|s| s.to_str()) == Some("jsonl") {
            if std::fs::remove_file(e.path()).is_err() {
                ok = false;
            }
        }
    }
    ok
}
