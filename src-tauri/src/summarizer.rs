// Daily summary layer (L2) for the long-term-memory stack.
//
// For each past day with a session log, we generate a short 3–5 line
// snapshot of "what the user was doing / how they sounded / what came
// up". The summary file lives at ~/.chappie/summaries/YYYY-MM-DD.json
// and is generated lazily — once per day per process, on the first
// chat_complete call where we have the user's API key to spend.
//
// The summaries are injected into the system prompt for the past 7 days
// so the LLM can naturally bring up "the meeting from yesterday" or
// "that thing you said earlier this week" without being mechanical.

use chrono::{Duration, Local, NaiveDate};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration as StdDuration;

use crate::provider::Provider;
use crate::session_log;

/// Once-per-process gate so we don't try to backfill summaries on every
/// chat_complete call. Reset only when the process restarts.
static ENSURED_THIS_SESSION: AtomicBool = AtomicBool::new(false);

/// In-flight guard so the very first two chat_complete calls of a
/// session don't both kick off the same backfill.
static BACKFILL_RUNNING: Lazy<Mutex<bool>> = Lazy::new(|| Mutex::new(false));

#[derive(Serialize, Deserialize, Clone)]
pub struct DailySummary {
    pub date: String, // YYYY-MM-DD
    pub text: String,
    pub generated_at_unix_ms: i64,
    pub turns_count: usize,
}

fn summaries_dir() -> Option<PathBuf> {
    let mut p = dirs::home_dir()?;
    p.push(".chappie");
    p.push("summaries");
    let _ = std::fs::create_dir_all(&p);
    Some(p)
}

fn summary_path(date: NaiveDate) -> Option<PathBuf> {
    let mut p = summaries_dir()?;
    p.push(format!("{}.json", date.format("%Y-%m-%d")));
    Some(p)
}

