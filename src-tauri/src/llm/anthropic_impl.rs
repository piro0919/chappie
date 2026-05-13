// Anthropic Messages API backend for the generic dispatch loop.
//
// Wire-format quirks the trait impl encapsulates:
// - `x-api-key` header + required `anthropic-version`
// - System prompt hoisted to a top-level `system` field (not a message)
// - `messages[].content` as a typed-block array (text / tool_use /
//   tool_result), with `max_tokens` required
// - Streaming via typed events: each `data:` line carries an object
//   whose `type` field is one of message_start / content_block_start /
//   content_block_delta / message_delta / message_stop. tool_use input
//   arrives as `input_json_delta` partial-JSON that the dispatch loop
//   reassembles per index.
// - Ephemeral `cache_control` markers on the last tool and on the
//   system block give a 90% input-token discount on cache hits.

use reqwest::RequestBuilder;
use serde::Deserialize;
use serde_json::{json, Value};

use super::events::{ParserState, ProviderEvent, RoundOutput, ToolResult};
use super::LlmProvider;
use crate::openai::ChatMessage;

const ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";
const MAX_TOKENS: u32 = 2048;

pub struct AnthropicProvider;

pub struct AnthropicState {
    pub messages: Vec<Value>,
    pub system: Option<String>,
}

impl LlmProvider for AnthropicProvider {
    type State = AnthropicState;

    fn label(&self) -> &'static str {
        "anthropic"
    }

    fn endpoint(&self, _model: &str) -> String {
        ENDPOINT.to_string()
    }

    fn apply_auth(&self, req: RequestBuilder, api_key: &str) -> RequestBuilder {
        req.header("x-api-key", api_key)
            .header("anthropic-version", API_VERSION)
    }

    fn prepare_state(&self, messages: Vec<ChatMessage>) -> Self::State {
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
        let system = if system_parts.is_empty() {
            None
        } else {
            Some(system_parts.join("\n\n"))
        };
        AnthropicState {
            messages: out,
            system,
        }
    }

    fn build_body(&self, state: &Self::State, model: &str, tools: &Value) -> Value {
        // Translate OpenAI-shape tools to Anthropic's input_schema shape
        // and mark the last entry with cache_control. With this marker
        // Anthropic caches tools + system + leading turns as a single
        // prefix; cache hits cost ~10% of normal input.
        let mut tools_arr: Vec<Value> = tools
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
                                .unwrap_or(json!({ "type": "object" })),
                        }))
                    })
                    .collect()
            })
            .unwrap_or_default();
        if let Some(last) = tools_arr.last_mut() {
            if let Some(obj) = last.as_object_mut() {
                obj.insert(
                    "cache_control".to_string(),
                    json!({ "type": "ephemeral" }),
                );
            }
        }

        let mut body = json!({
            "model": model,
            "max_tokens": MAX_TOKENS,
            "messages": state.messages,
            "tools": tools_arr,
            "stream": true,
        });
        if let Some(sys) = &state.system {
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
        body
    }

    fn parse_sse_line(&self, line: &str, _parser: &mut ParserState) -> Vec<ProviderEvent> {
        let Some(data) = line.strip_prefix("data: ") else {
            return Vec::new();
        };
        let data = data.trim();
        if data.is_empty() {
            return Vec::new();
        }
        let Ok(parsed): Result<StreamEvent, _> = serde_json::from_str(data) else {
            return Vec::new();
        };

        let mut out: Vec<ProviderEvent> = Vec::new();
        match parsed {
            StreamEvent::ContentBlockStart {
                index,
                content_block,
            } => {
                let kind = content_block
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if kind == "tool_use" {
                    let id = content_block
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let name = content_block
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    out.push(ProviderEvent::ToolCallStart { index, id, name });
                }
            }
            StreamEvent::ContentBlockDelta { index, delta } => {
                let dtype = delta.get("type").and_then(|v| v.as_str()).unwrap_or("");
                match dtype {
                    "text_delta" => {
                        if let Some(t) = delta.get("text").and_then(|v| v.as_str()) {
                            if !t.is_empty() {
                                out.push(ProviderEvent::TextDelta(t.to_string()));
                            }
                        }
                    }
                    "input_json_delta" => {
                        if let Some(p) =
                            delta.get("partial_json").and_then(|v| v.as_str())
                        {
                            out.push(ProviderEvent::ToolCallArgsDelta {
                                index,
                                partial_json: p.to_string(),
                            });
                        }
                    }
                    _ => {}
                }
            }
            StreamEvent::MessageStart { message } => {
                if let Some(usage) = message.get("usage") {
                    let input = usage
                        .get("input_tokens")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);
                    let cache_read = usage
                        .get("cache_read_input_tokens")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);
                    out.push(ProviderEvent::Usage {
                        prompt: input,
                        cached: cache_read,
                        completion: 0,
                    });
                }
            }
            StreamEvent::MessageDelta { delta } => {
                if let Some(reason) = delta.get("stop_reason").and_then(|v| v.as_str()) {
                    out.push(ProviderEvent::Stop {
                        reason: Some(reason.to_string()),
                    });
                }
            }
            StreamEvent::ContentBlockStop {}
            | StreamEvent::MessageStop {}
            | StreamEvent::Other => {}
        }
        out
    }

    fn append_assistant_turn(&self, state: &mut Self::State, round: &RoundOutput) {
        let mut blocks: Vec<Value> = Vec::new();
        if !round.text.is_empty() {
            blocks.push(json!({ "type": "text", "text": round.text }));
        }
        for call in &round.tool_calls {
            let input: Value = if call.arguments.is_empty() {
                json!({})
            } else {
                serde_json::from_str(&call.arguments).unwrap_or(json!({}))
            };
            blocks.push(json!({
                "type": "tool_use",
                "id": call.id,
                "name": call.name,
                "input": input,
            }));
        }
        if !blocks.is_empty() {
            state.messages.push(json!({
                "role": "assistant",
                "content": blocks,
            }));
        }
    }

    fn append_tool_results(&self, state: &mut Self::State, results: &[ToolResult]) {
        // Anthropic groups all tool_result blocks into one user message.
        let blocks: Vec<Value> = results
            .iter()
            .map(|r| {
                json!({
                    "type": "tool_result",
                    "tool_use_id": r.call_id,
                    "content": r.result,
                })
            })
            .collect();
        if !blocks.is_empty() {
            state.messages.push(json!({
                "role": "user",
                "content": blocks,
            }));
        }
    }
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
