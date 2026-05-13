// Anthropic Messages API. The third wire format we support, separate from
// openai.rs and gemini.rs.
//
// Differences worth knowing:
// - Auth uses `x-api-key` header (not Bearer) plus a required
//   `anthropic-version` header.
// - System prompt is a top-level `system` field, not a message.
// - `messages[].content` is an array of typed blocks (text / tool_use /
//   tool_result), not a plain string.
// - Streaming uses typed SSE events. Each `data:` carries an object whose
//   `type` field tells you which event ("content_block_start",
//   "content_block_delta", "message_delta", etc.). Content blocks are
//   indexed; tool_use input arrives as `input_json_delta` partial JSON
//   that has to be reassembled per index.
// - `max_tokens` is required.
//
// We reuse `openai::execute_tool` and `openai::all_tools()` to avoid
// duplicating tool implementations and definitions.

use futures_util::StreamExt;
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
use tauri::ipc::Channel;

use crate::openai::{ChatMessage, ChatResult};

const MAX_TOOL_ROUNDS: usize = 5;
const ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";
const MAX_TOKENS: u32 = 2048;

static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .expect("failed to build reqwest client")
});

/// Translate the canonical OpenAI-shape tool catalog into Anthropic's
/// shape. Anthropic uses `name` / `description` / `input_schema` (the
/// JSON Schema lives under `input_schema` rather than `parameters`).
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
                        "input_schema": f.get("parameters").cloned().unwrap_or(json!({"type": "object"})),
                    }))
                })
                .collect()
        })
        .unwrap_or_default();
    Value::Array(arr)
}

/// Pull system messages out into a single concatenated string and convert
/// the rest into Anthropic's `messages` shape.
fn translate_messages(messages: Vec<ChatMessage>) -> (Vec<Value>, Option<String>) {
    let mut out: Vec<Value> = Vec::new();
    let mut system_parts: Vec<String> = Vec::new();
    for m in messages {
        match m.role.as_str() {
            "system" => system_parts.push(m.content),
            "user" | "assistant" => out.push(json!({
                "role": m.role,
                "content": m.content,
            })),
            _ => out.push(json!({
                "role": "user",
                "content": m.content,
            })),
        }
    }
    let sys = if system_parts.is_empty() {
        None
    } else {
        Some(system_parts.join("\n\n"))
    };
    (out, sys)
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart { message: Value },
    #[serde(rename = "content_block_start")]
    ContentBlockStart { index: u32, content_block: Value },
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { index: u32, delta: Value },
    #[serde(rename = "content_block_stop")]
    ContentBlockStop {},
    #[serde(rename = "message_delta")]
    MessageDelta { delta: Value },
    #[serde(rename = "message_stop")]
    MessageStop {},
    #[serde(other)]
    Other,
}

#[derive(Default, Clone)]
struct AccumulatedBlock {
    /// "text" or "tool_use"
    kind: String,
    text: String,
    tool_use_id: String,
    tool_name: String,
    tool_input_json: String,
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

    // Capture the latest user utterance for session_log before injection.
    let last_user_text: String = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_default();

