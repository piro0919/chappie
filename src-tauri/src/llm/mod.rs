// Provider-agnostic chat completion runtime.
//
// `LlmProvider` is the trait each chat-completions backend (OpenAI,
// Anthropic, Gemini) implements. The shared streaming + tool-execution
// loop lives in `dispatch::chat_complete_generic`; providers only own
// wire-format translation (request body, SSE parsing, native message
// shape).
//
// See plan: ~/.claude/plans/plan-harmonic-rose.md

// Anthropic and Gemini migrate in Phase 3 / 4; their wire-format code
// still lives in their respective modules until then. Suppress dead-code
// warnings on the trait surface until every provider has switched over
// (lifted in Phase 5 cleanup).
#![allow(dead_code)]

pub mod dispatch;
pub mod events;
pub mod openai_impl;

use reqwest::RequestBuilder;
use serde_json::Value;

use crate::openai::ChatMessage;

/// Per-provider chat-completions implementation. The dispatch loop
/// owns:
/// - HTTP send + body-stream consumption
/// - Tool execution (via `crate::tools::execute_tool`)
/// - Context injection (location, profile, topics, summaries, RAG,
///   time-band) into the canonical OpenAI-shape system messages
/// - session_log::append_turn
/// - Max-rounds enforcement and marker-tool round-skip
///
/// Implementors translate between the canonical message list and their
/// wire format, plus parse the streaming SSE response into the
/// unified `ProviderEvent` enum.
pub trait LlmProvider: Send + Sync {
    /// Provider state — typically a `Vec<Value>` of native-shape
    /// messages plus any auxiliary fields (e.g. Anthropic's hoisted
    /// `system` field). Owned and mutated through the trait methods.
    type State: Send;

    /// Short label for logs and `session_log::append_turn`
    /// (e.g. "openai" / "anthropic" / "gemini").
    fn label(&self) -> &'static str;

    /// Full URL the streaming request POSTs to. Receives the active
    /// model name for providers that templatize it into the path
    /// (Gemini's `:streamGenerateContent`).
    fn endpoint(&self, model: &str) -> String;

    /// Attach provider-specific authentication (header, bearer token,
    /// `?key=` query) to a reqwest request builder.
    fn apply_auth(&self, req: RequestBuilder, api_key: &str) -> RequestBuilder;

    /// One-time translation from the canonical OpenAI-shape input
    /// (after the dispatch loop has injected its context messages) to
    /// the provider's native shape.
    fn prepare_state(&self, messages: Vec<ChatMessage>) -> Self::State;

    /// Build the streaming JSON body for one round. `tools` is the
    /// canonical OpenAI-shape tools array from `crate::tools::all_tools()`;
    /// providers translate it as needed.
    fn build_body(&self, state: &Self::State, model: &str, tools: &Value) -> Value;

    /// Convert one SSE `data:` payload string into zero or more
    /// `ProviderEvent`s. Stateful parser context (e.g. Anthropic's
    /// `pending_event_type`) lives in `parser`.
    fn parse_sse_line(
        &self,
        data: &str,
        parser: &mut events::ParserState,
    ) -> Vec<events::ProviderEvent>;

    /// Append the assistant turn we just streamed (text + tool calls)
    /// into the provider's state in its native shape.
    fn append_assistant_turn(&self, state: &mut Self::State, round: &events::RoundOutput);

    /// Append the executed tool results into the provider's state in
    /// its native shape.
    fn append_tool_results(&self, state: &mut Self::State, results: &[events::ToolResult]);
}
