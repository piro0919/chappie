// OpenAI Chat Completions invoked from Rust so the API key never lives in
// the renderer process. The renderer passes the user-entered key from the
// Tauri store and we forward it as a Bearer token. The reqwest::Client is
// reused across calls to amortize TLS + connection setup.
//
// Streaming: the renderer hands us a `Channel<String>`; each text delta is
// pushed over the channel as soon as it arrives so the renderer can begin
// TTS on partial output. Tool calls are buffered (not streamed downstream)
// because they are executed locally before the model continues; the next
// round's text, however, streams again.

use futures_util::StreamExt;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::ipc::Channel;

static HTTP: Lazy<reqwest::Client> =
    Lazy::new(|| crate::http::build_client(Some(120), None));

const MAX_TOOL_ROUNDS: usize = 5;

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChatResult {
    pub text: String,
    pub end_conversation: bool,
    /// Names of tools the LLM called during this turn, in the order they
    /// were invoked (across all rounds). Used by the golden tool-routing
    /// test to verify tool selection stability; renderer ignores it.
    #[serde(default)]
    pub tool_calls: Vec<String>,
}

#[derive(Deserialize, Default)]
struct StreamDelta {
    content: Option<String>,
    tool_calls: Option<Vec<ToolCallDelta>>,
}

#[derive(Deserialize)]
struct ToolCallDelta {
    index: u32,
    id: Option<String>,
    function: Option<ToolFunctionDelta>,
}

#[derive(Deserialize)]
struct ToolFunctionDelta {
    name: Option<String>,
    arguments: Option<String>,
}

