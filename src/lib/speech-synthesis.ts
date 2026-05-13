// TTS abstraction. The renderer talks to one `SpeechEngine` at a time.
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

import { invoke } from "@tauri-apps/api/core";
import { takeReadySegment } from "./sentence-buffer";
import type { VoicevoxStyleKey } from "./voicevox-speakers";

/** Massage text just before it goes to the synthesizer so cosmetic glitches
 *  in model output don't bleed into the spoken reply. Currently only the
 *  Japanese path needs help: weaker models (flash-lite, in particular)
 *  don't reliably follow the system prompt's "write 17.3 as 17点3" rule,
 *  so we substitute decimals → 点 here as a belt-and-braces fallback.
 *  Punctuation forms like 14:30 also read poorly in Japanese voices but
 *  triggering on `\d+:\d+` risks false positives (URLs, ratios), so we
 *  leave that to the prompt. */
function sanitizeForTTS(text: string, lang: string): string {
  if (lang.toLowerCase().startsWith("ja")) {
    return text.replace(/(\d+)\.(\d+)/g, "$1点$2");
  }
  return text;
}

/** Pick a voice that matches `lang` (e.g. "ja", "en", "es"). Prefers
 *  voices flagged `localService` (system-installed, usually higher
 *  quality) over remote ones. Falls back to whatever voice WebKit picks
 *  if nothing matches. */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const matches = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(lang.toLowerCase()),
  );
  if (matches.length === 0) return null;
  const local = matches.find((v) => v.localService);
  return local ?? matches[0];
}

// Slightly faster than the default 1.0 rate. WebKit's Japanese voices
// sound a touch slow at 1.0, but 1.15 felt rushed in practice — 1.05
// keeps responsiveness without losing intelligibility.
const TTS_RATE = 1.05;

/** Streaming speaker handle returned by `SpeechEngine.createStreamingSpeaker`.
 *  Feed it text chunks as they arrive; flush after no more chunks come. */
export interface StreamingSpeaker {
  feed: (chunk: string) => void;
  flush: () => Promise<void>;
}

/** Common surface every TTS backend implements. Engines may translate the
 *  semantics differently (Web Speech uses the browser's native queue,
 *  VOICEVOX fans out per-sentence HTTP calls and plays via Web Audio),
 *  but call sites only see this interface. */
export interface SpeechEngine {
  speak(text: string, lang: string): Promise<void>;
  speakQueued(text: string, lang: string): Promise<void>;
  cancel(): void;
  createStreamingSpeaker(lang: string): StreamingSpeaker;
}

class WebSpeechEngine implements SpeechEngine {
  speak(text: string, lang: string): Promise<void> {
    return new Promise((resolve, reject) => {
      window.speechSynthesis.cancel();
      this.speakInternal(text, lang, resolve, reject);
    });
  }

