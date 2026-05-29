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

// Where a turn's output should go:
//   "voice"  → speak (normal)
//   "hud"    → no voice, show text on the HUD
//   "silent" → no voice, no HUD (drop)
export type OutputMode = "voice" | "hud" | "silent";

// What to do while another app is capturing the mic. Mirrored from the
// `externalMicOutputMode` setting on load + settings:updated. "voice" (the
// default) means the feature is off, so detection is never even queried.
let externalMicMode: OutputMode = "voice";

export function setExternalMicMode(mode: OutputMode): void {
  externalMicMode = mode;
}

// True when another app is currently capturing mic input. Cheap CoreAudio
// per-process query; false on any error or on macOS < 14 so a failure never
// wrongly silences the assistant.
async function isExternalMicActive(): Promise<boolean> {
  try {
    const active = (await invoke<boolean>("is_external_mic_active")) === true;
    if (active)
      console.info(`[loop] external mic active -> ${externalMicMode}`);
    return active;
  } catch (e) {
    console.warn("[loop] is_external_mic_active failed", e);
    return false;
  }
}

// Single resolver every TTS-routing decision funnels through. System mute
// always routes to the HUD (unchanged behavior). Otherwise, when the user
// opted in and another app holds the mic, apply their chosen mode.
export async function resolveOutputMode(): Promise<OutputMode> {
  if (await isSystemMuted()) return "hud";
  if (externalMicMode !== "voice" && (await isExternalMicActive())) {
    return externalMicMode;
  }
  return "voice";
}
