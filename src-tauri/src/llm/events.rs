// Streaming events emitted by provider-specific SSE parsers, plus the
// accumulator the generic dispatch loop uses to assemble tool calls
// across multiple delta chunks.

use serde_json::Value;

/// One event extracted from a provider's SSE stream after the provider
/// translates its wire-specific format. The dispatch loop only ever
/// sees these — never the raw OpenAI / Anthropic / Gemini variants.
#[derive(Debug)]
pub enum ProviderEvent {
    TextDelta(String),
    ToolCallStart {
        index: u32,
        id: String,
        name: String,
    },
    /// Partial JSON for a tool call's args. Each fragment appends to
    /// the accumulator under `index`.
    ToolCallArgsDelta {
        index: u32,
        partial_json: String,
    },
    /// Gemini emits args as a complete JSON object in a single event;
    /// this lets the parser bypass partial-string reassembly. When
    /// `full_args` is Some, the accumulator stores it directly.
    ToolCallComplete {
        index: u32,
        full_args: Option<Value>,
    },
    Usage {
        prompt: u64,
        cached: u64,
        completion: u64,
    },
    Stop {
        reason: Option<String>,
    },
}

/// Tool call assembled from one or more SSE deltas. The dispatch loop
/// holds these in a `HashMap<u32, AccumulatedToolCall>` keyed by the
/// provider's per-round tool index.
#[derive(Default, Clone, Debug)]
pub struct AccumulatedToolCall {
    pub id: String,
    pub name: String,
    /// Either the partial-JSON string assembled from `ToolCallArgsDelta`
    /// fragments, or — when the provider emits `ToolCallComplete` with
    /// `full_args` — a serialized version of that value. Either way the
    /// dispatch loop parses this with `serde_json::from_str` before
    /// calling execute_tool.
    pub arguments: String,
}

/// Per-stream parser state. Provider impls own its content; the loop
/// just creates it fresh per round and threads it through
/// `parse_sse_line` calls.
#[derive(Default, Debug)]
pub struct ParserState {
    /// Anthropic reserved (currently unused): the most recent `event:`
    /// line, consumed by the next `data:` line. The typed JSON payload
    /// has its own `type` field so we don't actually need this today.
    pub pending_event_type: Option<String>,
    /// Gemini-only: monotonic counter for synthetic tool-call indices.
    /// Gemini emits functionCall parts without explicit indices; this
    /// assigns one in arrival order per round so the dispatch loop's
    /// HashMap can key them deterministically.
    pub tool_call_counter: u32,
}

/// The output of one streaming round: accumulated text and tool calls,
/// plus whether the model said "stop". Passed to
/// `LlmProvider::append_assistant_turn` so the provider can append in
/// its native message shape.
#[derive(Debug, Default)]
pub struct RoundOutput {
    pub text: String,
    /// Sorted by index for deterministic ordering.
    pub tool_calls: Vec<AccumulatedToolCall>,
    pub finish_reason: Option<String>,
}

/// One tool result produced by execute_tool, in the order the tools
/// were called. Passed to `LlmProvider::append_tool_results`.
#[derive(Debug)]
pub struct ToolResult {
    /// The provider-issued tool_call id (empty for Gemini which doesn't
    /// use ids — Gemini matches on name + ordering instead).
    pub call_id: String,
    pub name: String,
    pub result: String,
}
