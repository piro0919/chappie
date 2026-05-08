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
/// a `system_instruction`. System messages get concatenated into the
/// instruction so all model-grounding context survives.
fn translate_messages(messages: Vec<ChatMessage>) -> (Vec<Value>, Option<String>) {
    let mut contents: Vec<Value> = Vec::new();
    let mut system_parts: Vec<String> = Vec::new();
    for m in messages {
        match m.role.as_str() {
            "system" => system_parts.push(m.content),
            "user" => contents.push(json!({
                "role": "user",
                "parts": [{ "text": m.content }],
            })),
            "assistant" => contents.push(json!({
                "role": "model",
                "parts": [{ "text": m.content }],
            })),
            _ => {
                // Unknown role — best-effort treat as user.
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

    // Inject location grounding the same way openai::chat_complete does so
    // weather / "近所の" style queries work.
    let mut messages = messages;
    let loc = if let Some(c) = crate::location::cached() {
        Some(c)
    } else {
        crate::location::get(false).await.ok()
    };
    if let Some(loc) = loc {
        messages.insert(
            0,
            ChatMessage {
                role: "system".to_string(),
                content: format!(
                    "ユーザーのおおよその現在地は {} です。場所が指定されない天気・地理・地域に関する質問はここを既定として返答してください（IP ベース推定なので住所単位の精度はありません）。",
                    crate::location::format_for_prompt(&loc)
                ),
            },
        );
    }

    let (mut contents, system_instruction) = translate_messages(messages);
    let tools = translate_tools(&crate::openai::all_tools());

    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={key}",
        model = model,
        key = urlencoding::encode(&api_key),
    );

    let mut end_conversation = false;
    let mut full_text = String::new();

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
            return Ok(ChatResult {
                text,
                end_conversation,
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
