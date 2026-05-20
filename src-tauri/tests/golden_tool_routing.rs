// Golden tests for LLM tool routing.
//
// Given a transcribed user utterance, assert which tool(s) the LLM
// chooses to call. Acts as a regression net for changes that can
// silently degrade tool selection — most notably tool description
// edits (compression, rewording) and prompt structure changes.
//
// These tests hit real LLM providers, so:
// - They are skipped by default when no provider key is in the env.
// - Each enabled provider runs the suite once: ~25 LLM calls + a few
//   stubbed multi-round follow-ups. Cost per full 3-provider sweep is
//   ~$0.10–0.15 on today's pricing with caching: gpt-4o-mini ~$0.03,
//   claude-haiku-4-5 ~$0.07 (90% cache discount), gemini-2.5-flash
//   ~$0 in the free tier.
// - Run via `pnpm test:golden` (root script) or
//   `cd src-tauri && cargo test --test golden_tool_routing -- --nocapture`.
// - CI does not run these by default; the assistant runs them on a
//   low-cadence basis at its discretion (typically before merging
//   tool-definition changes).
//
// What this DOES test:
// - First-round tool selection from a transcribed utterance — i.e. did
//   the LLM pick the right tool for the user's intent. This is the
//   value we want to lock down: tool description / system prompt
//   changes that silently degrade routing fail loudly here.
// - All three supported providers (OpenAI / Anthropic / Gemini),
//   exercised independently if their keys are present. Cases run in
//   parallel within a provider (4 concurrent) to keep wall-clock low.
//
// What this does NOT test:
// - Multi-round tool chaining behaviour. Providers (especially Gemini)
//   sometimes reply with text between tool calls instead of chaining,
//   which is a separate UX concern from "did routing land on the
//   right first tool". The runner stubs additional rounds for cases
//   that need them, but only the first tool name is asserted.
// - Tool execution side effects (we never call execute_tool, only
//   intercept the names the LLM intended to call).
// - Param value correctness — only structural presence is checked.
// - Conversation flow / TTS / UI.

use chappie_lib::tools::all_tools;
use futures_util::stream::{self, StreamExt};
use serde_json::{json, Value};
use std::time::Duration;

/// Concurrent in-flight requests per provider. Trade-off: too few wastes
/// wall-clock; too many trips rate limits.
/// Anthropic's default tier is 50k input tokens/min — 27 cases × ~9k tokens
/// of system+tools sails past that with any meaningful concurrency, so it
/// runs sequentially. OpenAI / Gemini are comfortable at 4.
const CONCURRENCY_DEFAULT: usize = 4;
const CONCURRENCY_ANTHROPIC: usize = 1;

const PERSONA_JA: &str =
    "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。";

#[derive(Debug, Clone)]
struct Case {
    label: &'static str,
    utterance: &'static str,
    /// Expected first tool name. `""` means the LLM should respond
    /// without any tool. Alternatives separated by `|` are allowed
    /// (e.g. "get_now_playing|control_music") to absorb mild LLM
    /// disagreement where multiple readings of the utterance are
    /// reasonable. Only the first tool the LLM picks is asserted —
    /// subsequent tool chaining varies by provider and isn't part of
    /// what we're locking down here.
    expected_first: &'static str,
}

