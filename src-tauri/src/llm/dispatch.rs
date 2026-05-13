// Provider-agnostic chat completion dispatch.
//
// This loop owns everything that's not wire-format-specific:
//
// - Empty-key rejection
// - Context injection prelude (location → profile → topics → summaries →
//   RAG → time-band hint) into the canonical OpenAI-shape system messages
// - Background backfill triggers (summarizer + topics)
// - reqwest POST + SSE byte-stream consumption
// - Per-round tool call accumulation and tool execution
// - Marker-tool round-skip optimization
// - MAX_TOOL_ROUNDS enforcement
// - session_log::append_turn at the end of a successful turn
// - Streaming TextDelta → on_chunk forwarding for live TTS
//
// Providers translate canonical messages to their native shape via
// `prepare_state`, build the request via `build_body`, parse SSE
// payloads via `parse_sse_line`, and append assistant turns + tool
// results to their native message arrays.
//
// See plan: ~/.claude/plans/plan-harmonic-rose.md

use futures_util::StreamExt;
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::ipc::Channel;

use super::events::{
    AccumulatedToolCall, ParserState, ProviderEvent, RoundOutput, ToolResult,
};
use super::LlmProvider;
use crate::openai::{ChatMessage, ChatResult};

const MAX_TOOL_ROUNDS: usize = 5;

static HTTP: once_cell::sync::Lazy<reqwest::Client> =
    once_cell::sync::Lazy::new(|| crate::http::build_client(Some(120), None));

pub async fn chat_complete_generic<P: LlmProvider>(
    app: &tauri::AppHandle,
    provider: P,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    on_chunk: Channel<String>,
) -> Result<ChatResult, String> {
    if api_key.trim().is_empty() {
        return Err("missing api key".into());
    }

    let label = provider.label();

    // Capture the latest user utterance for session_log before injection.
    let last_user_text: String = messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_default();

    // Context injection prelude. Operates on canonical OpenAI-shape
    // ChatMessage list; each provider's `prepare_state` is called once
    // at the end to translate the result.
    let mut messages = messages;
    inject_context(&mut messages, &last_user_text, &api_key).await;

    crate::linfo!(
        app,
        label,
        "model={model} messages={n} (post-injection)",
        n = messages.len()
    );

    let mut state = provider.prepare_state(messages);
    let tools = crate::tools::all_tools();
    let endpoint = provider.endpoint(&model);

    let mut end_conversation = false;
    let mut full_text = String::new();
    let mut called_tools: Vec<String> = Vec::new();

    for round in 0..=MAX_TOOL_ROUNDS {
        let body = provider.build_body(&state, &model, &tools);

        crate::linfo!(app, label, "round {round}: dispatch");
        let req = HTTP.post(&endpoint).json(&body);
        let req = provider.apply_auth(req, &api_key);
        let resp = req
            .send()
            .await
            .map_err(|e| format!("request: {e}"))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("{label} {status}: {text}"));
        }

        let round_output = consume_stream(&provider, app, resp, &on_chunk).await?;
        full_text.push_str(&round_output.text);

        // Append the assistant turn into the provider's native state
        // so the next round's request body reflects it.
        provider.append_assistant_turn(&mut state, &round_output);

        // Marker-tool round-skip: when every tool called this round is
        // a "marker" (signals state only — currently just
        // `end_conversation`) AND the model already produced text, we
        // can short-circuit. The next round would just feed back "ok"
        // and ask the model to say goodbye again.
        let all_marker_tools = !round_output.tool_calls.is_empty()
            && round_output
                .tool_calls
                .iter()
                .all(|c| c.name == "end_conversation");
        let has_text = !round_output.text.is_empty();
        let stop_now = round_output.tool_calls.is_empty()
            || round_output.finish_reason.as_deref() == Some("stop")
            || (all_marker_tools && has_text);

        if stop_now {
            // Run any marker tools so side-effects (e.g. flipping
            // end_conversation) take effect even on the short-circuit path.
            for call in &round_output.tool_calls {
                called_tools.push(call.name.clone());
                let args: Value =
                    serde_json::from_str(&call.arguments).unwrap_or(json!({}));
                crate::tools::execute_tool(app, &call.name, &args, &mut end_conversation).await;
            }
            let text = if full_text.is_empty() && end_conversation {
                "またね。".to_string()
            } else if full_text.is_empty() {
                return Err(format!("{label} returned no content"));
            } else {
                full_text
            };
            crate::linfo!(
                app,
                label,
                "done: chars={} end_conversation={end_conversation}",
                text.chars().count()
            );
            crate::session_log::append_turn(&last_user_text, &text, label, &model);
            return Ok(ChatResult {
                text,
                end_conversation,
                tool_calls: called_tools,
            });
        }

        crate::linfo!(
            app,
            label,
            "tool_calls: {names}",
            names = round_output
                .tool_calls
                .iter()
                .map(|c| c.name.as_str())
                .collect::<Vec<_>>()
                .join(",")
        );

        // Execute each tool in declaration order and append the results
        // back into the provider's state for the next round.
        let mut results: Vec<ToolResult> = Vec::new();
        for call in &round_output.tool_calls {
            called_tools.push(call.name.clone());
            let args: Value = serde_json::from_str(&call.arguments).unwrap_or(json!({}));
            let result =
                crate::tools::execute_tool(app, &call.name, &args, &mut end_conversation).await;
            crate::linfo!(
                app,
                label,
                "tool {name} -> {result:?}",
                name = call.name
            );
            results.push(ToolResult {
                call_id: call.id.clone(),
                name: call.name.clone(),
                result,
            });
        }
        provider.append_tool_results(&mut state, &results);

        if round == MAX_TOOL_ROUNDS {
            return Err("max tool rounds exceeded".into());
        }
    }

    Err("tool loop exited without final message".into())
}

