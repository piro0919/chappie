// Google Gemini chat completion. Separate from openai.rs because the wire
// format is genuinely different:
//
// - Roles are "user" / "model" (not user/assistant), and the system prompt
//   is hoisted into a top-level `system_instruction` instead of being a
//   message.
// - Tool definitions live under `tools[].function_declarations[]` and use
//   plain `parameters` (no top-level "function" wrapper).
// - Tool calls come back inside `candidates[0].content.parts[]` as
//   `{functionCall: {name, args}}` (and tool results go back as
//   `{functionResponse: {name, response}}`).
// - Auth is `?key=...` query param, not a Bearer header.
// - Streaming uses `:streamGenerateContent?alt=sse`.
//
// We reuse `crate::openai::execute_tool` to avoid duplicating each tool's
// implementation, and `crate::openai::all_tools()` for the canonical tool
// catalog (translated to Gemini's format below).

use futures_util::StreamExt;
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;
use tauri::ipc::Channel;

use crate::openai::{ChatMessage, ChatResult};

const MAX_TOOL_ROUNDS: usize = 5;

static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .expect("failed to build reqwest client")
});

#[derive(Deserialize, Default)]
struct StreamCandidate {
    #[serde(default)]
    content: Option<StreamContent>,
    #[serde(default, rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Deserialize, Default)]
struct StreamContent {
    #[serde(default)]
    parts: Vec<Value>,
}

#[derive(Deserialize, Default)]
struct StreamChunk {
    #[serde(default)]
    candidates: Vec<StreamCandidate>,
    #[serde(default, rename = "usageMetadata")]
    usage: Option<Value>,
}

/// Strip JSON Schema keys Gemini's parser rejects. The OpenAI tool catalog
/// uses `additionalProperties: false` (and could in principle use `$schema`,
/// `definitions`, etc.) — Gemini's function_declarations validator only
/// knows the OpenAPI-3-style subset and 400s on anything else.
fn sanitize_schema(value: &mut Value) {
    match value {
        Value::Object(map) => {
            map.remove("additionalProperties");
            map.remove("$schema");
            map.remove("definitions");
            map.remove("$defs");
            for (_, v) in map.iter_mut() {
                sanitize_schema(v);
            }
        }
        Value::Array(arr) => {
            for v in arr {
                sanitize_schema(v);
            }
        }
        _ => {}
    }
}

/// Translate OpenAI-shape tools (the canonical form `all_tools()` returns)
/// into Gemini's `function_declarations` shape.
fn translate_tools(openai_tools: &Value) -> Value {
    let decls: Vec<Value> = openai_tools
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|t| {
                    let f = t.get("function")?;
                    let mut params = f
                        .get("parameters")
                        .cloned()
                        .unwrap_or(json!({"type": "object"}));
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
    json!([{ "function_declarations": decls }])
}

/// Split incoming OpenAI-style messages into a Gemini `contents` array and
/// a `system_instruction`. Only the FIRST contiguous run of system
/// messages at the top is hoisted into the instruction (this is the
/// stable persona / cached prefix). Any later "system" message is a
/// per-turn directive (e.g. VOICEVOX character override, mute-time
/// formatting hint) and must keep its position relative to the
/// surrounding user/assistant turns — Gemini has no native role for
/// mid-conversation system, so we inline it as a `user` turn with a
/// `【system】` marker. Hoisting these to the top instead would silently
/// bury per-turn instructions behind the cached prefix and the recent
/// assistant turns, which is exactly the bug we hit when character
/// switches kept producing the previous character's reply verbatim.
fn translate_messages(messages: Vec<ChatMessage>) -> (Vec<Value>, Option<String>) {
    let mut contents: Vec<Value> = Vec::new();
    let mut system_parts: Vec<String> = Vec::new();
    let mut prefix_done = false;
    for m in messages {
        match m.role.as_str() {
            "system" if !prefix_done => system_parts.push(m.content),
            "system" => contents.push(json!({
                "role": "user",
                "parts": [{ "text": format!("【system】\n{}", m.content) }],
            })),
            "user" => {
                prefix_done = true;
                contents.push(json!({
                    "role": "user",
                    "parts": [{ "text": m.content }],
                }));
            }
            "assistant" => {
                prefix_done = true;
                contents.push(json!({
                    "role": "model",
                    "parts": [{ "text": m.content }],
                }));
            }
            _ => {
                prefix_done = true;
                contents.push(json!({
                    "role": "user",
                    "parts": [{ "text": m.content }],
                }));
            }
        }
    }
    let sys = if system_parts.is_empty() {
        None
    } else {
        Some(system_parts.join("\n\n"))
    };
    (contents, sys)
}

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

    // Capture latest user utterance for session_log before injection.
    let last_user_text: String = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_default();

    // Inject location grounding the same way openai::chat_complete does so
    // weather / "近所の" style queries work.
    let mut messages = messages;
    let loc = if let Some(c) = crate::location::cached() {
        Some(c)
    } else {
        crate::location::get(false).await.ok()
    };
    if let Some(loc) = loc {
        // Insert after the static persona system message so the cached
        // prefix (system_instruction + tools) stays identical across turns.
        // Gemini 2.5+ implicit caching keys off the leading prefix.
        let pos = if messages.first().map(|m| m.role.as_str()) == Some("system") { 1 } else { 0 };
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: format!(
                    "ユーザーのおおよその現在地は {} です。場所が指定されない天気・地理・地域に関する質問はここを既定として返答してください（IP ベース推定なので住所単位の精度はありません）。",
                    crate::location::format_for_prompt(&loc)
                ),
            },
        );
    }

    let profile = crate::memory::profile_summary();
    if !profile.is_empty() {
        let pos = if messages.first().map(|m| m.role.as_str()) == Some("system") { 1 } else { 0 };
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: profile,
            },
        );
    }

    // Long-term memory L3: weekly-refreshed topic / preference list.
    let topics = crate::topics::prompt_section();
    if !topics.is_empty() {
        let pos = if messages.first().map(|m| m.role.as_str()) == Some("system") { 1 } else { 0 };
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: topics,
            },
        );
    }

    // Long-term memory L2: past 7 days of conversation summaries.
    let recent = crate::summarizer::recent_summaries_prompt(7);
    if !recent.is_empty() {
        let pos = if messages.first().map(|m| m.role.as_str()) == Some("system") { 1 } else { 0 };
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: recent,
            },
        );
    }

    // Long-term memory L1: semantically related past turns (>7 days old).
    let rag = crate::rag::recall_prompt(&last_user_text, 3);
    if !rag.is_empty() {
        let pos = if messages.first().map(|m| m.role.as_str()) == Some("system") { 1 } else { 0 };
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: rag,
            },
        );
    }

    // Backfill missing summaries in background once per process.
    crate::summarizer::maybe_backfill(api_key.clone());
    crate::topics::maybe_refresh(api_key.clone());

    // Time-band hint at the END of the system block — keeps the cached
    // system_instruction prefix stable until the band itself rolls over.
    let sys_end = messages
        .iter()
        .position(|m| m.role.as_str() != "system")
        .unwrap_or(messages.len());
    messages.insert(
        sys_end,
        ChatMessage {
            role: "system".to_string(),
            content: crate::i18n::time_band_hint(),
        },
    );

    let (mut contents, system_instruction) = translate_messages(messages);
    let tools = translate_tools(&crate::openai::all_tools());

    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={key}",
        model = model,
        key = urlencoding::encode(&api_key),
    );

    let mut end_conversation = false;
    let mut full_text = String::new();
    let mut called_tools: Vec<String> = Vec::new();

    for round in 0..=MAX_TOOL_ROUNDS {
        let mut body = json!({
            "contents": contents,
            "tools": tools,
            "tool_config": { "function_calling_config": { "mode": "AUTO" } },
            // Gemini 2.5 family enables a "thinking" phase by default that
            // can consume the full output budget on its own and return an
            // empty content (`parts: []`, `finishReason: "STOP"`). We don't
            // need reasoning for short voice replies, so disable it.
            "generationConfig": {
                "thinkingConfig": { "thinkingBudget": 0 }
            },
            // Personal voice assistant talking only to its owner: relax
            // Gemini's default safety filters so common chit-chat ("占い
            // して" / fortune-telling, dark jokes, mock arguments, etc.)
            // doesn't get refused mid-stream. The default thresholds
            // (`BLOCK_MEDIUM_AND_ABOVE` for dangerous-content) flagged
            // 占い as superstition/dangerous and forced refusals despite
            // the persona prompt asking for generation.
            "safetySettings": [
                { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "BLOCK_NONE" },
            ],
        });
        if let Some(sys) = &system_instruction {
            body["system_instruction"] = json!({ "parts": [{ "text": sys }] });
        }

        crate::linfo!(
            &app,
            "gemini",
            "round {round}: model={model} contents={n}",
            n = contents.len()
        );
        let resp = HTTP
            .post(&endpoint)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("request: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("gemini {status}: {text}"));
        }

        let mut round_text = String::new();
        // Function calls are accumulated by name rather than index because
        // Gemini emits each call as a complete part (no streaming-by-arg
        // like OpenAI). Multiple tools in one turn → multiple parts.
        let mut function_calls: Vec<(String, Value)> = Vec::new();
        let mut finish_reason: Option<String> = None;

        let mut stream = resp.bytes_stream();
        let mut buf = String::new();
        let mut total_bytes: usize = 0;
        let mut raw_log = String::new();

        // Closure-equivalent: process one logical SSE event from `event_text`,
        // advancing round state. Hoisted via a macro so we can reuse it both
        // inside the streaming loop and after EOF (for any trailing event
        // that didn't end with a blank line).
        macro_rules! process_event {
            ($event:expr) => {{
                for line in $event.lines() {
                    let Some(data) = line.strip_prefix("data: ").or_else(|| line.strip_prefix("data:")) else {
                        continue;
                    };
                    let data = data.trim();
                    if data.is_empty() {
                        continue;
                    }
                    let chunk: StreamChunk = match serde_json::from_str(data) {
                        Ok(c) => c,
                        Err(e) => {
                            crate::lwarn!(&app, "gemini", "decode chunk failed: {e} on {data}");
                            continue;
                        }
                    };
                    if let Some(usage) = &chunk.usage {
                        let prompt = usage
                            .get("promptTokenCount")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        let cached = usage
                            .get("cachedContentTokenCount")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        let completion = usage
                            .get("candidatesTokenCount")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(0);
                        crate::linfo!(
                            &app,
                            "gemini",
                            "usage: prompt={prompt} cached={cached} completion={completion}"
                        );
                    }
                    let Some(choice) = chunk.candidates.into_iter().next() else {
                        continue;
                    };
                    if let Some(content) = choice.content {
                        for part in content.parts {
                            if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                                if !text.is_empty() {
                                    round_text.push_str(text);
                                    let _ = on_chunk.send(text.to_string());
                                }
                            } else if let Some(fc) = part.get("functionCall") {
                                let name = fc
                                    .get("name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                let args = fc.get("args").cloned().unwrap_or(json!({}));
                                if !name.is_empty() {
                                    function_calls.push((name, args));
                                }
                            }
                        }
                    }
                    if let Some(reason) = choice.finish_reason {
                        finish_reason = Some(reason);
                    }
                }
            }};
        }

        while let Some(item) = stream.next().await {
            let bytes = item.map_err(|e| format!("stream: {e}"))?;
            total_bytes += bytes.len();
            // Normalize CRLF → LF so the `\n\n` boundary detection works
            // regardless of which line ending the server uses.
            let chunk_str = String::from_utf8_lossy(&bytes).replace("\r\n", "\n");
            raw_log.push_str(&chunk_str);
            buf.push_str(&chunk_str);

            while let Some(idx) = buf.find("\n\n") {
                let event: String = buf.drain(..idx + 2).collect();
                process_event!(event);
            }
        }

        // The last event may not be terminated by a blank line if the server
        // closes the stream right after writing it — process whatever is
        // left in the buffer.
        if !buf.trim().is_empty() {
            let event = std::mem::take(&mut buf);
            process_event!(event);
        }

        if round_text.is_empty() && function_calls.is_empty() {
            crate::lwarn!(
                &app,
                "gemini",
                "stream produced no content: {total_bytes} bytes, finish_reason={finish_reason:?}, raw={raw_log:?}"
            );
        }

        full_text.push_str(&round_text);

        // No tool calls → we're done. Run any marker tools (e.g. end_conversation)
        // would-be calls separately, but Gemini wraps them as functionCall too
        // so they're already in `function_calls` and handled below.
        if function_calls.is_empty() {
            let text = if full_text.is_empty() && end_conversation {
                "またね。".to_string()
            } else if full_text.is_empty() {
                return Err("gemini returned no content".into());
            } else {
                full_text
            };
            crate::linfo!(
                &app,
                "gemini",
                "done: chars={} end_conversation={end_conversation} reply={text:?}",
                text.chars().count()
            );
            crate::session_log::append_turn(&last_user_text, &text, "gemini", &model);
            return Ok(ChatResult {
                text,
                end_conversation,
                tool_calls: called_tools,
            });
        }

        // Append the model's turn (text + functionCall parts) before the
        // tool responses so the next round has correct conversation state.
        let mut model_parts: Vec<Value> = Vec::new();
        if !round_text.is_empty() {
            model_parts.push(json!({ "text": round_text }));
        }
        for (name, args) in &function_calls {
            model_parts.push(json!({
                "functionCall": { "name": name, "args": args },
            }));
        }
        contents.push(json!({ "role": "model", "parts": model_parts }));

        // Execute tools in declaration order. The fast-path of "model
        // produced text alongside marker tools, skip the round-trip" that
        // openai.rs does isn't applicable here because Gemini doesn't have
        // the same finish_reason/tool_calls split — we always feed responses
        // back so the model can naturally close the conversation.
        crate::linfo!(
            &app,
            "gemini",
            "tool_calls: {names}",
            names = function_calls
                .iter()
                .map(|(n, _)| n.as_str())
                .collect::<Vec<_>>()
                .join(",")
        );

        let mut response_parts: Vec<Value> = Vec::new();
        let _ = finish_reason;
        for (name, args) in function_calls {
            called_tools.push(name.clone());
            let result =
                crate::openai::execute_tool(&app, &name, &args, &mut end_conversation).await;
            // Tool results need to be JSON objects in Gemini's eyes; if our
            // tool returned a JSON-serialized string, parse it back. Plain
            // strings get wrapped in `{ "result": "..." }`.
            let response_value: Value = serde_json::from_str(&result)
                .unwrap_or_else(|_| json!({ "result": result }));
            crate::linfo!(
                &app,
                "gemini",
                "tool {name} args={args} -> {result:?}"
            );
            response_parts.push(json!({
                "functionResponse": {
                    "name": name,
                    "response": response_value,
                },
            }));
        }
        contents.push(json!({ "role": "user", "parts": response_parts }));

        if round == MAX_TOOL_ROUNDS {
            return Err("max tool rounds exceeded".into());
        }
    }

    Err("tool loop exited without final message".into())
}
