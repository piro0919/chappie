// Tauri command entry point for chat completion plus the shared
// `ChatMessage` / `ChatResult` types. All three providers (OpenAI,
// Anthropic, Gemini) implement `crate::llm::LlmProvider` and go through
// `crate::llm::dispatch::chat_complete_generic` — this file is just the
// detect-and-dispatch layer. The module retains its historical
// `openai` name because it owns the `#[tauri::command]` registered as
// `chat_complete` in `lib.rs`.

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChatResult {
    pub text: String,
    pub end_conversation: bool,
    /// Names of tools the LLM called during this turn, in the order they
    /// were invoked (across all rounds). Used by the golden tool-routing
    /// test to verify tool selection stability; renderer ignores it.
    #[serde(default)]
    pub tool_calls: Vec<String>,
}

#[tauri::command]
pub async fn chat_complete(
    app: tauri::AppHandle,
    api_key: String,
    model: String,
    mode: Option<String>,
    messages: Vec<ChatMessage>,
    on_chunk: Channel<String>,
) -> Result<ChatResult, String> {
    // Free mode bypasses provider detection and routes through the
    // chappie.kkweb.io proxy. The renderer doesn't pass an api_key for
    // this mode — we load the device id from disk and hand it to
    // ProxyProvider via the credential slot.
    if mode.as_deref() == Some("free") {
        let device_id = crate::device_id::get_or_init()?;
        // Model is fixed server-side (gemini-2.5-flash) but we still need
        // something for the request body's model name slot; the proxy
        // ignores it.
        let model = std::env::var("CHAPPIE_MODEL")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "gemini-2.5-flash".to_string());
        return crate::llm::dispatch::chat_complete_generic(
            &app,
            crate::llm::proxy_impl::ProxyProvider::new(),
            device_id,
            model,
            messages,
            on_chunk,
        )
        .await;
    }

    if api_key.trim().is_empty() {
        return Err("missing api key".into());
    }

    let provider = match crate::provider::detect_from_key(&api_key) {
        Some(p) => p,
        None => {
            return Err(
                "Unrecognized API key format. Use OpenAI (sk-...), Anthropic (sk-ant-...), or Gemini (AIza...).".into(),
            );
        }
    };
    let env_override = std::env::var("CHAPPIE_MODEL")
        .ok()
        .filter(|s| !s.trim().is_empty());

    match provider {
        crate::provider::Provider::OpenAI => {
            // OpenAI takes the renderer-supplied default unless CHAPPIE_MODEL
            // overrides; Anthropic / Gemini always start from the provider
            // default because the renderer hands us the OpenAI default.
            let model = env_override.unwrap_or(model);
            crate::llm::dispatch::chat_complete_generic(
                &app,
                crate::llm::openai_impl::OpenAiProvider,
                api_key,
                model,
                messages,
                on_chunk,
            )
            .await
        }
        crate::provider::Provider::Anthropic => {
            let model = env_override
                .unwrap_or_else(|| provider.default_model().to_string());
            crate::llm::dispatch::chat_complete_generic(
                &app,
                crate::llm::anthropic_impl::AnthropicProvider,
                api_key,
                model,
                messages,
                on_chunk,
            )
            .await
        }
        crate::provider::Provider::Gemini => {
            let model = env_override
                .unwrap_or_else(|| provider.default_model().to_string());
            crate::llm::dispatch::chat_complete_generic(
                &app,
                crate::llm::gemini_impl::GeminiProvider,
                api_key,
                model,
                messages,
                on_chunk,
            )
            .await
        }
    }
}