  speakQueued(text: string, lang: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.speakInternal(text, lang, resolve, reject);
    });
  }

  cancel(): void {
    window.speechSynthesis.cancel();
  }

  private speakInternal(
    text: string,
    lang: string,
    resolve: () => void,
    reject: (err: Error) => void,
  ): void {
    const utter = new SpeechSynthesisUtterance(sanitizeForTTS(text, lang));
    utter.rate = TTS_RATE;
    const voice = pickVoice(lang);
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = lang;
    }
    utter.onend = () => resolve();
    utter.onerror = (e) => {
      // The interrupted/canceled errors fire when cancelSpeech() is called
      // (e.g. for barge-in). Treat as a successful cancellation rather than
      // a hard failure so the conversation loop can move on.
      if (e.error === "interrupted" || e.error === "canceled") {
        resolve();
        return;
      }
      reject(new Error(`speech synthesis error: ${e.error}`));
    };
    window.speechSynthesis.speak(utter);
  }

  /** Streaming speaker. Feed it text chunks as they arrive; it accumulates
   *  until a sentence terminator is seen, then queues the sentence for TTS.
   *  Returns a `flush` that you must await after no more chunks will come —
   *  it speaks any remaining buffer and resolves once everything has played.
   *
   *  Sentences are pushed straight into WebKit's native synthesis queue
   *  (rather than chained via JS Promises) so they play back-to-back without
   *  the per-utterance gap that `chain.then(speakQueued(...))` introduced.
   *  Completion is detected by polling `synthesis.speaking / pending` —
   *  `utter.onend` fires 1-3 s late on macOS Japanese voices (Kyoko / Otoya),
   *  which used to leave the tray stuck in "speaking" after audio actually
   *  ended. */
  createStreamingSpeaker(lang: string): StreamingSpeaker {
    // Clear any wedged queue from a previous turn before we start adding to it.
    window.speechSynthesis.cancel();

    let buffer = "";
    const cachedVoice = pickVoice(lang);

    // Track utterances explicitly. WebKit's speaking/pending flags get
    // wedged true for up to a few seconds after audio actually ends on
    // macOS Japanese voices (Kyoko / Otoya), and onend can fire late.
    // Using our own per-utterance settled count plus a wall-clock cap is
    // more reliable than trusting either WebKit signal alone.
    let queuedCount = 0;
    let settledCount = 0;
    // Wall-clock estimate of when the queued audio should be done playing.
    // Updated as each utterance is queued; used as a fallback exit
    // condition in flush() because macOS Japanese voices wedge the
    // speaking/pending flags true and fire onend several seconds late
    // after audio actually ends — without this the tray sits in
    // "speaking" state long after silence.
    //
    // Char rates are ballpark from observation:
    //   JP: ~7 chars/sec at rate 1.05 ≈ 145ms/char
    //   EN: ~15 chars/sec at rate 1.05 ≈ 67ms/char
    // Better to overshoot than undershoot — a too-small estimate cuts the
    // tail off; the +400ms padding gives margin.
    const isJa = lang.toLowerCase().startsWith("ja");
    const MS_PER_CHAR = isJa ? 145 : 70;
    const ESTIMATE_PADDING_MS = 400;
    let firstSpeakAt: number | null = null;
    let estimatedTotalDurationMs = 0;

    const speakOne = (sentence: string) => {
      const utter = new SpeechSynthesisUtterance(
        sanitizeForTTS(sentence, lang),
      );
      utter.rate = TTS_RATE;
      if (cachedVoice) {
        utter.voice = cachedVoice;
        utter.lang = cachedVoice.lang;
      } else {
        utter.lang = lang;
      }
      queuedCount++;
      estimatedTotalDurationMs += sentence.length * MS_PER_CHAR;
      if (firstSpeakAt === null) firstSpeakAt = Date.now();
      const settle = () => {
        settledCount++;
      };
      utter.onend = settle;
      utter.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.error("speak failed", e.error);
        }
        settle();
      };
      window.speechSynthesis.speak(utter);
    };

    return {
      feed(chunk: string) {
        buffer += chunk;
        while (true) {
          const ready = takeReadySegment(buffer, queuedCount > 0);
          if (!ready) break;
          if (ready.segment) speakOne(ready.segment);
          buffer = ready.remaining;
        }
      },
      async flush() {
        const tail = buffer.trim();
        buffer = "";
        if (tail) speakOne(tail);
        // Three exit conditions, whichever comes first:
        //   (a) every queued utterance has settled (onend/onerror) AND
        //       the flags read quiet — truthful but onend is slow on JP;
        //   (b) flags read quiet for 2 consecutive 30ms ticks — faster
        //       but can flap during inter-utterance gaps;
        //   (c) wall-clock exceeded the estimated audio duration + pad —
        //       last resort for when the macOS JP voices wedge their
        //       flags true past the actual audio end (the bug this
        //       block primarily exists to work around).
        let consecutiveQuiet = 0;
        while (settledCount < queuedCount) {
          const quiet =
            !window.speechSynthesis.speaking && !window.speechSynthesis.pending;
          consecutiveQuiet = quiet ? consecutiveQuiet + 1 : 0;
          if (consecutiveQuiet >= 2) break;
          if (
            firstSpeakAt !== null &&
            Date.now() - firstSpeakAt >
              estimatedTotalDurationMs + ESTIMATE_PADDING_MS
          ) {
            break;
          }
          await new Promise((r) => setTimeout(r, 30));
        }
      },
    };
  }
}

