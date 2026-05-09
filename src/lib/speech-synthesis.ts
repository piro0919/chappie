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

/** Speak a single utterance and resolve when it ends. Calls cancel() first
 *  so a previously wedged synthesis queue doesn't hold this one back.
 *  Use `speakQueued` for streaming where you want sentences to play
 *  back-to-back without canceling each other. */
export function speak(text: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();
    speakInternal(text, lang, resolve, reject);
  });
}

/** Like `speak`, but does NOT cancel any in-flight speech. Multiple calls
 *  in sequence form a continuous read-out — the WebKit synthesis queue
 *  itself plays them back-to-back. */
export function speakQueued(text: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    speakInternal(text, lang, resolve, reject);
  });
}

// Slightly faster than the default 1.0 rate. WebKit's Japanese voices
// sound a touch slow at 1.0, but 1.15 felt rushed in practice — 1.05
// keeps responsiveness without losing intelligibility.
const TTS_RATE = 1.05;

function speakInternal(
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

export function cancelSpeech(): void {
  window.speechSynthesis.cancel();
}

/** Sentence terminators we split streaming output on. Includes Japanese
 *  full-stop, exclamation, question, and ASCII variants. The ASCII period
 *  is only treated as a terminator when it isn't between digits — this
 *  keeps decimals like `39.6` intact so the streaming TTS doesn't
 *  helpfully split them into "39." and "6". */
const SENTENCE_TERMINATORS = /[。！？!?]+|(?<!\d)\.(?!\d)/g;

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
export function createStreamingSpeaker(lang: string): {
  feed: (chunk: string) => void;
  flush: () => Promise<void>;
} {
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

  const speakOne = (sentence: string) => {
    const utter = new SpeechSynthesisUtterance(sanitizeForTTS(sentence, lang));
    utter.rate = TTS_RATE;
    if (cachedVoice) {
      utter.voice = cachedVoice;
      utter.lang = cachedVoice.lang;
    } else {
      utter.lang = lang;
    }
    queuedCount++;
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
      // Greedy: extract every complete sentence visible in buffer right now.
      let lastEnd = 0;
      SENTENCE_TERMINATORS.lastIndex = 0;
      let match: RegExpExecArray | null = SENTENCE_TERMINATORS.exec(buffer);
      while (match !== null) {
        const end = match.index + match[0].length;
        const sentence = buffer.slice(lastEnd, end).trim();
        if (sentence) speakOne(sentence);
        lastEnd = end;
        match = SENTENCE_TERMINATORS.exec(buffer);
      }
      buffer = buffer.slice(lastEnd);
    },
    async flush() {
      const tail = buffer.trim();
      buffer = "";
      if (tail) speakOne(tail);
      // Wait until either: (a) every queued utterance has settled
      // (onend / onerror fired), or (b) WebKit's speaking/pending both
      // read false for two consecutive 30ms ticks. (a) is the truthful
      // signal but onend is laggy on JP voices; (b) is faster but flaps.
      // Combining them in a settled-count check that's also gated on the
      // flags going quiet gives us the earlier of the two.
      let consecutiveQuiet = 0;
      while (settledCount < queuedCount) {
        const quiet =
          !window.speechSynthesis.speaking && !window.speechSynthesis.pending;
        consecutiveQuiet = quiet ? consecutiveQuiet + 1 : 0;
        // 60ms quiet (two 30ms ticks with both flags down) — safe margin
        // against transient false flips between utterances. If the flags
        // say quiet, audio is really done; we don't have to wait for the
        // late onend.
        if (consecutiveQuiet >= 2) break;
        await new Promise((r) => setTimeout(r, 30));
      }
    },
  };
}
