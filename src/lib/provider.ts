// Mirrors `src-tauri/src/provider.rs::detect_from_key`. Pure prefix match —
// the renderer uses it just to show the user which provider their key
// belongs to; the actual HTTP routing happens in Rust.

export type Provider = "openai" | "anthropic" | "gemini";

export function detectProvider(key: string): Provider | null {
  const k = key.trim();
  if (!k) return null;
  // Order matters: longer prefixes must come before shorter ones.
  if (k.startsWith("sk-ant-")) return "anthropic";
  // Explicitly reject OpenRouter keys so they don't fall through to the
  // OpenAI branch via the `sk-` prefix.
  if (k.startsWith("sk-or-")) return null;
  if (k.startsWith("AIza")) return "gemini";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

export function providerLabel(p: Provider): string {
  switch (p) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Gemini";
  }
}
