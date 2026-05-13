// Tauri command entry point for chat completion plus the shared
// `ChatMessage` / `ChatResult` types. The OpenAI wire-format code now
// lives in `crate::llm::openai_impl`; Anthropic and Gemini still have
// their own modules until Phases 3 / 4 of the trait migration.

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
    messages: Vec<ChatMessage>,
    on_chunk: Channel<String>,
) -> Result<ChatResult, String> {
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
            crate::gemini::chat_complete(app, api_key, model, messages, on_chunk).await
        }
    }
}