// ---------------------------------------------------------------------------
// VOICEVOX engine. Opt-in via wake-word; Japanese only.
//
// Each utterance is synthesized via the Rust `voicevox_synthesize` Tauri
// command (which talks to `localhost:50021`), the resulting WAV bytes
// are wrapped in a Blob URL and played via a plain `HTMLAudioElement`.
//
// Why HTMLAudioElement instead of Web Audio API: the AudioContext
// approach was repeatedly fragile in the hidden-window WKWebView
// environment — context state would read "running" while the underlying
// output pipeline silently dropped audio after backgrounding (e.g. when
// the Settings window took focus), and there was no reliable signal to
// detect it. HTMLAudioElement bypasses all of that: each <audio> is an
// independent media session, the browser handles output device routing,
// and `onended` is the truthful signal. The cost is ~50–100ms gap
// between consecutive segments instead of the precise sample-accurate
// chaining Web Audio gave us; for conversational TTS that's invisible.
//
// Sequential ordering is enforced by chaining each segment's `play()`
// onto the previous segment's `onended`. Synthesis still runs in
// parallel (the latency win) — only the playback step is serialized.
//
// Failure mode (engine not running, synthesis error, play() rejection)
// is silent + a brief HUD via `hud_show`. We deliberately do NOT fall
// back to Web Speech: the user picked a VOICEVOX character explicitly,
// hearing the system voice mid-conversation would be more confusing
// than silence.

const VOICEVOX_HUD_DURATION_MS = 2500;

async function showVoicevoxError(detail: string): Promise<void> {
  console.error("[voicevox]", detail);
  try {
    await invoke("hud_show", {
      text: "VOICEVOX が応答しません",
      durationMs: VOICEVOX_HUD_DURATION_MS,
    });
  } catch (e) {
    console.error("[voicevox] hud_show invoke failed", e);
  }
}

