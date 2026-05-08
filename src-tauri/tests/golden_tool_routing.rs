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
//   claude-3-5-haiku ~$0.07 (90% cache discount), gemini-2.5-flash
//   ~$0 in the free tier.
// - Run via `pnpm test:golden` (root script) or
//   `cd src-tauri && cargo test --test golden_tool_routing -- --nocapture`.
// - CI does not run these by default; the assistant runs them on a
//   low-cadence basis at its discretion (typically before merging
//   tool-definition changes).
//
// What this DOES test:
// - First-round tool selection from a transcribed utterance.
// - Multi-round sequences (e.g. "音量下げて" → get_volume → set_volume)
//   by feeding the LLM stub tool results between rounds.
// - All three supported providers (OpenAI / Anthropic / Gemini),
//   exercised independently if their keys are present.
//
// What this does NOT test:
// - Tool execution side effects (we never call execute_tool, only
//   intercept the names the LLM intended to call).
// - Param value correctness — only structural presence is checked.
// - Conversation flow / TTS / UI.

use chappie_lib::openai::all_tools;
use serde_json::{json, Value};
use std::time::Duration;

const PERSONA_JA: &str =
    "あなたはチャッピー、ハンズフリー音声アシスタントです。返答は読み上げられるので、短く自然な会話調の日本語で答えてください。";

#[derive(Debug, Clone)]
struct Case {
    label: &'static str,
    utterance: &'static str,
    /// Tool names expected to be called, in order across rounds.
    /// `&[]` means the LLM should respond without calling any tool.
    /// One alternative tool name per slot is allowed via `|` (e.g.
    /// "get_now_playing|control_music") to absorb mild LLM disagreement
    /// where multiple readings of the utterance are reasonable.
    expected: &'static [&'static str],
}

const CASES: &[Case] = &[
    // Single-round, single-tool ----------------------------------------
    Case { label: "time/now", utterance: "今何時?", expected: &["get_current_time"] },
    Case { label: "timer/set", utterance: "3分タイマー", expected: &["set_timer"] },
    Case { label: "timer/cancel", utterance: "タイマー全部キャンセル", expected: &["cancel_timer"] },
    Case { label: "timer/list", utterance: "今動いてるタイマー教えて", expected: &["list_timers"] },
    Case { label: "weather/local", utterance: "天気どう?", expected: &["get_weather"] },
    Case { label: "weather/named", utterance: "東京の天気は?", expected: &["get_weather"] },
    Case { label: "calendar/today", utterance: "今日の予定は?", expected: &["list_events"] },
    Case { label: "calendar/tomorrow", utterance: "明日のスケジュール教えて", expected: &["list_events"] },
    Case { label: "music/now", utterance: "いま何の曲?", expected: &["get_now_playing"] },
    Case { label: "music/next", utterance: "次の曲", expected: &["control_music"] },
    Case { label: "music/pause", utterance: "ちょっと止めて", expected: &["control_music"] },
    Case { label: "battery", utterance: "バッテリー何%?", expected: &["get_battery_status"] },
    Case { label: "clipboard/read", utterance: "クリップボード読んで", expected: &["read_clipboard"] },
    Case { label: "screenshot", utterance: "スクショ撮って", expected: &["take_screenshot"] },
    Case { label: "lock", utterance: "画面ロックして", expected: &["lock_screen"] },
    Case { label: "capabilities", utterance: "何ができるの?", expected: &["list_capabilities"] },
    Case { label: "open_app", utterance: "Slack 開いて", expected: &["open_app"] },
    Case { label: "open_finder", utterance: "ダウンロードフォルダ開いて", expected: &["open_finder"] },
    Case { label: "web_search", utterance: "ラーメンの作り方ググって", expected: &["web_search"] },
    Case { label: "open_url", utterance: "YouTube 開いて", expected: &["open_app|open_url"] },
    Case { label: "note/add", utterance: "これメモして: 駐車場B3", expected: &["add_note"] },
    Case { label: "note/list", utterance: "最近のメモ読んで", expected: &["list_notes"] },
    Case { label: "volume/absolute", utterance: "音量30にして", expected: &["set_volume"] },
    Case { label: "mute", utterance: "ミュート", expected: &["set_mute"] },
    Case { label: "end", utterance: "ありがとう、またね", expected: &["end_conversation"] },

    // Multi-round (depends on stubbed tool results) --------------------
    Case {
        label: "volume/relative",
        utterance: "音量もう少し下げて",
        expected: &["get_volume", "set_volume"],
    },
    Case {
        label: "reminder/relative-date",
        utterance: "明日の朝7時に起こして",
        expected: &["get_current_time", "add_reminder_at"],
    },
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
            "model": "claude-3-5-haiku-latest",
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

fn matches_expected(actual: &[String], expected: &[&str]) -> bool {
    if actual.len() < expected.len() {
        return false;
    }
    // We allow the LLM to call extra tools beyond the expected sequence
    // (some providers chain a get_current_time before list_events even
    // when the simpler answer suffices). Require the expected sequence
    // appears as a prefix of the actual, allowing alternatives via "|".
    for (i, want) in expected.iter().enumerate() {
        let alts: Vec<&str> = want.split('|').collect();
        let got = &actual[i];
        if !alts.iter().any(|a| a == got) {
            return false;
        }
    }
    true
}

async fn run_provider(
    provider: &Provider,
    key: &str,
    case: &Case,
) -> Result<Vec<String>, String> {
    let client = http();
    let max_rounds = case.expected.len().max(1) + 1;
    match provider {
        Provider::OpenAI => run_openai(&client, key, case.utterance, max_rounds).await,
        Provider::Anthropic => run_anthropic(&client, key, case.utterance, max_rounds).await,
        Provider::Gemini => run_gemini(&client, key, case.utterance, max_rounds).await,
    }
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

    let mut total_failures: Vec<String> = Vec::new();
    for (provider, key) in &providers {
        eprintln!("[golden] === {} ===", provider.label());
        let mut failures = 0usize;
        for case in CASES {
            match run_provider(provider, key, case).await {
                Ok(actual) => {
                    if matches_expected(&actual, case.expected) {
                        eprintln!("[golden]  ✓ {} -> {:?}", case.label, actual);
                    } else {
                        failures += 1;
                        let line = format!(
                            "[{}/{}] expected {:?}, got {:?}",
                            provider.label(),
                            case.label,
                            case.expected,
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