const CASES: &[Case] = &[
    Case { label: "time/now", utterance: "今何時?", expected_first: "get_current_time" },
    Case { label: "timer/set", utterance: "3分タイマー", expected_first: "set_timer" },
    Case { label: "timer/cancel", utterance: "タイマー全部キャンセル", expected_first: "cancel_timer" },
    Case { label: "timer/list", utterance: "今動いてるタイマー教えて", expected_first: "list_timers" },
    Case { label: "weather/local", utterance: "天気どう?", expected_first: "get_weather" },
    Case { label: "weather/named", utterance: "東京の天気は?", expected_first: "get_weather" },
    Case { label: "calendar/today", utterance: "今日の予定は?", expected_first: "list_events" },
    Case { label: "calendar/tomorrow", utterance: "明日のスケジュール教えて", expected_first: "list_events" },
    Case { label: "music/now", utterance: "いま何の曲?", expected_first: "get_now_playing" },
    Case { label: "music/next", utterance: "次の曲", expected_first: "control_music" },
    Case { label: "music/pause", utterance: "音楽ちょっと止めて", expected_first: "control_music" },
    Case { label: "battery", utterance: "バッテリー何%?", expected_first: "get_battery_status" },
    Case { label: "clipboard/read", utterance: "クリップボード読んで", expected_first: "read_clipboard" },
    Case { label: "screenshot", utterance: "スクショ撮って", expected_first: "take_screenshot" },
    Case { label: "lock", utterance: "画面ロックして", expected_first: "lock_screen" },
    Case { label: "capabilities", utterance: "何ができるの?", expected_first: "list_capabilities" },
    Case { label: "open_app", utterance: "Slack 開いて", expected_first: "open_app" },
    Case { label: "open_finder", utterance: "ダウンロードフォルダ開いて", expected_first: "open_finder" },
    Case { label: "web_search", utterance: "ラーメンの作り方ググって", expected_first: "web_search" },
    Case { label: "open_url", utterance: "YouTube 開いて", expected_first: "open_app|open_url" },
    Case { label: "youtube/play", utterance: "YouTube で猫の動画流して", expected_first: "open_youtube" },
    // Niche / Japanese channel the LLM almost certainly doesn't have
    // real video IDs for — must still pick open_youtube (so Rust's
    // search fallback can kick in), NOT web_search / open_url. Locks
    // down the tool description against future "if you don't know the
    // ID, use a different tool" rewrites.
    Case { label: "youtube/niche", utterance: "オモコロチャンネルの動画再生して", expected_first: "open_youtube" },
    Case { label: "youtube/close", utterance: "YouTube 閉じて", expected_first: "close_youtube" },
    Case { label: "note/add", utterance: "これメモして: 駐車場B3", expected_first: "add_note" },
    Case { label: "note/list", utterance: "最近のメモ読んで", expected_first: "list_notes" },
    // OpenAI sometimes does a defensive read-modify-write here even when an
    // explicit value is given; allow either as the first call.
    Case { label: "volume/absolute", utterance: "音量30にして", expected_first: "get_volume|set_volume" },
    Case { label: "mute", utterance: "ミュート", expected_first: "set_mute" },
    Case { label: "end", utterance: "ありがとう、またね", expected_first: "end_conversation" },
    // MCP-contributed tools. Routed via the same registry as native tools;
    // these cases lock down that the `mcp_*` namespace and descriptions
    // surface cleanly to all 3 providers.
    Case { label: "mcp/news", utterance: "最新ニュース教えて", expected_first: "mcp_news_latest" },
    Case { label: "mcp/wiki", utterance: "アインシュタインって誰?", expected_first: "mcp_wiki_summary" },
    Case { label: "mcp/quake", utterance: "最近の地震は?", expected_first: "mcp_quake_recent" },
    Case { label: "mcp/fx", utterance: "ドル円いくら?", expected_first: "mcp_fx_rate" },
    Case { label: "mcp/astro", utterance: "今日の日の入り何時?", expected_first: "mcp_astro_sunmoon" },
    Case { label: "mcp/fetch", utterance: "https://example.com 読んで", expected_first: "mcp_fetch_readable" },
    // "今日は何の日?" must route to onthisday, NOT get_current_time (both
    // mention 今日); "今日の空気どう?" must route to air-quality, NOT
    // get_weather (both are ambient-condition questions about 今日).
    Case { label: "mcp/onthisday", utterance: "今日は何の日?", expected_first: "mcp_wiki_onthisday" },
    Case { label: "mcp/airquality", utterance: "今日の空気どう?", expected_first: "mcp_airquality_current" },
    // Relative-volume / relative-date utterances kick off a multi-round
    // sequence in production (get_volume → set_volume; get_current_time
    // → add_reminder_at). We only assert the FIRST tool here because
    // chaining behaviour varies by provider and isn't what this test is
    // for. The runner still stubs follow-up rounds so the LLM has a
    // chance to chain naturally.
    Case { label: "volume/relative", utterance: "音量もう少し下げて", expected_first: "get_volume" },
    Case { label: "reminder/relative-date", utterance: "明日の朝7時に起こして", expected_first: "get_current_time" },
];

// ---------------------------------------------------------------- runner

#[derive(Debug)]
enum Provider {
    OpenAI,
    Anthropic,
    Gemini,
}

impl Provider {
    fn from_env() -> Vec<(Self, String)> {
        let mut out = Vec::new();
        if let Ok(k) = std::env::var("OPENAI_API_KEY") {
            if !k.trim().is_empty() {
                out.push((Provider::OpenAI, k));
            }
        }
        if let Ok(k) = std::env::var("ANTHROPIC_API_KEY") {
            if !k.trim().is_empty() {
                out.push((Provider::Anthropic, k));
            }
        }
        if let Ok(k) = std::env::var("GEMINI_API_KEY") {
            if !k.trim().is_empty() {
                out.push((Provider::Gemini, k));
            }
        }
        out
    }

