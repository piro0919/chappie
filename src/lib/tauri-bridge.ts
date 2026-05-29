// Thin wrappers around Tauri commands that don't need any hook state.
// Extracted from useConversationLoop so unrelated views (HUD, settings,
// debug overlays) can call them without dragging the hook in, and so
// the hook body stops being the home for trivial invoke shims.

import { invoke } from "@tauri-apps/api/core";

// Show `text` on the always-on-top HUD. Duration scales with text
// length (200ms per char) and is clamped to 5–45 s so a short reply
// doesn't disappear before the user can read it and a very long one
// doesn't loiter forever.
export async function showOnHud(text: string): Promise<void> {
  const duration = Math.max(5000, Math.min(45000, text.length * 200));
  console.info(`[loop] hud_show chars=${text.length} dur=${duration}`);
  try {
    await invoke("hud_show", { text, durationMs: duration });
  } catch (e) {
    console.error("[loop] hud_show invoke failed", e);
  }
}

// True when the system output volume is muted. Used to branch the TTS
// pipeline at first-chunk time — muted → buffer everything and show on
// HUD instead of streaming through speechSynthesis. Returns false on
// any invoke error so a transient IPC failure doesn't silently swallow
// the reply.
export async function isSystemMuted(): Promise<boolean> {
  try {
    const m = (await invoke<boolean>("is_muted")) === true;
    console.info(`[loop] is_muted -> ${m}`);
    return m;
  } catch (e) {
    console.warn("[loop] is_muted failed", e);
    return false;
  }
}

// When true, Chappie routes all spoken output to the HUD while another app
// is using the mic (a call / recording). Mirrored from the
// `suppressWhileExternalMicActive` setting on load + settings:updated; off
// by default so detection is never even queried unless the user opted in.
let suppressOnExternalMic = false;

export function setSuppressOnExternalMic(enabled: boolean): void {
  suppressOnExternalMic = enabled;
}

// True when another app is currently capturing mic input (and the feature
// is enabled). Cheap CoreAudio per-process query; false on any error or on
// macOS < 14 so a failure never wrongly silences the assistant.
async function isExternalMicActive(): Promise<boolean> {
  if (!suppressOnExternalMic) return false;
  try {
    const active = (await invoke<boolean>("is_external_mic_active")) === true;
    if (active) console.info("[loop] external mic active -> suppressing TTS");
    return active;
  } catch (e) {
    console.warn("[loop] is_external_mic_active failed", e);
    return false;
  }
}

// Single gate for "should this turn's audio be suppressed and shown on the
// HUD instead?". True when the system is muted OR (opt-in) another app holds
// the mic. Every TTS-routing decision in the conversation loop funnels
// through here so the two suppression reasons share one code path.
export async function shouldSuppressAudioOutput(): Promise<boolean> {
  if (await isSystemMuted()) return true;
  return isExternalMicActive();
}
