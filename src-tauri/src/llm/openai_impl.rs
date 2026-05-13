// OpenAI Chat Completions backend for the generic dispatch loop.
//
// The wire format is the simplest of the three — `{role, content}`
// messages with `tool_calls` arrays on assistant turns and a `tool`
// role for results. SSE chunks are JSON objects on `data: ` lines with
// `[DONE]` as the terminator.

use reqwest::RequestBuilder;
use serde::Deserialize;
use serde_json::{json, Value};

use super::events::{ParserState, ProviderEvent, RoundOutput, ToolResult};
use super::LlmProvider;
use crate::openai::ChatMessage;

pub struct OpenAiProvider;

pub type OpenAiState = Vec<Value>;

impl LlmProvider for OpenAiProvider {
    type State = OpenAiState;

    fn label(&self) -> &'static str {
        "openai"
    }

    fn endpoint(&self, _model: &str) -> String {
        format!(
            "{}/chat/completions",
            crate::provider::Provider::OpenAI.base_url()
        )
    }

    fn apply_auth(&self, req: RequestBuilder, api_key: &str) -> RequestBuilder {
        req.bearer_auth(api_key)
    }

    fn prepare_state(&self, messages: Vec<ChatMessage>) -> Self::State {
        messages
            .into_iter()
            .map(|m| json!({ "role": m.role, "content": m.content }))
            .collect()
    }

    fn build_body(&self, state: &Self::State, model: &str, tools: &Value) -> Value {
        // OpenAI prompt caching is automatic for prompts >=1024 tokens.
        // Asking for `stream_options.include_usage` is the only thing we
        // need to do — it surfaces `cached_tokens` in the final stream
        // chunk so the loop can log cache hits.
        json!({
            "model": model,
            "messages": state,
            "tools": tools,
            "tool_choice": "auto",
            "stream": true,
            "stream_options": { "include_usage": true },
        })
    }

    fn parse_sse_line(&self, line: &str, _parser: &mut ParserState) -> Vec<ProviderEvent> {
        let Some(data) = line.strip_prefix("data: ") else {
            return Vec::new();
        };
        let data = data.trim();
        if data == "[DONE]" {
            return vec![ProviderEvent::Stop { reason: None }];
        }
        let chunk: StreamChunk = match serde_json::from_str(data) {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let mut out: Vec<ProviderEvent> = Vec::new();

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
            out.push(ProviderEvent::Usage {
                prompt,
                cached,
                completion,
            });
        }

        let Some(choice) = chunk.choices.into_iter().next() else {
            return out;
        };

        if let Some(content) = choice.delta.content {
            out.push(ProviderEvent::TextDelta(content));
        }

        if let Some(deltas) = choice.delta.tool_calls {
            for delta in deltas {
                let id = delta.id.clone().unwrap_or_default();
                let name = delta
                    .function
                    .as_ref()
                    .and_then(|f| f.name.clone())
                    .unwrap_or_default();
                if !id.is_empty() || !name.is_empty() {
                    out.push(ProviderEvent::ToolCallStart {
                        index: delta.index,
                        id,
                        name,
                    });
                }
                if let Some(func) = delta.function {
                    if let Some(args) = func.arguments {
                        if !args.is_empty() {
                            out.push(ProviderEvent::ToolCallArgsDelta {
                                index: delta.index,
                                partial_json: args,
                            });
                        }
                    }
                }
            }
        }

        if let Some(reason) = choice.finish_reason {
            // OpenAI emits finish_reason="tool_calls" when tools are
            // pending — that's NOT a stop signal for our loop. Only
            // surface "stop" / "length" / etc as Stop events.
            if reason == "stop" || reason == "length" {
                out.push(ProviderEvent::Stop {
                    reason: Some(reason),
                });
            }
        }

        out
    }

    fn append_assistant_turn(&self, state: &mut Self::State, round: &RoundOutput) {
        let msg = if round.tool_calls.is_empty() {
            json!({ "role": "assistant", "content": round.text })
        } else {
            let calls_json: Vec<Value> = round
                .tool_calls
                .iter()
                .map(|c| {
                    json!({
                        "id": c.id,
                        "type": "function",
                        "function": { "name": c.name, "arguments": c.arguments },
                    })
                })
                .collect();
            json!({
                "role": "assistant",
                "content": if round.text.is_empty() {
                    Value::Null
                } else {
                    Value::String(round.text.clone())
                },
                "tool_calls": calls_json,
            })
        };
        state.push(msg);
    }

    fn append_tool_results(&self, state: &mut Self::State, results: &[ToolResult]) {
        for r in results {
            state.push(json!({
                "role": "tool",
                "tool_call_id": r.call_id,
                "content": r.result,
            }));
        }
    }
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
