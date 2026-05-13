// L3 of the long-term memory stack: longitudinal topic / preference
// extraction.
//
// Walks the past ~30 days of daily summaries and asks the LLM to pull
// out 5–10 recurring topics or preferences ("often talks about ramen",
// "weekend programmer", "anxious about work deadlines"). The result is
// persisted to `~/.chappie/topics.json` and injected as a short system
// message every chat turn so the model can naturally personalize
// without doing recall-style retrieval.
//
// Distinction from the other memory layers:
//   - memory.json (Profile/Preference): user-saved durable facts via
//     `save_memory`. Sparse, high precision, expensive to populate.
//   - L2 daily summaries: a per-day diary. Dense, captures temporal
//     drift, but each entry is "what happened today" — no across-day
//     pattern mining.
//   - L3 topics (this module): cross-day patterns extracted from L2.
//     Bounded size, always-on in the prompt, cheap to refresh.
//
// Refresh cadence is once-per-process AND only when the topics file is
// older than 7 days. That gives the trend layer time to update as new
// daily summaries roll in, without spamming the user's API key.

use chrono::Local;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use crate::provider::Provider;
use crate::summarizer;

const REFRESH_AFTER_DAYS: i64 = 7;
const SUMMARY_LOOKBACK_DAYS: usize = 30;

static ENSURED_THIS_SESSION: AtomicBool = AtomicBool::new(false);
static REFRESH_RUNNING: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

#[derive(Serialize, Deserialize, Clone)]
pub struct Topics {
    pub updated_at_unix_ms: i64,
    /// Plain bullet list; the LLM writes one short topic / preference
    /// per line. We don't try to schemify (no per-topic "evidence_dates"
    /// or scores) — extra structure tends to make the LLM rigid and
    /// the downstream prompt injection only needs a flat list.
    pub bullets: Vec<String>,
}

fn store_path() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    let _ = std::fs::create_dir_all(&p);
    p.push("topics.json");
    Some(p)
}

pub fn load() -> Option<Topics> {
    let path = store_path()?;
    let bytes = std::fs::read(&path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn save(t: &Topics) {
    let Some(path) = store_path() else { return };
    if let Ok(json) = serde_json::to_string_pretty(t) {
        let _ = std::fs::write(path, json);
    }
}

/// Format the topics as a single system-message body. Returns empty
/// string when no topics file exists (first install, no summary
/// backlog yet).
pub fn prompt_section() -> String {
    let Some(t) = load() else {
        return String::new();
    };
    if t.bullets.is_empty() {
        return String::new();
    }
    let body = t
        .bullets
        .iter()
        .map(|b| format!("- {}", b.trim_start_matches(['-', '・', ' ']).trim()))
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "ユーザーの長期トピック / 嗜好（過去 {} 日のサマリから抽出。自然な流れで活かす）:\n{}",
        SUMMARY_LOOKBACK_DAYS, body
    )
}

/// Background-refresh entry point. Mirrors summarizer::maybe_backfill —
/// gated by a once-per-process flag, a no-double-run mutex, and a
/// minimum age threshold on the existing topics file.
pub fn maybe_refresh(api_key: String) {
    if ENSURED_THIS_SESSION.load(Ordering::Relaxed) {
        return;
    }
    // Skip if the existing topics file is still fresh.
    if let Some(existing) = load() {
        let age_ms = Local::now().timestamp_millis() - existing.updated_at_unix_ms;
        let age_days = age_ms / 86_400_000;
        if age_days < REFRESH_AFTER_DAYS && !existing.bullets.is_empty() {
            ENSURED_THIS_SESSION.store(true, Ordering::Relaxed);
            return;
        }
    }
    {
        let mut running = REFRESH_RUNNING.lock().unwrap();
        if *running {
            return;
        }
        *running = true;
    }
    ENSURED_THIS_SESSION.store(true, Ordering::Relaxed);

    tauri::async_runtime::spawn(async move {
        let result = refresh(&api_key).await;
        if let Err(e) = result {
            eprintln!("[topics] refresh error: {e}");
        }
        *REFRESH_RUNNING.lock().unwrap() = false;
    });
}

async fn refresh(api_key: &str) -> Result<(), String> {
    let provider = crate::provider::detect_from_key(api_key)
        .ok_or_else(|| "unknown api key provider".to_string())?;
    let model = std::env::var("CHAPPIE_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| provider.default_model().to_string());

    let summaries = summarizer::recent_summaries(SUMMARY_LOOKBACK_DAYS);
    // Need at least a few summary days before topics are meaningful —
    // a one-day pattern is just noise.
    if summaries.len() < 3 {
        eprintln!(
            "[topics] only {} days of summaries — skipping (need 3+)",
            summaries.len()
        );
        return Ok(());
    }

    let joined = summaries
        .iter()
        .map(|s| format!("【{}】\n{}", s.date, s.text.trim()))
        .collect::<Vec<_>>()
        .join("\n\n");

    let prompt = format!(
        "以下はユーザーの過去 {n_days} 日分の会話の日次サマリです。\
         このユーザーを中長期的に特徴づける「繰り返し出てくる話題・嗜好・関心・状況」\
         を 5〜10 個、短い箇条書きで抽出してください。\n\n\
         ルール:\n\
         - 1日だけ出てきた一過性の話題は除外。\
         - 行動・関心・性格・生活パターンなど何でも OK。\
         - 1 項目 1 行、20〜40 文字程度。日本語で。\
         - 「〜が好き」「〜の傾向」「〜について話すことが多い」のような言い回し。\
         - 番号や記号を行頭に付けない（生の文だけ）。\
         - 該当する特徴が無ければ空のまま返してよい。\n\n\
         === 過去 {actual} 日分のサマリ ===\n{joined}\n=== ここまで ===",
        n_days = SUMMARY_LOOKBACK_DAYS,
        actual = summaries.len(),
    );

    let text = summarizer::complete_oneshot(provider, &model, api_key, &prompt, 600).await?;
    let bullets: Vec<String> = text
        .lines()
        .map(|l| l.trim().trim_start_matches(['-', '・', '*', '•', ' ']).trim().to_string())
        .filter(|l| !l.is_empty())
        .take(15)
        .collect();
    if bullets.is_empty() {
        eprintln!("[topics] LLM returned no usable bullets");
        return Ok(());
    }

    save(&Topics {
        updated_at_unix_ms: Local::now().timestamp_millis(),
        bullets,
    });
    eprintln!("[topics] refreshed: {} bullets", load().map(|t| t.bullets.len()).unwrap_or(0));
    Ok(())
}

#[allow(dead_code)]
pub fn forget() -> bool {
    let Some(path) = store_path() else {
        return false;
    };
    std::fs::remove_file(&path).is_ok()
}
