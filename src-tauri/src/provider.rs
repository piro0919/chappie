// Provider abstraction. We auto-detect from the API key prefix so the
// settings UI stays a single text field — no provider dropdown to confuse
// general users. Three families today:
//
//   - OpenAI-compatible (OpenAI, xAI, OpenRouter, Together, Ollama, ...):
//     same chat/completions wire format, only the base URL differs. These
//     can all share `openai.rs::chat_complete`.
//   - Anthropic: Messages API, separate code path (not yet implemented).
//   - Gemini: generativelanguage.googleapis.com, separate code path
//     (not yet implemented).
//
// When you add support for a new provider, update `detect_from_key` and
// `Provider::endpoint` / `Provider::default_model`. If it's OpenAI-
// compatible, that's the entire change.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    OpenAI,
    XAI,
    OpenRouter,
    Anthropic,
    Gemini,
}

impl Provider {
    /// Whether this provider speaks the OpenAI chat/completions wire format.
    /// True providers can share the existing `openai.rs` implementation
    /// merely by swapping the base URL.
    pub fn is_openai_compatible(self) -> bool {
        matches!(self, Self::OpenAI | Self::XAI | Self::OpenRouter)
    }

    /// Base URL for the chat/completions endpoint. Path is appended by the
    /// caller (e.g. `{base}/chat/completions` for OpenAI-compatible).
    pub fn base_url(self) -> &'static str {
        match self {
            Self::OpenAI => "https://api.openai.com/v1",
            Self::XAI => "https://api.x.ai/v1",
            Self::OpenRouter => "https://openrouter.ai/api/v1",
            Self::Anthropic => "https://api.anthropic.com/v1",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1beta",
        }
    }

    /// Sensible default model for each provider. Picked to be the cheapest
    /// "real" model that does tool calling well. For Gemini we deliberately
    /// pick `flash-lite` over `flash` because the free-tier daily quota for
    /// `flash` is so low (20/day at the time of writing) that ad-hoc users
    /// run into 429s within minutes — `flash-lite` gives ~1000/day. Power
    /// users can override via the `CHAPPIE_MODEL` env var.
    pub fn default_model(self) -> &'static str {
        match self {
            Self::OpenAI => "gpt-4o-mini",
            Self::XAI => "grok-2-latest",
            Self::OpenRouter => "openai/gpt-4o-mini",
            Self::Anthropic => "claude-3-5-haiku-latest",
            Self::Gemini => "gemini-2.5-flash-lite",
        }
    }

    /// Human-readable label for logs and (future) status surfaces.
    pub fn label(self) -> &'static str {
        match self {
            Self::OpenAI => "OpenAI",
            Self::XAI => "xAI",
            Self::OpenRouter => "OpenRouter",
            Self::Anthropic => "Anthropic",
            Self::Gemini => "Gemini",
        }
    }
}

/// Auto-detect the provider from the API key prefix. Falls back to OpenAI
/// since `sk-` is the historical default and many self-hosted OpenAI-
/// compatible services reuse that scheme.
pub fn detect_from_key(api_key: &str) -> Provider {
    let key = api_key.trim();
    if key.starts_with("sk-ant-") {
        Provider::Anthropic
    } else if key.starts_with("sk-or-") {
        Provider::OpenRouter
    } else if key.starts_with("xai-") {
        Provider::XAI
    } else if key.starts_with("AIza") {
        Provider::Gemini
    } else {
        Provider::OpenAI
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_known_prefixes() {
        assert_eq!(detect_from_key("sk-abc123"), Provider::OpenAI);
        assert_eq!(detect_from_key("sk-ant-abc123"), Provider::Anthropic);
        assert_eq!(detect_from_key("sk-or-abc123"), Provider::OpenRouter);
        assert_eq!(detect_from_key("xai-abc123"), Provider::XAI);
        assert_eq!(detect_from_key("AIzaSy..."), Provider::Gemini);
        assert_eq!(detect_from_key("  sk-x  "), Provider::OpenAI);
        assert_eq!(detect_from_key(""), Provider::OpenAI);
    }
}
