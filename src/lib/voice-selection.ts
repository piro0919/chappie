// Wake-word → voice + tray icon resolution. Pure: given a VOICEVOX
// speaker id (or undefined for chappie's own voice), return the
// EngineOpts and tray-icon character key the rest of the system needs.
//
// Extracted from useConversationLoop's `applyVoiceForWake` so it can be
// unit-tested and so the hook only owns the side-effect plumbing
// (setEngineOpts, invoke("set_tray_character"), ref update).

import type { EngineOpts } from "./speech-synthesis";
import { VOICEVOX_CURATED_SPEAKERS } from "./voicevox-speakers";

export interface VoiceSelection {
  engineOpts: EngineOpts;
  trayCharacter: string;
}

// Resolve the voice + tray icon for a wake-word. `undefined` means
// chappie's own voice (Web Speech, default tray); a known speaker id
// switches to VOICEVOX with the speaker's curated style map. Unknown
// speaker ids still produce a valid VOICEVOX selection — the engine
// will speak with the base speaker id and no style variation, and the
// tray falls back to "chappie".
export function resolveVoiceForWake(
  speakerId: number | undefined,
): VoiceSelection {
  if (speakerId === undefined) {
    return {
      engineOpts: { voicevox: { enabled: false, speakerId: 0 } },
      trayCharacter: "chappie",
    };
  }
  const speaker = VOICEVOX_CURATED_SPEAKERS.find((s) => s.id === speakerId);
  return {
    engineOpts: {
      voicevox: {
        enabled: true,
        speakerId,
        styles: speaker?.styles,
      },
    },
    trayCharacter: speaker?.trayCharacter ?? "chappie",
  };
}
