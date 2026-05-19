// Free-mode proxy backend.
//
// Wire format is identical to Gemini — the proxy at chappie.kkweb.io/api/chat
// is a transparent SSE pass-through that just adds quota enforcement and
// injects the upstream `?key=...` server-side. So this provider delegates
// request/response shaping to `GeminiProvider` and only overrides:
//
// - `endpoint`: our proxy URL instead of the Google endpoint
// - `apply_auth`: `X-Chappie-Device-Id` + `X-Chappie-Turn-Id` headers
// - `label`: distinct log tag
//
// The trait's `api_key` slot carries the device id in this mode.
//
// turn_id is generated once per ProxyProvider instance (= once per
// `chat_complete` call). Every round of the tool-call loop reuses the
// same turn_id, so the proxy counts the whole turn as a single quota
// hit. Override the URL via the `CHAPPIE_PROXY_URL` env var for local dev.

use reqwest::RequestBuilder;
use serde_json::Value;
use uuid::Uuid;

use super::events::{ParserState, ProviderEvent, RoundOutput, ToolResult};
use super::gemini_impl::{GeminiProvider, GeminiState};
use super::LlmProvider;
use crate::openai::ChatMessage;

const DEFAULT_PROXY_URL: &str = "https://chappie.kkweb.io/api/chat";

pub struct ProxyProvider {
    inner: GeminiProvider,
    turn_id: String,
    /// Supabase access token (JWT) when the user is signed in. The proxy
    /// verifies it with SUPABASE_JWT_SECRET and bypasses the daily quota
    /// for accounts with an active Stripe subscription. Empty string =
    /// anonymous Free-mode request.
    subscription_token: String,
}

impl ProxyProvider {
    pub fn new() -> Self {
        Self::with_subscription(String::new())
    }

    pub fn with_subscription(token: String) -> Self {
        Self {
            inner: GeminiProvider,
            turn_id: Uuid::new_v4().to_string(),
            subscription_token: token,
        }
    }
}

fn proxy_url() -> String {
    std::env::var("CHAPPIE_PROXY_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_PROXY_URL.to_string())
}

impl LlmProvider for ProxyProvider {
    type State = GeminiState;

    fn label(&self) -> &'static str {
        "proxy"
    }

    fn endpoint(&self, _model: &str, _api_key: &str) -> String {
        proxy_url()
    }

    fn apply_auth(&self, req: RequestBuilder, device_id: &str) -> RequestBuilder {
        let mut req = req
            .header("X-Chappie-Device-Id", device_id)
            .header("X-Chappie-Turn-Id", &self.turn_id);
        if !self.subscription_token.is_empty() {
            req = req.header(
                "Authorization",
                format!("Bearer {}", self.subscription_token),
            );
        }
        // Pass the local analytics-consent state up to the proxy so it
        // can bump the Free daily quota when the user has opted in.
        // The header is advisory at this layer — the analytics event
        // ingestion endpoint re-verifies consent independently.
        if crate::analytics::consent() {
            req = req.header("X-Chappie-Analytics-Consent", "true");
        }
        req
    }

    fn prepare_state(&self, messages: Vec<ChatMessage>) -> Self::State {
        self.inner.prepare_state(messages)
    }

    fn build_body(&self, state: &Self::State, model: &str, tools: &Value) -> Value {
        self.inner.build_body(state, model, tools)
    }

    fn parse_sse_line(
        &self,
        data: &str,
        parser: &mut ParserState,
    ) -> Vec<ProviderEvent> {
        self.inner.parse_sse_line(data, parser)
    }

    fn append_assistant_turn(&self, state: &mut Self::State, round: &RoundOutput) {
        self.inner.append_assistant_turn(state, round)
    }

    fn append_tool_results(&self, state: &mut Self::State, results: &[ToolResult]) {
        self.inner.append_tool_results(state, results)
    }
}