    fn label(&self) -> &'static str {
        match self {
            Provider::OpenAI => "OpenAI",
            Provider::Anthropic => "Anthropic",
            Provider::Gemini => "Gemini",
        }
    }
}

fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .expect("http client")
}

/// Stub result for non-marker tools. Synthesized so the LLM has plausible
/// JSON to react to in the next round, without us actually changing
/// system state. Marker tools (end_conversation) aren't reached because
/// the test stops once the expected sequence is satisfied.
fn stub_tool_result(name: &str) -> Value {
    match name {
        "get_volume" => json!({ "level": 50, "muted": false }),
        "get_current_time" => json!({ "time": "2026-05-09 14:30", "weekday": "土" }),
        "get_weather" => json!({ "temp": 18.0, "summary": "晴れ" }),
        "list_events" => json!({ "events": [] }),
        "list_timers" => json!({ "timers": [] }),
        "list_notes" => json!({ "notes": [] }),
        "list_reminders" => json!({ "reminders": [] }),
        "get_battery_status" => json!({ "percent": 80, "charging": false }),
        "get_now_playing" => json!({ "title": "Sample", "artist": "Test" }),
        "get_sleep_prevention" => json!({ "enabled": false }),
        "read_clipboard" => json!({ "text": "" }),
        "mcp_news_latest" => json!({ "items": [] }),
        "mcp_wiki_summary" => json!({ "title": "stub", "extract": "stub" }),
        "mcp_quake_recent" => json!({ "items": [] }),
        "mcp_fx_rate" => json!({ "base": "USD", "quote": "JPY", "rate": 150.0 }),
        "mcp_astro_sunmoon" => json!({ "sunrise": "05:00", "sunset": "18:00", "moon_phase_label": "満月" }),
        "mcp_fetch_readable" => json!({ "title": "stub", "text": "stub" }),
        _ => json!({ "ok": true }),
    }
}

// ---------------------------------------------------------------- providers

async fn run_openai(
    client: &reqwest::Client,
    api_key: &str,
    utterance: &str,
    max_rounds: usize,
) -> Result<Vec<String>, String> {
    let mut messages: Vec<Value> = vec![
        json!({ "role": "system", "content": PERSONA_JA }),
        json!({ "role": "user", "content": utterance }),
    ];
    let mut called: Vec<String> = Vec::new();

    for _ in 0..max_rounds {
        let body = json!({
            "model": "gpt-4o-mini",
            "messages": messages,
            "tools": all_tools(),
            "tool_choice": "auto",
            "temperature": 0,
        });
        let resp = client
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("send: {e}"))?;
        let status = resp.status();
        let v: Value = resp.json().await.map_err(|e| format!("json: {e}"))?;
        if !status.is_success() {
            return Err(format!("openai {}: {}", status, v));
        }
        let msg = &v["choices"][0]["message"];
        let tool_calls = msg.get("tool_calls").and_then(|t| t.as_array()).cloned();
        if let Some(calls) = tool_calls {
            // Push the assistant turn (carrying the tool_calls) then stub
            // each response.
            messages.push(json!({
                "role": "assistant",
                "content": msg.get("content").cloned().unwrap_or(Value::Null),
                "tool_calls": calls,
            }));
            for c in calls {
                let name = c["function"]["name"].as_str().unwrap_or("").to_string();
                let id = c["id"].as_str().unwrap_or("").to_string();
                called.push(name.clone());
                messages.push(json!({
                    "role": "tool",
                    "tool_call_id": id,
                    "content": stub_tool_result(&name).to_string(),
                }));
            }
        } else {
            // Final text response — stop.
            break;
        }
    }
    Ok(called)
}

