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

import { invoke } from "@tauri-apps/api/core";
import { takeReadySegment } from "../sentence-buffer";
import type { VoicevoxStyleKey } from "../voicevox-speakers";
import type { SpeechEngine, StreamingSpeaker } from "./types";

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
  let view: Uint8Array;
  if (bytes instanceof ArrayBuffer) {
    view = new Uint8Array(bytes);
  } else if (bytes instanceof Uint8Array) {
    view = bytes;
  } else if (Array.isArray(bytes)) {
    view = new Uint8Array(bytes);
  } else {
    throw new Error("unexpected bytes shape");
  }
  // Copy into a concrete ArrayBuffer: lib.dom now types Uint8Array over the
  // generic ArrayBufferLike (which may be SharedArrayBuffer), and Blob's
  // BlobPart only accepts an ArrayBuffer-backed view.
  const buf = new ArrayBuffer(view.byteLength);
  new Uint8Array(buf).set(view);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

// Sentiment heuristic for VOICEVOX style auto-switching. Picks a logical
// style key based on lexical markers in a single segment of synthesized
// text. Conservative on purpose: defaults to `normal` whenever no
// strong signal is present. The actual engine style id is resolved by
// the caller via the speaker's `styles` map; if a key isn't available
// for the active speaker it falls back to `normal` automatically.
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

export class VoicevoxEngine implements SpeechEngine {
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

  // Resolve the engine style id for a segment using the heuristic and
  // the speaker's available style map. Falls back to the base
  // speakerId when no specialized style is available.
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