/// Inject location / profile / topics / summaries / RAG / time-band
/// system messages into `messages` in the order the existing providers
/// used. Order matters for prompt caching — the leading prefix
/// (persona + ... + last static layer) must stay stable across turns
/// so the cached key warms.
async fn inject_context(messages: &mut Vec<ChatMessage>, last_user_text: &str, api_key: &str) {
    let after_persona = |msgs: &[ChatMessage]| -> usize {
        if msgs.first().map(|m| m.role.as_str()) == Some("system") {
            1
        } else {
            0
        }
    };

    // Location grounding. Lazy: cached value preferred, IP fallback if
    // cold. Inserted AFTER the static persona system prompt so the
    // persona + tools prefix stays identical across turns.
    let loc = if let Some(c) = crate::location::cached() {
        Some(c)
    } else {
        crate::location::get(false).await.ok()
    };
    if let Some(loc) = loc {
        let pos = after_persona(messages);
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

    // Profile / preferences (only changes when save_memory /
    // forget_memory fires).
    let profile = crate::memory::profile_summary();
    if !profile.is_empty() {
        let pos = after_persona(messages);
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: profile,
            },
        );
    }

    // L3: weekly-refreshed topic / preference snapshot.
    let topics = crate::topics::prompt_section();
    if !topics.is_empty() {
        let pos = after_persona(messages);
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: topics,
            },
        );
    }

    // L2: past 7 days of summaries.
    let recent = crate::summarizer::recent_summaries_prompt(7);
    if !recent.is_empty() {
        let pos = after_persona(messages);
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: recent,
            },
        );
    }

    // L1: semantically related older turns. Injected AFTER L2 so the
    // cached prefix is persona → profile → L3 → L2 → L1.
    let rag = crate::rag::recall_prompt(last_user_text, 3);
    if !rag.is_empty() {
        let pos = after_persona(messages);
        messages.insert(
            pos,
            ChatMessage {
                role: "system".to_string(),
                content: rag,
            },
        );
    }

    // Once-per-process backfill triggers for L2 / L3.
    crate::summarizer::maybe_backfill(api_key.to_string());
    crate::topics::maybe_refresh(api_key.to_string());

    // Time-band hint at the END of the system block so the prefix
    // (persona + profile + location) stays cache-stable; only this
    // trailing line flips between 4 bands per day.
    let band_hint = crate::i18n::time_band_hint();
    let sys_end = messages
        .iter()
        .position(|m| m.role.as_str() != "system")
        .unwrap_or(messages.len());
    messages.insert(
        sys_end,
        ChatMessage {
            role: "system".to_string(),
            content: band_hint,
        },
    );
}

/// Drain one round's SSE stream into a `RoundOutput`. Per-line parsing
/// is delegated to the provider via `parse_sse_line`; this function
/// just owns the buffer-and-split-on-blank-line bookkeeping.
async fn consume_stream<P: LlmProvider>(
    provider: &P,
    app: &tauri::AppHandle,
    resp: reqwest::Response,
    on_chunk: &Channel<String>,
) -> Result<RoundOutput, String> {
    let label = provider.label();
    let mut round_text = String::new();
    let mut tool_calls: HashMap<u32, AccumulatedToolCall> = HashMap::new();
    let mut finish_reason: Option<String> = None;
    let mut parser = ParserState::default();
    let mut done = false;

    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    while let Some(item) = stream.next().await {
        let bytes = item.map_err(|e| format!("stream: {e}"))?;
        buf.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(idx) = buf.find("\n\n") {
            let event: String = buf.drain(..idx + 2).collect();
            for line in event.lines() {
                let events = provider.parse_sse_line(line, &mut parser);
                for evt in events {
                    match evt {
                        ProviderEvent::TextDelta(s) => {
                            if !s.is_empty() {
                                round_text.push_str(&s);
                                let _ = on_chunk.send(s);
                            }
                        }
                        ProviderEvent::ToolCallStart { index, id, name } => {
                            let entry = tool_calls.entry(index).or_default();
                            if !id.is_empty() {
                                entry.id = id;
                            }
                            if !name.is_empty() {
                                entry.name.push_str(&name);
                            }
                        }
                        ProviderEvent::ToolCallArgsDelta {
                            index,
                            partial_json,
                        } => {
                            let entry = tool_calls.entry(index).or_default();
                            entry.arguments.push_str(&partial_json);
                        }
                        ProviderEvent::ToolCallComplete { index, full_args } => {
                            if let Some(v) = full_args {
                                let entry = tool_calls.entry(index).or_default();
                                entry.arguments = serde_json::to_string(&v)
                                    .unwrap_or_else(|_| "{}".to_string());
                            }
                        }
                        ProviderEvent::Usage {
                            prompt,
                            cached,
                            completion,
                        } => {
                            crate::linfo!(
                                app,
                                label,
                                "usage: prompt={prompt} cached={cached} completion={completion}"
                            );
                        }
                        ProviderEvent::Stop { reason } => {
                            if let Some(r) = reason {
                                finish_reason = Some(r);
                            }
                            done = true;
                        }
                    }
                }
                if done {
                    break;
                }
            }
            if done {
                break;
            }
        }
        if done {
            break;
        }
    }

    let mut sorted: Vec<_> = tool_calls.into_iter().collect();
    sorted.sort_by_key(|(k, _)| *k);
    Ok(RoundOutput {
        text: round_text,
        tool_calls: sorted.into_iter().map(|(_, v)| v).collect(),
        finish_reason,
    })
}
