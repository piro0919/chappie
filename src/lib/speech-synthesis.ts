/** Speak a single utterance and resolve when it ends. Calls cancel() first
 *  so a previously wedged synthesis queue doesn't hold this one back.
 *  Use `speakQueued` for streaming where you want sentences to play
 *  back-to-back without canceling each other. */
export function speak(text: string, voiceURI: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();
    speakInternal(text, voiceURI, resolve, reject);
  });
}

/** Like `speak`, but does NOT cancel any in-flight speech. Multiple calls
 *  in sequence form a continuous read-out — the WebKit synthesis queue
 *  itself plays them back-to-back. */
export function speakQueued(
  text: string,
  voiceURI: string | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    speakInternal(text, voiceURI, resolve, reject);
  });
}

// Slightly faster than the default 1.0 rate. WebKit's Japanese voices
// sound a touch slow at 1.0; bumping to 1.15 keeps clarity while making
// the conversation feel more responsive.
const TTS_RATE = 1.15;

function speakInternal(
  text: string,
  voiceURI: string | null,
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = TTS_RATE;
  if (voiceURI) {
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.voiceURI === voiceURI);
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    }
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
 *  full-stop, exclamation, question, and ASCII variants. */
const SENTENCE_TERMINATORS = /[。！？.!?]+/g;

/** Streaming speaker. Feed it text chunks as they arrive; it accumulates
 *  until a sentence terminator is seen, then queues the sentence for TTS.
 *  Returns a `flush` that you must await after no more chunks will come —
 *  it speaks any remaining buffer and resolves once everything has played. */
export function createStreamingSpeaker(voiceURI: string | null): {
  feed: (chunk: string) => void;
  flush: () => Promise<void>;
} {
  // Clear any wedged queue from a previous turn before we start adding to it.
  window.speechSynthesis.cancel();

  let buffer = "";
  let chain: Promise<void> = Promise.resolve();

  const speakOne = (sentence: string) => {
    chain = chain
      .then(() => speakQueued(sentence, voiceURI))
      .catch((e) => {
        // Don't break the chain on a single utterance failure.
        console.error("speak failed", e);
      });
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
      await chain;
    },
  };
}