function bytesToBlobUrl(bytes: number[] | Uint8Array | ArrayBuffer): string {
  let buf: ArrayBuffer | Uint8Array;
  if (bytes instanceof ArrayBuffer) {
    buf = bytes;
  } else if (bytes instanceof Uint8Array) {
    buf = bytes;
  } else if (Array.isArray(bytes)) {
    buf = new Uint8Array(bytes);
  } else {
    throw new Error("unexpected bytes shape");
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

/** Sentiment heuristic for VOICEVOX style auto-switching. Picks a logical
 *  style key based on lexical markers in a single segment of synthesized
 *  text. Conservative on purpose: defaults to `normal` whenever no
 *  strong signal is present. The actual engine style id is resolved by
 *  the caller via the speaker's `styles` map; if a key isn't available
 *  for the active speaker it falls back to `normal` automatically. */
function pickStyleKey(text: string): VoicevoxStyleKey {
  // Order matters: tsun and sad both look "negative" in lexicon, but
  // tsun-leaning markers (refusal / annoyance) win over sad (apology /
  // weakness) when both fire — they sound more distinct on VOICEVOX
  // characters that have ツンツン styles.
  if (
    /(うれし|嬉し|だいすき|大好き|すごい|凄い|ありがと|やった|かわい|可愛い|いいね|最高|たのし|楽し|だいじょうぶ)/.test(
      text,
    )
  ) {
    return "sweet";
  }
  if (
    /(もう[!！。、 ]|だめ|ダメ|やだ|嫌|うるさ|しらない|知らない|べつに|別に|ふん[、。!！]|ふざけ)/.test(
      text,
    )
  ) {
    return "tsun";
  }
  if (
    /(ごめん|すまな|すみません|残念|ざんねん|わからない|分からない|難しい|むずかし|つらい|辛い|だめだった|失敗)/.test(
      text,
    )
  ) {
    return "sad";
  }
  if (
    /(絶対|ぜったい|まちがいない|間違いない|大事|だいじ|必ず|かならず|任せ|まかせ|やる[!！。])/.test(
      text,
    )
  ) {
    return "strong";
  }
  return "normal";
}

class VoicevoxEngine implements SpeechEngine {
  private speakerId: number;
  // Logical-emotion → engine-style-id map. When set, per-segment
  // synthesis picks an id from here based on `pickStyleKey(text)`;
  // missing keys fall back to the base `speakerId`. When undefined,
  // every segment uses `speakerId`.
  private styles?: Partial<Record<VoicevoxStyleKey, number>>;
  // Audio elements currently playing or queued. cancel() pauses each
  // and revokes its blob URL. Removed when `ended` fires naturally.
  private active: Set<HTMLAudioElement> = new Set();
  // Resolves when the last queued segment finishes playing. New
  // submissions chain their own play() onto this so segments play in
  // submit order without overlapping. Reset to a resolved promise on
  // cancel() so the next segment can start immediately.
  private playChain: Promise<void> = Promise.resolve();
  // Set true by cancel() (e.g. voice barge-in). synthAndPlay and the
  // streaming flush check this and return immediately so a cancelled
  // turn doesn't keep synthesizing / waiting on already-stopped audio.
  // Reset to false at the start of each new speak / streaming session
  // so subsequent turns work normally.
  private aborted = false;

  constructor(
    speakerId: number,
    styles?: Partial<Record<VoicevoxStyleKey, number>>,
  ) {
    this.speakerId = speakerId;
    this.styles = styles;
  }

  /** Resolve the engine style id for a segment using the heuristic and
   *  the speaker's available style map. Falls back to the base
   *  speakerId when no specialized style is available. */
  private resolveStyleId(text: string): number {
    if (!this.styles) return this.speakerId;
    const key = pickStyleKey(text);
    const id = this.styles[key];
    return id ?? this.speakerId;
  }

  async speak(text: string, _lang: string): Promise<void> {
    this.cancel();
    this.aborted = false;
    return this.synthAndPlay(text, this.resolveStyleId(text));
  }

  async speakQueued(text: string, _lang: string): Promise<void> {
    if (this.aborted) this.aborted = false;
    return this.synthAndPlay(text, this.resolveStyleId(text));
  }

  cancel(): void {
    this.aborted = true;
    for (const audio of this.active) {
      try {
        audio.pause();
        // Force the once-bound 'error' handler to settle the awaiting
        // synthAndPlay promise. Without this dispatch, pause() + src=""
        // typically don't fire 'ended' or 'error', leaving any
        // `await flush()` chain hanging.
        audio.dispatchEvent(new Event("error"));
        audio.src = "";
      } catch {
        // Already stopped — ignore.
      }
    }
    this.active.clear();
    this.playChain = Promise.resolve();
  }

  createStreamingSpeaker(_lang: string): StreamingSpeaker {
    // Don't cancel — let any in-flight audio from a previous turn play
    // out. New segments queue via playChain so they slot in after
    // existing audio without overlap. For one-shot barge-in semantics,
    // use speak() instead — it cancels first by design.
    this.aborted = false;
    let buffer = "";
    let queued = 0;
    const inflight: Promise<void>[] = [];

    const submit = (segment: string) => {
      if (this.aborted) return;
      queued++;
      inflight.push(this.synthAndPlay(segment, this.resolveStyleId(segment)));
    };

    return {
      feed: (chunk: string) => {
        if (this.aborted) return;
        buffer += chunk;
        while (true) {
          const ready = takeReadySegment(buffer, queued > 0);
          if (!ready) break;
          if (ready.segment) submit(ready.segment);
          buffer = ready.remaining;
        }
      },
      flush: async () => {
        if (this.aborted) return;
        const tail = buffer.trim();
        buffer = "";
        if (tail) submit(tail);
        // Each synthAndPlay resolves on the audio element's `ended`
        // event (or the dispatched 'error' event in cancel()), so
        // awaiting all inflight = waiting for every segment to finish
        // or be aborted. No extra wall-clock fudge needed.
        await Promise.all(inflight);
      },
    };
  }

  private async synthAndPlay(text: string, styleId?: number): Promise<void> {
    // First abort gate: skip if cancelled before we even started.
    if (this.aborted) return;
    const effectiveSpeakerId = styleId ?? this.speakerId;
    const tag = `[voicevox] spk=${effectiveSpeakerId}${
      effectiveSpeakerId !== this.speakerId ? `(base=${this.speakerId})` : ""
    } len=${text.length}`;
    console.info(`${tag} synth start "${text.slice(0, 20)}…"`);
    const t0 = performance.now();
    let bytes: number[] | Uint8Array | ArrayBuffer;
    try {
      bytes = await invoke("voicevox_synthesize", {
        text,
        speakerId: effectiveSpeakerId,
      });
    } catch (e) {
      await showVoicevoxError(`synthesize failed: ${e}`);
      return;
    }
    console.info(`${tag} synth done ${(performance.now() - t0).toFixed(0)}ms`);

    // Second abort gate: cancel may have fired during the (typically
    // multi-second) synthesis call. Bail before allocating a Blob.
    if (this.aborted) return;

    let url: string;
    try {
      url = bytesToBlobUrl(bytes);
    } catch (e) {
      console.error("[voicevox] blob conversion failed", bytes);
      await showVoicevoxError(`blob conversion failed: ${e}`);
      return;
    }

    // Capture the previous chain end and chain THIS segment's play()
    // onto it. Update playChain so the next submit chains onto us.
    // Synthesis already ran in parallel; only playback is serialized.
    const myPrev = this.playChain;
    let resolveMine: () => void = () => {};
    this.playChain = new Promise<void>((r) => {
      resolveMine = r;
    });

    try {
      await myPrev;
    } catch {
      // Previous failed; we still play ours.
    }

    // Third abort gate: this is the critical one for voice barge-in.
    // While we were waiting in the play chain, cancel() may have run.
    // Without this check the segment would create a fresh <audio> and
    // start playback AFTER the cancel — making barge-in look broken
    // ("止まらない") because the head segment got cut but the queued
    // ones rolled in immediately after. resolveMine() unblocks any
    // segment further down the chain so they can also bail at this
    // same gate (cascade).
    if (this.aborted) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      resolveMine();
      return;
    }

    const audio = new Audio(url);
    this.active.add(audio);
    const tStart = performance.now();

    return new Promise<void>((resolve) => {
      const settle = () => {
        console.info(
          `${tag} ended after ${(performance.now() - tStart).toFixed(0)}ms`,
        );
        this.active.delete(audio);
        try {
          URL.revokeObjectURL(url);
        } catch {}
        resolveMine();
        resolve();
      };
      audio.addEventListener("ended", settle, { once: true });
      audio.addEventListener(
        "error",
        () => {
          // cancel() dispatches a synthetic 'error' to settle this
          // promise; in that case audio.error is null. Only log when
          // we have a real error object (real playback failure).
          if (audio.error) {
            console.error(`[voicevox] audio error`, audio.error);
          }
          settle();
        },
        { once: true },
      );
      audio.play().catch((e) => {
        // Likewise: if cancel() set src="" mid-play, the rejection is
        // expected and not a real failure. Suppress the noise.
        if (!this.aborted) {
          console.error(`[voicevox] audio.play() rejected`, e);
        }
        settle();
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Engine selection + module-level state.

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