async fn run_anthropic(
    client: &reqwest::Client,
    api_key: &str,
    utterance: &str,
    max_rounds: usize,
) -> Result<Vec<String>, String> {
    fn translate_tools(openai_tools: &Value) -> Value {
        let arr: Vec<Value> = openai_tools
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| {
                        let f = t.get("function")?;
                        Some(json!({
                            "name": f.get("name")?.clone(),
                            "description": f.get("description").cloned().unwrap_or(Value::Null),
                            "input_schema": f
                                .get("parameters")
                                .cloned()
                                .unwrap_or(json!({"type": "object"})),
                        }))
                    })
                    .collect()
            })
            .unwrap_or_default();
        Value::Array(arr)
    }

    let tools = translate_tools(&all_tools());
    let mut messages: Vec<Value> = vec![json!({ "role": "user", "content": utterance })];
    let mut called: Vec<String> = Vec::new();

    for _ in 0..max_rounds {
        let body = json!({
            "model": "claude-haiku-4-5",
            "max_tokens": 1024,
            "system": PERSONA_JA,
            "messages": messages,
            "tools": tools,
            "temperature": 0,
        });
        let resp = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("send: {e}"))?;
        let status = resp.status();
        let v: Value = resp.json().await.map_err(|e| format!("json: {e}"))?;
        if !status.is_success() {
            return Err(format!("anthropic {}: {}", status, v));
        }
        let content = v.get("content").and_then(|c| c.as_array()).cloned().unwrap_or_default();
        let mut tool_uses: Vec<(String, String, Value)> = Vec::new();
        for block in &content {
            if block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                let id = block.get("id").and_then(|s| s.as_str()).unwrap_or("").to_string();
                let name = block.get("name").and_then(|s| s.as_str()).unwrap_or("").to_string();
                let input = block.get("input").cloned().unwrap_or(json!({}));
                tool_uses.push((id, name, input));
            }
        }
        if tool_uses.is_empty() {
            break;
        }
        messages.push(json!({ "role": "assistant", "content": content }));
        let mut result_blocks: Vec<Value> = Vec::new();
        for (id, name, _input) in tool_uses {
            called.push(name.clone());
            result_blocks.push(json!({
                "type": "tool_result",
                "tool_use_id": id,
                "content": stub_tool_result(&name).to_string(),
            }));
        }
        messages.push(json!({ "role": "user", "content": result_blocks }));
    }
    Ok(called)
}

async fn run_gemini(
    client: &reqwest::Client,
    api_key: &str,
    utterance: &str,
    max_rounds: usize,
) -> Result<Vec<String>, String> {
    fn sanitize_schema(value: &mut Value) {
        match value {
            Value::Object(map) => {
                map.remove("additionalProperties");
                map.remove("$schema");
                for (_, v) in map.iter_mut() {
                    sanitize_schema(v);
                }
            }
            Value::Array(arr) => {
                for v in arr.iter_mut() {
                    sanitize_schema(v);
                }
            }
            _ => {}
        }
    }
    fn translate_tools(openai_tools: &Value) -> Value {
        let mut decls: Vec<Value> = openai_tools
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| {
                        let f = t.get("function")?;
                        let mut params = f.get("parameters").cloned().unwrap_or(json!({"type": "object"}));
                        sanitize_schema(&mut params);
                        Some(json!({
                            "name": f.get("name")?.clone(),
                            "description": f.get("description").cloned().unwrap_or(Value::Null),
                            "parameters": params,
                        }))
                    })
                    .collect()
            })
            .unwrap_or_default();
        let _ = &mut decls;
        json!([{ "function_declarations": decls }])
    }

    let tools = translate_tools(&all_tools());
    let mut contents: Vec<Value> =
        vec![json!({ "role": "user", "parts": [{ "text": utterance }] })];
    let mut called: Vec<String> = Vec::new();

    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        urlencoding::encode(api_key)
    );

    for _ in 0..max_rounds {
        let body = json!({
            "system_instruction": { "parts": [{ "text": PERSONA_JA }] },
            "contents": contents,
            "tools": tools,
            "tool_config": { "function_calling_config": { "mode": "AUTO" } },
            "generationConfig": {
                "thinkingConfig": { "thinkingBudget": 0 },
                "temperature": 0
            },
        });
        let resp = client
            .post(&endpoint)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("send: {e}"))?;
        let status = resp.status();
        let v: Value = resp.json().await.map_err(|e| format!("json: {e}"))?;
        if !status.is_success() {
            return Err(format!("gemini {}: {}", status, v));
        }
        let parts = v["candidates"][0]["content"]["parts"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let mut function_calls: Vec<(String, Value)> = Vec::new();
        for p in &parts {
            if let Some(fc) = p.get("functionCall") {
                let name = fc.get("name").and_then(|s| s.as_str()).unwrap_or("").to_string();
                let args = fc.get("args").cloned().unwrap_or(json!({}));
                function_calls.push((name, args));
            }
        }
        if function_calls.is_empty() {
            break;
        }
        // Append the model turn (parts as-is).
        contents.push(json!({ "role": "model", "parts": parts }));
        let mut response_parts: Vec<Value> = Vec::new();
        for (name, _args) in function_calls {
            called.push(name.clone());
            response_parts.push(json!({
                "functionResponse": {
                    "name": name.clone(),
                    "response": stub_tool_result(&name),
                },
            }));
        }
        contents.push(json!({ "role": "user", "parts": response_parts }));
    }
    Ok(called)
}

