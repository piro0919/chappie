// Clipboard read/write exposed as OpenAI tools so the user can hand the
// current clipboard contents to the model ("read what I copied") or push
// generated text into the clipboard ("copy that for me"). We use arboard
// directly from Rust because the tools execute in the chat_complete loop
// in the Rust process — no renderer involvement is needed.

use arboard::Clipboard;

pub fn read() -> Result<String, String> {
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    cb.get_text().map_err(|e| e.to_string())
}

pub fn write(text: &str) -> Result<(), String> {
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_text(text.to_string()).map_err(|e| e.to_string())
}
