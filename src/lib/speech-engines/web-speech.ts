// Browser-native TTS via window.speechSynthesis. Default engine for
// every language. macOS-specific quirks (Japanese voice flag-wedge bug)
// are documented inline.

import { takeReadySegment } from "../sentence-buffer";
import type { SpeechEngine, StreamingSpeaker } from "./types";

// Massage text just before it goes to the synthesizer so cosmetic
// glitches in model output don't bleed into the spoken reply. Currently
// only the Japanese path needs help: weaker models (flash-lite, in
// particular) don't reliably follow the system prompt's "write 17.3 as
// 17点3" rule, so we substitute decimals → 点 here as a belt-and-braces
// fallback. Punctuation forms like 14:30 also read poorly in Japanese
// voices but triggering on `\d+:\d+` risks false positives (URLs,
// ratios), so we leave that to the prompt.
function sanitizeForTTS(text: string, lang: string): string {
  if (lang.toLowerCase().startsWith("ja")) {
    return text.replace(/(\d+)\.(\d+)/g, "$1点$2");
  }
  return text;
}

// Pick a voice that matches `lang` (e.g. "ja", "en", "es"). Prefers
// voices flagged `localService` (system-installed, usually higher
// quality) over remote ones. Falls back to whatever voice WebKit picks
// if nothing matches.
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

export class WebSpeechEngine implements SpeechEngine {
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

  // Streaming speaker. Feed it text chunks as they arrive; it accumulates
  // until a sentence terminator is seen, then queues the sentence for TTS.
  // Returns a `flush` that you must await after no more chunks will come —
  // it speaks any remaining buffer and resolves once everything has played.
  //
  // Sentences are pushed straight into WebKit's native synthesis queue
  // (rather than chained via JS Promises) so they play back-to-back without
  // the per-utterance gap that `chain.then(speakQueued(...))` introduced.
  // Completion is detected by polling `synthesis.speaking / pending` —
  // `utter.onend` fires 1-3 s late on macOS Japanese voices (Kyoko / Otoya),
  // which used to leave the tray stuck in "speaking" after audio actually
  // ended.
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