fn matches_expected(actual: &[String], expected_first: &str) -> bool {
    // expected_first == "" means "no tool should be called".
    if expected_first.is_empty() {
        return actual.is_empty();
    }
    let Some(got) = actual.first() else {
        return false;
    };
    let alts: Vec<&str> = expected_first.split('|').collect();
    alts.iter().any(|a| a == got)
}

async fn run_one(
    client: &reqwest::Client,
    provider: &Provider,
    key: &str,
    case: &Case,
) -> Result<Vec<String>, String> {
    // 3 rounds is enough for any case in the suite — the longest natural
    // chain is 2 (get_volume → set_volume / get_current_time →
    // add_reminder_at) and we only need one extra in case the LLM emits
    // a redundant probe before settling.
    let max_rounds = 3;
    let r = match provider {
        Provider::OpenAI => run_openai(client, key, case.utterance, max_rounds).await,
        Provider::Anthropic => run_anthropic(client, key, case.utterance, max_rounds).await,
        Provider::Gemini => run_gemini(client, key, case.utterance, max_rounds).await,
    };
    // Anthropic default tier is 50k input tokens/min; each case is ~9k
    // tokens AND multi-round cases fire 2-3 requests back-to-back from
    // a single case. 30s buffers the rolling window enough to absorb
    // multi-round bursts without 429.
    if matches!(provider, Provider::Anthropic) {
        tokio::time::sleep(Duration::from_secs(30)).await;
    }
    r
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn golden_tool_routing() {
    let providers = Provider::from_env();
    if providers.is_empty() {
        eprintln!(
            "[golden] skipped: set OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY to run"
        );
        return;
    }

    // Optional case filter: comma-separated substrings, matched against
    // case.label. Useful for retrying just the cases that failed in a
    // previous run without burning the whole suite (and rate limit budget).
    let only_filter = std::env::var("GOLDEN_ONLY").ok();
    let case_indices: Vec<usize> = match &only_filter {
        Some(s) => {
            let needles: Vec<&str> = s.split(',').map(|x| x.trim()).filter(|x| !x.is_empty()).collect();
            CASES
                .iter()
                .enumerate()
                .filter(|(_, c)| needles.iter().any(|n| c.label.contains(n)))
                .map(|(i, _)| i)
                .collect()
        }
        None => (0..CASES.len()).collect(),
    };
    if let Some(s) = &only_filter {
        eprintln!(
            "[golden] GOLDEN_ONLY={s:?} → running {} of {} cases",
            case_indices.len(),
            CASES.len()
        );
    }

    let mut total_failures: Vec<String> = Vec::new();
    let client = http();
    for (provider, key) in &providers {
        eprintln!("[golden] === {} ===", provider.label());

        let concurrency = match provider {
            Provider::Anthropic => CONCURRENCY_ANTHROPIC,
            _ => CONCURRENCY_DEFAULT,
        };

        // Run cases concurrently within the provider. Concurrency caps
        // in-flight requests to avoid tripping rate limits while
        // keeping wall-clock low.
        let results: Vec<(usize, Result<Vec<String>, String>)> =
            stream::iter(case_indices.iter().copied().map(|i| (i, &CASES[i])))
                .map(|(i, case)| {
                    let client = &client;
                    async move {
                        let r = run_one(client, provider, key, case).await;
                        (i, r)
                    }
                })
                .buffer_unordered(concurrency)
                .collect()
                .await;

        // Re-sort into definition order so the report is stable across runs.
        let mut sorted = results;
        sorted.sort_by_key(|(i, _)| *i);

        let mut failures = 0usize;
        for (i, r) in sorted {
            let case = &CASES[i];
            match r {
                Ok(actual) => {
                    if matches_expected(&actual, case.expected_first) {
                        eprintln!("[golden]  ✓ {} -> {:?}", case.label, actual);
                    } else {
                        failures += 1;
                        let line = format!(
                            "[{}/{}] expected first={:?}, got {:?}",
                            provider.label(),
                            case.label,
                            case.expected_first,
                            actual
                        );
                        eprintln!("[golden]  ✗ {}", line);
                        total_failures.push(line);
                    }
                }
                Err(e) => {
                    failures += 1;
                    let line = format!("[{}/{}] error: {}", provider.label(), case.label, e);
                    eprintln!("[golden]  ✗ {}", line);
                    total_failures.push(line);
                }
            }
        }
        eprintln!(
            "[golden] {} summary: {} pass / {} fail",
            provider.label(),
            CASES.len() - failures,
            failures
        );
    }

    assert!(
        total_failures.is_empty(),
        "{} golden case(s) failed:\n  {}",
        total_failures.len(),
        total_failures.join("\n  ")
    );
}
