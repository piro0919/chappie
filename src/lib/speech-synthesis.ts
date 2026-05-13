// TTS facade. The renderer talks to one `SpeechEngine` at a time.
// Today there are two implementations: `WebSpeechEngine` (browser
// speechSynthesis, the default for every language) and `VoicevoxEngine`
// (HTTP to a locally-running VOICEVOX engine, opt-in via Settings,
// Japanese-only).
//
// The legacy top-level functions (`speak`, `speakQueued`, `cancelSpeech`,
// `createStreamingSpeaker`) are kept as thin wrappers so existing call
// sites in `useConversationLoop.ts` don't have to know which engine is
// active. Engine selection happens inside `getEngine()`, keyed off the
// current `EngineOpts` set via `setEngineOpts()` from the conversation
// loop on settings load and on `settings:updated`.

import type { SpeechEngine, StreamingSpeaker } from "./speech-engines/types";
import { VoicevoxEngine } from "./speech-engines/voicevox";
import { WebSpeechEngine } from "./speech-engines/web-speech";
import type { VoicevoxStyleKey } from "./voicevox-speakers";

export type { SpeechEngine, StreamingSpeaker } from "./speech-engines/types";

/** Engine selection inputs. Set by `setEngineOpts()` from the conversation
 *  loop on settings load and on `settings:updated`. `voicevox.enabled`
 *  alone doesn't force VOICEVOX — `getEngine()` also checks `lang`, since
 *  VOICEVOX only does Japanese. `styles` is the per-character logical-
 *  emotion → engine-style-id map; when present, the engine picks a
 *  variant id per spoken segment based on a sentiment heuristic. */
export interface EngineOpts {
  voicevox?: {
    enabled: boolean;
    speakerId: number;
    styles?: Partial<Record<VoicevoxStyleKey, number>>;
  };
}

const webSpeech = new WebSpeechEngine();
let activeOpts: EngineOpts | undefined;

// Cached VOICEVOX engine instance, recreated when speakerId changes so
// consecutive turns reuse the same Web Audio scheduling state.
let cachedVoicevox: VoicevoxEngine | null = null;
let cachedVoicevoxSpeakerId: number | null = null;

export function setEngineOpts(opts: EngineOpts | undefined): void {
  const prevSpeaker = cachedVoicevoxSpeakerId;
  const nextEnabled = opts?.voicevox?.enabled ?? false;
  const nextSpeaker = opts?.voicevox?.speakerId;
  console.info(
    `[voicevox] setEngineOpts enabled=${nextEnabled} speaker=${nextSpeaker} prev=${prevSpeaker} cached=${cachedVoicevox !== null}`,
  );
  activeOpts = opts;
  // Speaker changed (or VOICEVOX disabled): cancel the prior engine's
  // in-flight audio. Without this, two voices overlap on the shared
  // AudioContext when the user chains different character wake-words.
  // For SAME-speaker consecutive wakes we DON'T hit this branch — the
  // cached engine is reused and its scheduled audio plays out, with the
  // new turn's segments queued after via `nextStartTime` chaining.
  if (cachedVoicevox && (!nextEnabled || nextSpeaker !== prevSpeaker)) {
    cachedVoicevox.cancel();
    cachedVoicevox = null;
    cachedVoicevoxSpeakerId = null;
  }
}

/** Pick the engine for this utterance. VOICEVOX only kicks in for `ja`
 *  when explicitly enabled in Settings; everything else stays on
 *  `WebSpeechEngine`. Call sites should not cache the result — settings
 *  can change between utterances (Settings hot-reload). */
export function getEngine(lang: string, opts?: EngineOpts): SpeechEngine {
  const vv = opts?.voicevox;
  if (vv?.enabled && lang.toLowerCase().startsWith("ja")) {
    if (!cachedVoicevox || cachedVoicevoxSpeakerId !== vv.speakerId) {
      console.info(
        `[voicevox] getEngine creating new engine for speaker=${vv.speakerId}${vv.styles ? ` styles=${Object.keys(vv.styles).join(",")}` : ""}`,
      );
      cachedVoicevox = new VoicevoxEngine(vv.speakerId, vv.styles);
      cachedVoicevoxSpeakerId = vv.speakerId;
    }
    return cachedVoicevox;
  }
  return webSpeech;
}

// ---------------------------------------------------------------------------
// Backward-compatible top-level exports. Existing call sites in
// `useConversationLoop.ts` use these directly; they delegate to whichever
// engine `getEngine()` selects.

export function speak(text: string, lang: string): Promise<void> {
  return getEngine(lang, activeOpts).speak(text, lang);
}

export function speakQueued(text: string, lang: string): Promise<void> {
  return getEngine(lang, activeOpts).speakQueued(text, lang);
}

export function cancelSpeech(): void {
  webSpeech.cancel();
  cachedVoicevox?.cancel();
}

export function createStreamingSpeaker(lang: string): StreamingSpeaker {
  return getEngine(lang, activeOpts).createStreamingSpeaker(lang);
}