#[derive(Deserialize)]
struct StreamChoice {
    delta: StreamDelta,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct StreamChunk {
    choices: Vec<StreamChoice>,
    #[serde(default)]
    usage: Option<Value>,
}

#[derive(Default, Clone)]
struct AccumulatedToolCall {
    id: String,
    name: String,
    arguments: String,
}


#[tauri::command]
pub async fn chat_complete(
    app: tauri::AppHandle,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    on_chunk: Channel<String>,
) -> Result<ChatResult, String> {
    if api_key.trim().is_empty() {
        return Err("missing api key".into());
    }

    // Auto-detect provider from key prefix. Three providers supported:
    // OpenAI (chat/completions), Anthropic (Messages API), Gemini
    // (generativelanguage). Anthropic and Gemini have their own modules.
    let provider = match crate::provider::detect_from_key(&api_key) {
        Some(p) => p,
        None => {
            return Err(
                "Unrecognized API key format. Use OpenAI (sk-...), Anthropic (sk-ant-...), or Gemini (AIza...).".into(),
            );
        }
    };
    let env_override = std::env::var("CHAPPIE_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty());
    if provider == crate::provider::Provider::Gemini {
        let model = env_override
            .clone()
            .unwrap_or_else(|| provider.default_model().to_string());
        return crate::gemini::chat_complete(app, api_key, model, messages, on_chunk).await;
    }
    if provider == crate::provider::Provider::Anthropic {
        let model = env_override
            .clone()
            .unwrap_or_else(|| provider.default_model().to_string());
        return crate::anthropic::chat_complete(app, api_key, model, messages, on_chunk).await;
    }
    // OpenAI from here on. CHAPPIE_MODEL env var wins over the renderer-
    // supplied default.
    let endpoint = format!("{}/chat/completions", provider.base_url());
    let model = env_override.unwrap_or(model);

    crate::linfo!(
        &app,
        "openai",
        "provider={} endpoint={} model={}",
        provider.label(),
        endpoint,
        model
    );

    // Capture the latest user utterance for session_log before we start
    // mutating `working` with injected system messages.
    let last_user_text: String = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_default();

    let mut working: Vec<Value> = messages
        .into_iter()
        .map(|m| json!({"role": m.role, "content": m.content}))
        .collect();

    // Inject the user's approximate location as a system message so chat
    // replies can ground themselves in the right area without the user
    // having to repeat it every turn. Lookup is lazy: if the cache is cold
    // (first turn after launch faster than the startup fetch finished),
    // we trigger one synchronously here with a short timeout.
    let loc = if let Some(c) = crate::location::cached() {
        Some(c)
    } else {
        crate::location::get(false).await.ok()
    };
    if let Some(loc) = loc {
        let context = format!(
            "ユーザーのおおよその現在地は {} です。場所が指定されない天気・地理・地域に関する質問はここを既定として返答してください（IP ベース推定なので住所単位の精度はありません）。",
            crate::location::format_for_prompt(&loc)
        );
        // Insert AFTER the static persona system prompt at index 0 so the
        // persona + tools prefix stays identical across turns (prompt
        // caching keys off the leading prefix). Location can change between
        // sessions but is stable within a session.
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": context}));
    }

    // Inject the user's saved profile / preferences. Goes AFTER the
    // persona prompt so the leading prefix used for prompt caching stays
    // stable; the profile changes only when save_memory / forget_memory
    // is called, which causes a single cache miss and then warms again.
    let profile = crate::memory::profile_summary();
    if !profile.is_empty() {
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": profile}));
    }

    // Long-term memory L3: longitudinal topic / preference snapshot.
    // Refreshes weekly (or when missing) — a much slower cadence than
    // L2 summaries, so this layer is the most cache-friendly piece of
    // the dynamic prefix.
    let topics = crate::topics::prompt_section();
    if !topics.is_empty() {
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": topics}));
    }

    // Long-term memory L2: past N days of conversation summaries so the
    // model can drop "そういえば先週〜" naturally. The summaries change
    // once per day, which is fine for prompt caching: each new day causes
    // one cache miss and then the prefix warms for the rest of the day.
    let recent = crate::summarizer::recent_summaries_prompt(7);
    if !recent.is_empty() {
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": recent}));
    }

    // Long-term memory L1: semantically related past turns (older than
    // the 7-day summary window). Injected AFTER L2 / profile so the
    // cached prefix is persona → profile → L2 summaries → L1 episodes,
    // each layer added on top of the cached one above it.
    let rag = crate::rag::recall_prompt(&last_user_text, 3);
    if !rag.is_empty() {
        let pos = if working.first().and_then(|m| m.get("role")).and_then(|r| r.as_str()) == Some("system") { 1 } else { 0 };
        working.insert(pos, json!({"role": "system", "content": rag}));
    }

    // Kick off backfill of any missing past-N-day summaries in the
    // background. Once-per-process gate inside maybe_backfill.
    crate::summarizer::maybe_backfill(api_key.clone());
    // Same pattern for L3 topics — refreshes weekly so this is mostly
    // a no-op after the first run of the week.
    crate::topics::maybe_refresh(api_key.clone());

    // Time-band hint goes at the END of the system block so the prefix
    // (persona + profile + location) stays cache-stable. Only this trailing
    // line flips between 4 bands per day.
    let band_hint = crate::i18n::time_band_hint();
    let sys_end = working
        .iter()
        .position(|m| m.get("role").and_then(|r| r.as_str()) != Some("system"))
        .unwrap_or(working.len());
    working.insert(sys_end, json!({"role": "system", "content": band_hint}));

    let mut end_conversation = false;
    let mut full_text = String::new();
    let mut called_tools: Vec<String> = Vec::new();

    for round in 0..=MAX_TOOL_ROUNDS {
        let body = json!({
            "model": model,
            "messages": working,
            "tools": crate::tools::all_tools(),
            "tool_choice": "auto",
            "stream": true,
            // Include usage info in the final stream chunk so we can log
            // cached_tokens and verify prompt caching is hitting. OpenAI
            // auto-caches prompts >=1024 tokens; tools + system reach this
            // easily so we expect strong cache hit rates after the first
            // turn of a session.
            "stream_options": { "include_usage": true },
        });

        crate::linfo!(
            &app,
            "openai",
            "round {round}: model={model} messages={n}",
            n = working.len()
        );
        let resp = HTTP
            .post(&endpoint)
            .bearer_auth(&api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("request: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("openai {status}: {text}"));
        }

        // Accumulate this round's stream.
        let mut round_text = String::new();
        let mut tool_calls: HashMap<u32, AccumulatedToolCall> = HashMap::new();
        let mut finish_reason: Option<String> = None;

        let mut stream = resp.bytes_stream();
        let mut buf = String::new();
        'stream: while let Some(item) = stream.next().await {
            let bytes = item.map_err(|e| format!("stream: {e}"))?;
            buf.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(idx) = buf.find("\n\n") {
                let event: String = buf.drain(..idx + 2).collect();
                for line in event.lines() {
                    let Some(data) = line.strip_prefix("data: ") else {
                        continue;
                    };
                    let data = data.trim();
                    if data == "[DONE]" {
                        break 'stream;
                    }
                    let chunk: StreamChunk = match serde_json::from_str(data) {
                        Ok(c) => c,
                        Err(e) => {
                            crate::lwarn!(&app, "openai", "decode chunk failed: {e} on {data}");
                            continue;
                        }
                    };
                    if let Some(usage) = &chunk.usage {
                        let prompt = usage
                            .get("prompt_tokens")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        let cached = usage
                            .get("prompt_tokens_details")
                            .and_then(|d| d.get("cached_tokens"))
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        let completion = usage
                            .get("completion_tokens")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        crate::linfo!(
                            &app,
                            "openai",
                            "usage: prompt={prompt} cached={cached} completion={completion}"
                        );
                    }
                    let Some(choice) = chunk.choices.into_iter().next() else {
                        continue;
                    };
                    if let Some(content) = choice.delta.content {
                        if !content.is_empty() {
                            round_text.push_str(&content);
                            // Forward to renderer for live TTS. Errors here
                            // are non-fatal — the channel may close on cancel.
                            let _ = on_chunk.send(content);
                        }
                    }
                    if let Some(deltas) = choice.delta.tool_calls {
                        for delta in deltas {
                            let entry = tool_calls.entry(delta.index).or_default();
                            if let Some(id) = delta.id {
                                entry.id = id;
                            }
                            if let Some(func) = delta.function {
                                if let Some(name) = func.name {
                                    entry.name.push_str(&name);
                                }
                                if let Some(args) = func.arguments {
                                    entry.arguments.push_str(&args);
                                }
                            }
                        }
                    }
                    if let Some(reason) = choice.finish_reason {
                        finish_reason = Some(reason);
                    }
                }
            }
        }

        full_text.push_str(&round_text);

        // Build the assistant message we just received and append it.
        let assistant_msg = if tool_calls.is_empty() {
            json!({"role": "assistant", "content": round_text})
        } else {
            let mut sorted: Vec<_> = tool_calls.iter().collect();
            sorted.sort_by_key(|(k, _)| *k);
            let calls_json: Vec<Value> = sorted
                .iter()
                .map(|(_, c)| {
                    json!({
                        "id": c.id,
                        "type": "function",
                        "function": { "name": c.name, "arguments": c.arguments },
                    })
                })
                .collect();
            json!({
                "role": "assistant",
                "content": if round_text.is_empty() { Value::Null } else { Value::String(round_text.clone()) },
                "tool_calls": calls_json,
            })
        };
        working.push(assistant_msg);

        // Fast path: if every tool the model called is a "marker" tool (only
        // signals state, doesn't produce content the model needs to weave in),
        // and the model already produced text alongside, we can skip the
        // round-trip that would otherwise just regurgitate the same text.
        let all_marker_tools = !tool_calls.is_empty()
            && tool_calls
                .values()
                .all(|c| c.name == "end_conversation");
        let has_text = !round_text.is_empty();
        let stop_now = tool_calls.is_empty()
            || finish_reason.as_deref() == Some("stop")
            || (all_marker_tools && has_text);

        if stop_now {
            // Even if we short-circuited, run the marker tools so their
            // side effects (e.g. flipping `end_conversation`) take effect.
            for call in tool_calls.values() {
                called_tools.push(call.name.clone());
                let args: Value =
                    serde_json::from_str(&call.arguments).unwrap_or(json!({}));
                crate::tools::execute_tool(&app, &call.name, &args, &mut end_conversation).await;
            }
            let text = if full_text.is_empty() && end_conversation {
                "またね。".to_string()
            } else if full_text.is_empty() {
                return Err("openai returned no content".into());
            } else {
                full_text
            };
            crate::linfo!(
                &app,
                "openai",
                "done: chars={} end_conversation={end_conversation} reply={text:?}",
                text.chars().count()
            );
            crate::session_log::append_turn(&last_user_text, &text, "openai", &model);
            return Ok(ChatResult {
                text,
                end_conversation,
                tool_calls: called_tools,
            });
        }

        crate::linfo!(
            &app,
            "openai",
            "tool_calls: {names}",
            names = tool_calls
                .values()
                .map(|c| c.name.as_str())
                .collect::<Vec<_>>()
                .join(",")
        );

        // Execute each tool in deterministic order and append the results.
        let mut sorted: Vec<_> = tool_calls.into_iter().collect();
        sorted.sort_by_key(|(k, _)| *k);
        for (_, call) in sorted {
            called_tools.push(call.name.clone());
            let args: Value = serde_json::from_str(&call.arguments).unwrap_or(json!({}));
            let result = crate::tools::execute_tool(&app, &call.name, &args, &mut end_conversation).await;
            crate::linfo!(
                &app,
                "openai",
                "tool {name} args={args} -> {result:?}",
                name = call.name
            );
            working.push(json!({
                "role": "tool",
                "tool_call_id": call.id,
                "content": result,
            }));
        }

        if round == MAX_TOOL_ROUNDS {
            return Err("max tool rounds exceeded".into());
        }
    }

    Err("tool loop exited without final message".into())
}
