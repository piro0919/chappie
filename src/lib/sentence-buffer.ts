// Streaming TTS buffer helper. Both engines (WebSpeech, VOICEVOX) consume
// streaming text chunks and need the same rule for "is the head of the
// buffer ready to speak yet?" — first sentence goes fast (latency), all
// subsequent sentences are batched to FOLLOWUP_MIN_CHARS so the per-
// utterance gap shows up once per ~120 chars instead of once per sentence.

// Sentence terminators we split streaming output on. Includes Japanese
// full-stop, exclamation, question, and ASCII variants. The ASCII period
// is only treated as a terminator when it isn't between digits — this
// keeps decimals like `39.6` intact so the streaming TTS doesn't
// helpfully split them into "39." and "6".
export const SENTENCE_TERMINATORS = /[。！？!?]+|(?<!\d)\.(?!\d)/g;

// After the first utterance fires (the latency-sensitive one), we batch
// subsequent sentences until we've accumulated at least this many chars
// before speaking. Both backends have a per-utterance gap (WebKit's
// macOS Japanese voices add audible silence; VOICEVOX adds an HTTP RTT
// and decode), so larger chunks past the first means fewer gaps per
// reply. 120 was tuned to feel continuous on multi-paragraph output
// (e.g. tarot readings) without making the 2nd chunk wait too long
// after the 1st.
export const FOLLOWUP_MIN_CHARS = 120;

// Pulls the next "ready to speak" segment off the front of `buffer`,
// using the one-fast-then-batch policy. Returns null when nothing is
// ready (no terminator, or the leading run is shorter than
// FOLLOWUP_MIN_CHARS after the first utterance has already gone out).
export function takeReadySegment(
  buffer: string,
  alreadySpoken: boolean,
): { segment: string; remaining: string } | null {
  SENTENCE_TERMINATORS.lastIndex = 0;
  const first = SENTENCE_TERMINATORS.exec(buffer);
  if (!first) return null;
  let end = first.index + first[0].length;

  if (alreadySpoken) {
    while (end < FOLLOWUP_MIN_CHARS) {
      SENTENCE_TERMINATORS.lastIndex = end;
      const next = SENTENCE_TERMINATORS.exec(buffer);
      if (!next) return null;
      end = next.index + next[0].length;
    }
  }

  return {
    segment: buffer.slice(0, end).trim(),
    remaining: buffer.slice(end),
  };
}
