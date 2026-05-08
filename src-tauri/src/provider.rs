// Provider abstraction. We auto-detect from the API key prefix so the
// settings UI stays a single text field — no provider dropdown to confuse
// general users. Three providers today:
//
//   - OpenAI: chat/completions wire format, `openai.rs::chat_complete`.
//   - Anthropic: Messages API, `anthropic.rs::chat_complete`.
//   - Gemini: generativelanguage.googleapis.com, `gemini.rs::chat_complete`.
//
// xAI / OpenRouter were dropped in 0.3.x — their voice-assistant fit was
// weak (xAI's tool calling was inconsistent on chappie's prompt;
// OpenRouter's underlying-model variance broke the latency / caching
// assumptions chappie relies on) and the maintenance burden didn't
// justify keeping them.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    OpenAI,
    Anthropic,
    Gemini,
}

impl Provider {
    /// Base URL for the chat/completions endpoint. Path is appended by the
    /// caller (e.g. `{base}/chat/completions` for OpenAI).
    pub fn base_url(self) -> &'static str {
        match self {
            Self::OpenAI => "https://api.openai.com/v1",
            Self::Anthropic => "https://api.anthropic.com/v1",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1beta",
        }
    }

    /// Sensible default model for each provider. Picked to be the cheapest
    /// "real" model that does tool calling well.
    ///
    /// Gemini: per Google's published rate limits (post Dec-2025 cuts),
    /// the free-tier daily ceiling is 250 RPD on `gemini-2.5-flash` and
    /// 1000 RPD on `gemini-2.5-flash-lite`. We pick flash because
    /// flash-lite is markedly weaker at function calling on Chappie's
    /// 12-tool prompt (sometimes returns an empty `parts` block with
    /// `finishReason=STOP`), and 250 RPD is plenty for casual daily use.
    /// Note: actual delivered quota varies by account — some users see
    /// throttling well below the official ceiling (down to ~20 RPD).
    /// Users who hit a hard wall need to enable billing on the Google
    /// Cloud project or switch providers; pinning to flash-lite via
    /// `CHAPPIE_MODEL` trades reliability for headroom that may not even
    /// materialize on a throttled account.
    pub fn default_model(self) -> &'static str {
        match self {
            Self::OpenAI => "gpt-4o-mini",
            Self::Anthropic => "claude-3-5-haiku-latest",
            Self::Gemini => "gemini-2.5-flash",
        }
    }

    /// Human-readable label for logs and (future) status surfaces.
    pub fn label(self) -> &'static str {
        match self {
            Self::OpenAI => "OpenAI",
            Self::Anthropic => "Anthropic",
            Self::Gemini => "Gemini",
        }
    }
}

/// Auto-detect the provider from the API key prefix. Returns None for
/// keys that don't match any supported provider (renderer should surface
/// this as "unknown key format" rather than silently falling back).
pub fn detect_from_key(api_key: &str) -> Option<Provider> {
    let key = api_key.trim();
    if key.starts_with("sk-ant-") {
        Some(Provider::Anthropic)
    } else if key.starts_with("sk-or-") {
        // Explicitly reject OpenRouter keys so they don't fall through to
        // the OpenAI branch via the `sk-` prefix and produce a confusing
        // OpenAI auth failure.
        None
    } else if key.starts_with("AIza") {
        Some(Provider::Gemini)
    } else if key.starts_with("sk-") {
        Some(Provider::OpenAI)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_known_prefixes() {
        assert_eq!(detect_from_key("sk-abc123"), Some(Provider::OpenAI));
        assert_eq!(detect_from_key("sk-ant-abc123"), Some(Provider::Anthropic));
        assert_eq!(detect_from_key("AIzaSy..."), Some(Provider::Gemini));
        assert_eq!(detect_from_key("  sk-x  "), Some(Provider::OpenAI));
    }

    #[test]
    fn rejects_unknown_prefixes() {
        assert_eq!(detect_from_key(""), None);
        assert_eq!(detect_from_key("xai-abc"), None);
        assert_eq!(detect_from_key("sk-or-abc"), None);
        assert_eq!(detect_from_key("garbage"), None);
    }
}