pub fn load_summary(date: NaiveDate) -> Option<DailySummary> {
    let path = summary_path(date)?;
    let bytes = std::fs::read(&path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn save_summary(s: &DailySummary) {
    let date = match NaiveDate::parse_from_str(&s.date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return,
    };
    let Some(path) = summary_path(date) else {
        return;
    };
    if let Ok(json) = serde_json::to_string_pretty(s) {
        let _ = std::fs::write(path, json);
    }
}

/// The `days` calendar dates immediately before `today`, newest-first
/// and excluding `today` itself (which is still in progress and is
/// already in the live conversation context). Split out so the
/// month/year rollback is testable without touching the filesystem.
fn past_dates(today: NaiveDate, days: i64) -> Vec<NaiveDate> {
    (1..=days.max(0))
        .map(|back| today - Duration::days(back))
        .collect()
}

/// Read the past `days` days of summaries (skipping today and skipping
/// dates without a summary). Returns oldest-first so the system prompt
/// reads chronologically.
pub fn recent_summaries(days: usize) -> Vec<DailySummary> {
    past_dates(Local::now().date_naive(), days as i64)
        .into_iter()
        .rev()
        .filter_map(load_summary)
        .collect()
}

/// Format the recent summaries as a single system-message body. Returns
/// an empty string when there's nothing to inject (no past summaries).
pub fn recent_summaries_prompt(days: usize) -> String {
    format_summaries_prompt(&recent_summaries(days))
}

/// Render summaries as a system-message body. Empty string when there
/// is nothing to inject, so callers can skip the message entirely.
fn format_summaries_prompt(entries: &[DailySummary]) -> String {
    if entries.is_empty() {
        return String::new();
    }
    let body = entries
        .iter()
        .map(|s| format!("【{}】\n{}", s.date, s.text.trim()))
        .collect::<Vec<_>>()
        .join("\n\n");
    format!(
        "過去 {} 日分の会話の要約（自然な流れで触れて良い。機械的に「昨日〜」と切り出さない）:\n\n{}",
        entries.len(),
        body
    )
}

/// Spawn a background task to generate any missing summaries for the
/// past 7 days. No-op if already run this session, if no API key, or if
/// a backfill is currently running. Safe to call from every
/// chat_complete entry point.
pub fn maybe_backfill(api_key: String) {
    if ENSURED_THIS_SESSION.load(Ordering::Relaxed) {
        return;
    }
    {
        let mut running = BACKFILL_RUNNING.lock().unwrap();
        if *running {
            return;
        }
        *running = true;
    }
    ENSURED_THIS_SESSION.store(true, Ordering::Relaxed);

    tauri::async_runtime::spawn(async move {
        let result = backfill_recent(&api_key, 7).await;
        if let Err(e) = result {
            eprintln!("[summarizer] backfill error: {e}");
        }
        *BACKFILL_RUNNING.lock().unwrap() = false;
    });
}

async fn backfill_recent(api_key: &str, days: i64) -> Result<(), String> {
    let provider = crate::provider::detect_from_key(api_key)
        .ok_or_else(|| "unknown api key provider".to_string())?;
    let model = std::env::var("CHAPPIE_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| provider.default_model().to_string());

    for date in past_dates(Local::now().date_naive(), days) {
        if load_summary(date).is_some() {
            continue;
        }
        let turns = session_log::load_date(date);
        if turns.is_empty() {
            continue;
        }
        eprintln!(
            "[summarizer] generating summary for {} ({} turns)",
            date,
            turns.len()
        );
        match generate_summary(provider, &model, api_key, &turns).await {
            Ok(text) => {
                save_summary(&DailySummary {
                    date: date.format("%Y-%m-%d").to_string(),
                    text,
                    generated_at_unix_ms: Local::now().timestamp_millis(),
                    turns_count: turns.len(),
                });
            }
            Err(e) => {
                eprintln!("[summarizer] {date} failed: {e}");
            }
        }
    }
    Ok(())
}

/// Cap on turns fed to one summary call, so a marathon day doesn't
/// blow up the token bill.
const MAX_TRANSCRIPT_TURNS: usize = 120;

/// Flatten a day's turns into the transcript block for the summary
/// prompt. Newlines inside a turn are collapsed to spaces so the
/// "User:" / "Assistant:" line structure stays unambiguous.
fn build_transcript(turns: &[session_log::Turn]) -> String {
    turns
        .iter()
        .take(MAX_TRANSCRIPT_TURNS)
        .map(|t| {
            format!(
                "User: {}\nAssistant: {}",
                t.user.replace('\n', " "),
                t.assistant.replace('\n', " ")
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

async fn generate_summary(
    provider: Provider,
    model: &str,
    api_key: &str,
    turns: &[session_log::Turn],
) -> Result<String, String> {
    let transcript = build_transcript(turns);

    let prompt = format!(
        "以下は1日分のユーザーとAIアシスタント（チャッピー）の会話ログです。\
         ユーザーが「どんな1日だったか・何を考えていたか・どんな話題が出たか」\
         が後日 自然に滲み出るように、3〜5行の短い日記風メモを書いてください。\
         事実だけでなく気分やトーンも拾ってください。\
         AIアシスタント側の発話は要約に含めず、ユーザーの言動だけにフォーカス。\
         箇条書きでなく散文で、ですます調でなくフラットな書き方で。\n\n\
         === 会話ログ ===\n{transcript}\n=== ここまで ===",
    );
    complete_oneshot(provider, model, api_key, &prompt, 400).await
}

static SHARED_HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(StdDuration::from_secs(60))
        .build()
        .expect("reqwest client")
});

/// One-shot non-streaming completion against any of the 3 providers.
/// Used by the L2 (summarizer) and L3 (topics) backfill paths — both
/// need to spend the user's API key on a short, off-the-critical-path
/// completion without setting up streaming / tools / multi-round logic.
pub async fn complete_oneshot(
    provider: Provider,
    model: &str,
    api_key: &str,
    prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    // anthropic requires explicit max_tokens; openai / gemini infer from model
    match provider {
        Provider::OpenAI => {
            let body = json!({
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": false,
            });
            let res = SHARED_HTTP
                .post(format!("{}/chat/completions", provider.base_url()))
                .bearer_auth(api_key)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("request: {e}"))?;
            if !res.status().is_success() {
                let s = res.status();
                let t = res.text().await.unwrap_or_default();
                return Err(format!("openai {s}: {t}"));
            }
            let v: Value = res.json().await.map_err(|e| format!("json: {e}"))?;
            v.pointer("/choices/0/message/content")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "openai: empty content".into())
        }
        Provider::Anthropic => {
            let body = json!({
                "model": model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            });
            let res = SHARED_HTTP
                .post(format!("{}/messages", provider.base_url()))
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("request: {e}"))?;
            if !res.status().is_success() {
                let s = res.status();
                let t = res.text().await.unwrap_or_default();
                return Err(format!("anthropic {s}: {t}"));
            }
            let v: Value = res.json().await.map_err(|e| format!("json: {e}"))?;
            v.pointer("/content/0/text")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "anthropic: empty content".into())
        }
        Provider::Gemini => {
            let url = format!(
                "{}/models/{}:generateContent?key={}",
                provider.base_url(),
                model,
                api_key
            );
            let body = json!({
                "contents": [{ "role": "user", "parts": [{ "text": prompt }] }],
            });
            let res = SHARED_HTTP
                .post(url)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("request: {e}"))?;
            if !res.status().is_success() {
                let s = res.status();
                let t = res.text().await.unwrap_or_default();
                return Err(format!("gemini {s}: {t}"));
            }
            let v: Value = res.json().await.map_err(|e| format!("json: {e}"))?;
            v.pointer("/candidates/0/content/parts/0/text")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "gemini: empty content".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).expect("valid date")
    }

    fn turn(user: &str, assistant: &str) -> session_log::Turn {
        session_log::Turn {
            ts: 0,
            user: user.to_string(),
            assistant: assistant.to_string(),
            provider: "openai".to_string(),
            model: "gpt-test".to_string(),
        }
    }

    fn summary(date: &str, text: &str) -> DailySummary {
        DailySummary {
            date: date.to_string(),
            text: text.to_string(),
            generated_at_unix_ms: 0,
            turns_count: 1,
        }
    }

    #[test]
    fn past_dates_excludes_today_and_runs_newest_first() {
        assert_eq!(
            past_dates(day(2026, 8, 24), 3),
            vec![day(2026, 8, 23), day(2026, 8, 22), day(2026, 8, 21)]
        );
    }

    #[test]
    fn past_dates_rolls_back_over_a_month_boundary() {
        assert_eq!(
            past_dates(day(2026, 3, 2), 3),
            vec![day(2026, 3, 1), day(2026, 2, 28), day(2026, 2, 27)]
        );
    }

    #[test]
    fn past_dates_rolls_back_into_a_leap_day_and_a_previous_year() {
        assert_eq!(past_dates(day(2024, 3, 1), 1), vec![day(2024, 2, 29)]);
        assert_eq!(
            past_dates(day(2026, 1, 1), 2),
            vec![day(2025, 12, 31), day(2025, 12, 30)]
        );
    }

    #[test]
    fn past_dates_is_empty_for_zero_or_negative_spans() {
        assert!(past_dates(day(2026, 8, 24), 0).is_empty());
        assert!(past_dates(day(2026, 8, 24), -5).is_empty());
    }

    #[test]
    fn build_transcript_collapses_newlines_inside_a_turn() {
        let t = build_transcript(&[turn("一行目\n二行目", "返事\nの続き")]);
        assert_eq!(t, "User: 一行目 二行目\nAssistant: 返事 の続き");
    }

    #[test]
    fn build_transcript_separates_turns_with_a_blank_line() {
        let t = build_transcript(&[turn("a", "b"), turn("c", "d")]);
        assert_eq!(t, "User: a\nAssistant: b\n\nUser: c\nAssistant: d");
    }

    #[test]
    fn build_transcript_caps_a_marathon_day() {
        let turns: Vec<_> = (0..MAX_TRANSCRIPT_TURNS + 40)
            .map(|i| turn(&format!("q{i}"), "a"))
            .collect();
        let t = build_transcript(&turns);
        assert_eq!(t.matches("User: ").count(), MAX_TRANSCRIPT_TURNS);
        assert!(t.contains(&format!("User: q{}", MAX_TRANSCRIPT_TURNS - 1)));
        assert!(!t.contains(&format!("User: q{MAX_TRANSCRIPT_TURNS}")));
    }

    #[test]
    fn build_transcript_of_no_turns_is_empty() {
        assert_eq!(build_transcript(&[]), "");
    }

    #[test]
    fn format_summaries_prompt_is_empty_without_entries() {
        assert_eq!(format_summaries_prompt(&[]), "");
    }

    #[test]
    fn format_summaries_prompt_counts_entries_and_trims_each_body() {
        let out = format_summaries_prompt(&[
            summary("2026-08-22", "  疲れていた  "),
            summary("2026-08-23", "\n機嫌が良かった\n"),
        ]);
        assert!(out.starts_with("過去 2 日分の会話の要約"));
        assert!(out.contains("【2026-08-22】\n疲れていた"));
        assert!(out.contains("【2026-08-23】\n機嫌が良かった"));
    }
}