    // Inject location grounding (same pattern as openai/gemini paths).
    let mut messages = messages;
    let loc = if let Some(c) = crate::location::cached() {
        Some(c)
    } else {
        crate::location::get(false).await.ok()
    };
    if let Some(loc) = loc {
        // Insert AFTER the static persona system message so the cached
        // prefix (system + tools) stays identical between turns. The system
        // string fed to Anthropic is the join of all role=system messages
        // in order, so this placement controls cache key stability.
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

    // Long-term memory L2: past 7 days of conversation summaries so the
    // model can naturally reference earlier days without being mechanical.
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

    // Time-band hint at the END of the system block so the cached prefix
    // (persona + profile + location) stays stable across the day. The
    // system string Anthropic sees is the join of all role=system entries
    // in order, so trailing position keeps cache key disruption minimal.
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

    let (mut working, system) = translate_messages(messages);
    // Mark the last tool with cache_control so Anthropic caches the entire
    // tools array (and everything before it: system, model). Cache hits
    // are billed at ~10% of normal input — a 90% discount on this prefix.
    // 5-minute TTL is fine: voice turns within a conversation are seconds
    // apart, well inside the window.
    let tools = {
        let mut arr = match translate_tools(&crate::openai::all_tools()) {
            Value::Array(a) => a,
            _ => Vec::new(),
        };
        if let Some(last) = arr.last_mut() {
            if let Some(obj) = last.as_object_mut() {
                obj.insert(
                    "cache_control".to_string(),
                    json!({ "type": "ephemeral" }),
                );
            }
        }
        Value::Array(arr)
    };

    let mut end_conversation = false;
    let mut full_text = String::new();
    let mut called_tools: Vec<String> = Vec::new();

    for round in 0..=MAX_TOOL_ROUNDS {
        let mut body = json!({
            "model": model,
            "max_tokens": MAX_TOKENS,
            "messages": working,
            "tools": tools,
            "stream": true,
        });
        if let Some(sys) = &system {
            // Send system as a single-block array so we can attach
            // cache_control. With this marker Anthropic caches system +
            // tools as one prefix.
            body["system"] = json!([
                {
                    "type": "text",
                    "text": sys,
                    "cache_control": { "type": "ephemeral" }
                }
            ]);
        }

        crate::linfo!(
            &app,
            "anthropic",
            "round {round}: model={model} messages={n}",
            n = working.len()
        );
        let resp = HTTP
            .post(ENDPOINT)
            .header("x-api-key", &api_key)
            .header("anthropic-version", API_VERSION)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("request: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("anthropic {status}: {text}"));
        }

        let mut blocks: HashMap<u32, AccumulatedBlock> = HashMap::new();
        let mut block_order: Vec<u32> = Vec::new();
        let mut round_text = String::new();
        let mut stop_reason: Option<String> = None;

        let mut stream = resp.bytes_stream();
        let mut buf = String::new();
        while let Some(item) = stream.next().await {
            let bytes = item.map_err(|e| format!("stream: {e}"))?;
            buf.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(idx) = buf.find("\n\n") {
                let event: String = buf.drain(..idx + 2).collect();
                for line in event.lines() {
                    let Some(data) = line.strip_prefix("data: ") else {
                        continue;
                    };
                    let data = data.trim();
                    if data.is_empty() {
                        continue;
                    }
                    let parsed: StreamEvent = match serde_json::from_str(data) {
                        Ok(e) => e,
                        Err(e) => {
                            crate::lwarn!(
                                &app,
                                "anthropic",
                                "decode chunk failed: {e} on {data}"
                            );
                            continue;
                        }
                    };
                    match parsed {
                        StreamEvent::ContentBlockStart {
                            index,
                            content_block,
                        } => {
                            let kind = content_block
                                .get("type")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let mut block = AccumulatedBlock {
                                kind: kind.clone(),
                                ..AccumulatedBlock::default()
                            };
                            if kind == "tool_use" {
                                block.tool_use_id = content_block
                                    .get("id")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                                block.tool_name = content_block
                                    .get("name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string();
                            }
                            blocks.insert(index, block);
                            if !block_order.contains(&index) {
                                block_order.push(index);
                            }
                        }
                        StreamEvent::ContentBlockDelta { index, delta } => {
                            let entry = blocks.entry(index).or_default();
                            let dtype = delta
                                .get("type")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            match dtype {
                                "text_delta" => {
                                    if let Some(t) =
                                        delta.get("text").and_then(|v| v.as_str())
                                    {
                                        if !t.is_empty() {
                                            entry.text.push_str(t);
                                            round_text.push_str(t);
                                            let _ = on_chunk.send(t.to_string());
                                        }
                                    }
                                }
                                "input_json_delta" => {
                                    if let Some(p) = delta
                                        .get("partial_json")
                                        .and_then(|v| v.as_str())
                                    {
                                        entry.tool_input_json.push_str(p);
                                    }
                                }
                                _ => {}
                            }
                        }
                        StreamEvent::ContentBlockStop {} => {}
                        StreamEvent::MessageDelta { delta } => {
                            if let Some(reason) = delta
                                .get("stop_reason")
                                .and_then(|v| v.as_str())
                            {
                                stop_reason = Some(reason.to_string());
                            }
                        }
                        StreamEvent::MessageStart { message } => {
                            if let Some(usage) = message.get("usage") {
                                let input = usage
                                    .get("input_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let cache_create = usage
                                    .get("cache_creation_input_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let cache_read = usage
                                    .get("cache_read_input_tokens")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                crate::linfo!(
                                    &app,
                                    "anthropic",
                                    "usage: input={input} cache_create={cache_create} cache_read={cache_read}"
                                );
                            }
                        }
                        StreamEvent::MessageStop {} | StreamEvent::Other => {}
                    }
                }
            }
        }

        full_text.push_str(&round_text);

        // Build the assistant message we just received in Anthropic's
        // content-block array form (text + tool_use blocks, in order).
        let mut assistant_blocks: Vec<Value> = Vec::new();
        let mut tool_uses: Vec<(String, String, Value)> = Vec::new(); // (id, name, args)
        for idx in &block_order {
            let Some(b) = blocks.get(idx) else { continue };
            match b.kind.as_str() {
                "text" => {
                    if !b.text.is_empty() {
                        assistant_blocks.push(json!({
                            "type": "text",
                            "text": b.text,
                        }));
                    }
                }
                "tool_use" => {
                    let args: Value = if b.tool_input_json.is_empty() {
                        json!({})
                    } else {
                        serde_json::from_str(&b.tool_input_json).unwrap_or(json!({}))
                    };
                    assistant_blocks.push(json!({
                        "type": "tool_use",
                        "id": b.tool_use_id,
                        "name": b.tool_name,
                        "input": args,
                    }));
                    tool_uses.push((
                        b.tool_use_id.clone(),
                        b.tool_name.clone(),
                        args,
                    ));
                }
                _ => {}
            }
        }
        if !assistant_blocks.is_empty() {
            working.push(json!({
                "role": "assistant",
                "content": assistant_blocks,
            }));
        }

        // No tool calls (or stop_reason == "end_turn") → we're done.
        if tool_uses.is_empty() {
            let text = if full_text.is_empty() && end_conversation {
                "またね。".to_string()
            } else if full_text.is_empty() {
                return Err("anthropic returned no content".into());
            } else {
                full_text
            };
            crate::linfo!(
                &app,
                "anthropic",
                "done: chars={} stop_reason={stop_reason:?} end_conversation={end_conversation}",
                text.chars().count()
            );
            crate::session_log::append_turn(&last_user_text, &text, "anthropic", &model);
            return Ok(ChatResult {
                text,
                end_conversation,
                tool_calls: called_tools,
            });
        }

        crate::linfo!(
            &app,
            "anthropic",
            "tool_calls: {names}",
            names = tool_uses
                .iter()
                .map(|(_, n, _)| n.as_str())
                .collect::<Vec<_>>()
                .join(",")
        );

        // Execute tools and assemble a single user message containing all
        // tool_result blocks (Anthropic groups results that way).
        let mut result_blocks: Vec<Value> = Vec::new();
        for (id, name, args) in tool_uses {
            called_tools.push(name.clone());
            let result =
                crate::openai::execute_tool(&app, &name, &args, &mut end_conversation).await;
            crate::linfo!(
                &app,
                "anthropic",
                "tool {name} args={args} -> {result:?}"
            );
            result_blocks.push(json!({
                "type": "tool_result",
                "tool_use_id": id,
                "content": result,
            }));
        }
        working.push(json!({
            "role": "user",
            "content": result_blocks,
        }));

        if round == MAX_TOOL_ROUNDS {
            return Err("max tool rounds exceeded".into());
        }
    }

    Err("tool loop exited without final message".into())
}
