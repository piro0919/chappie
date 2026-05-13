// Google Gemini backend for the generic dispatch loop.
//
// Wire-format quirks encapsulated here:
// - Roles are "user" / "model" (not assistant); system prompt is
//   hoisted to a top-level `system_instruction` instead of being a
//   message — but only the FIRST contiguous run of system messages.
//   Later "system" entries are per-turn directives (mute-time formatting,
//   VOICEVOX character override) and stay inline as `user` turns with
//   a `【system】` marker so they outweigh recent assistant turns.
// - Tool definitions live under `tools[].function_declarations[]`; the
//   JSON Schema is sanitized to drop OpenAI-specific keys
//   (`additionalProperties`, `$schema`, etc.) Gemini's validator rejects.
// - Tool calls come back inside `candidates[0].content.parts[]` as
//   `{functionCall: {name, args}}`. `args` is a complete JSON object
//   from the first event — no partial-string reassembly needed.
// - Tool results go back as `{functionResponse: {name, response}}` where
//   `response` must be a JSON object (raw strings get wrapped in
//   `{ "result": "..." }`).
// - Auth is `?key=...` query param. Streaming uses
//   `:streamGenerateContent?alt=sse`.

use reqwest::RequestBuilder;
use serde::Deserialize;
use serde_json::{json, Value};

use super::events::{ParserState, ProviderEvent, RoundOutput, ToolResult};
use super::LlmProvider;
use crate::openai::ChatMessage;

pub struct GeminiProvider;

pub struct GeminiState {
    /// Contents array in Gemini's user/model + functionResponse shape.
    pub contents: Vec<Value>,
    /// Top-level system_instruction (only the leading contiguous run of
    /// system messages is hoisted here; later ones are inlined as user
    /// turns with a 【system】 marker — see prepare_state).
    pub system_instruction: Option<String>,
}

impl LlmProvider for GeminiProvider {
    type State = GeminiState;

    fn label(&self) -> &'static str {
        "gemini"
    }

    fn endpoint(&self, model: &str, api_key: &str) -> String {
        // Auth is via ?key=... query param. Embedded in the URL so
        // apply_auth can stay a no-op for this provider.
        format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={key}",
            key = urlencoding::encode(api_key)
        )
    }

    fn apply_auth(&self, req: RequestBuilder, _api_key: &str) -> RequestBuilder {
        req
    }

    fn prepare_state(&self, messages: Vec<ChatMessage>) -> Self::State {
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
        let system_instruction = if system_parts.is_empty() {
            None
        } else {
            Some(system_parts.join("\n\n"))
        };
        GeminiState {
            contents,
            system_instruction,
        }
    }

    fn build_body(&self, state: &Self::State, _model: &str, tools: &Value) -> Value {
        // Translate canonical OpenAI tools to Gemini's
        // function_declarations shape, dropping schema keys the
        // Gemini validator rejects.
        let decls: Vec<Value> = tools
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| {
                        let f = t.get("function")?;
                        let mut params = f
                            .get("parameters")
                            .cloned()
                            .unwrap_or(json!({ "type": "object" }));
                        sanitize_schema(&mut params);
                        Some(json!({
                            "name": f.get("name")?.clone(),
                            "description": f
                                .get("description")
                                .cloned()
                                .unwrap_or(Value::Null),
                            "parameters": params,
                        }))
                    })
                    .collect()
            })
            .unwrap_or_default();

        let mut body = json!({
            "contents": state.contents,
            "tools": [{ "function_declarations": decls }],
            "tool_config": { "function_calling_config": { "mode": "AUTO" } },
            // Gemini 2.5 enables a "thinking" phase by default that
            // can consume the full output budget on its own and return
            // an empty content. We don't need reasoning for short
            // voice replies, so disable it.
            "generationConfig": {
                "thinkingConfig": { "thinkingBudget": 0 }
            },
            // Personal voice assistant talking only to its owner: relax
            // Gemini's default safety filters so common chit-chat
            // (占い / fortune-telling, dark jokes, etc.) doesn't get
            // refused mid-stream.
            "safetySettings": [
                { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" },
                { "category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "BLOCK_NONE" },
            ],
        });
        if let Some(sys) = &state.system_instruction {
            body["system_instruction"] = json!({ "parts": [{ "text": sys }] });
        }
        body
    }

    fn parse_sse_line(&self, line: &str, parser: &mut ParserState) -> Vec<ProviderEvent> {
        // Gemini accepts both `data: ` and `data:` — match either.
        let data = match line
            .strip_prefix("data: ")
            .or_else(|| line.strip_prefix("data:"))
        {
            Some(d) => d.trim(),
            None => return Vec::new(),
        };
        if data.is_empty() {
            return Vec::new();
        }
        let Ok(chunk): Result<StreamChunk, _> = serde_json::from_str(data) else {
            return Vec::new();
        };

        let mut out: Vec<ProviderEvent> = Vec::new();
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
            out.push(ProviderEvent::Usage {
                prompt,
                cached,
                completion,
            });
        }
        let Some(choice) = chunk.candidates.into_iter().next() else {
            return out;
        };
        if let Some(content) = choice.content {
            for part in content.parts {
                if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                    if !text.is_empty() {
                        out.push(ProviderEvent::TextDelta(text.to_string()));
                    }
                } else if let Some(fc) = part.get("functionCall") {
                    let name = fc
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let args = fc.get("args").cloned().unwrap_or(json!({}));
                    if !name.is_empty() {
                        let index = parser.tool_call_counter;
                        parser.tool_call_counter += 1;
                        out.push(ProviderEvent::ToolCallStart {
                            index,
                            id: String::new(),
                            name,
                        });
                        out.push(ProviderEvent::ToolCallComplete {
                            index,
                            full_args: Some(args),
                        });
                    }
                }
            }
        }
        // Gemini's finishReason is informational here; the stop signal
        // the dispatch loop relies on is "no tool calls this round",
        // which it checks via round.tool_calls.is_empty(). Skip emitting
        // ProviderEvent::Stop so we don't break early on FINISH=STOP
        // when there were also function calls.
        let _ = choice.finish_reason;
        out
    }

    fn append_assistant_turn(&self, state: &mut Self::State, round: &RoundOutput) {
        let mut parts: Vec<Value> = Vec::new();
        if !round.text.is_empty() {
            parts.push(json!({ "text": round.text }));
        }
        for call in &round.tool_calls {
            let args: Value = if call.arguments.is_empty() {
                json!({})
            } else {
                serde_json::from_str(&call.arguments).unwrap_or(json!({}))
            };
            parts.push(json!({
                "functionCall": { "name": call.name, "args": args },
            }));
        }
        if !parts.is_empty() {
            state.contents.push(json!({
                "role": "model",
                "parts": parts,
            }));
        }
    }

    fn append_tool_results(&self, state: &mut Self::State, results: &[ToolResult]) {
        // Tool results need to be JSON objects in Gemini's eyes; if
        // our tool returned a JSON-serialized string, parse it back.
        // Plain strings get wrapped in `{ "result": "..." }`.
        let parts: Vec<Value> = results
            .iter()
            .map(|r| {
                let response_value: Value = serde_json::from_str(&r.result)
                    .unwrap_or_else(|_| json!({ "result": r.result }));
                json!({
                    "functionResponse": {
                        "name": r.name,
                        "response": response_value,
                    },
                })
            })
            .collect();
        if !parts.is_empty() {
            state.contents.push(json!({
                "role": "user",
                "parts": parts,
            }));
        }
    }
}

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
