import { VOICEVOX_CURATED_SPEAKERS } from "./voicevox-speakers";

export type WakeMatch =
  | { matched: false }
  | { matched: true; body: string; speakerId?: number };

// Primary plus common Whisper mistranscriptions of the same utterance.
// Order matters only for tie-breaks; matching is by earliest position in the input.
const BASE_WAKE_WORDS = [
  "chappie",
  "チャッピー",
  "チョッピー",
  "ジャッピー",
  "ジュッピー",
  "ちゃっぴー",
  "ちょっぴー",
  "じゃっぴー",
  "じゅっぴー",
  "juppie",
  "joppy",
  "choppy",
  // Phonetic variants Whisper produces in non-EN/JA locales.
  "chappi", // es / pt / it
  "chapie", // fr (also covers some German speakers)
  "tschappi", // de
  "tschapie", // de
  "schappi", // de fallback
  "恰比", // zh — common transliteration
  "查皮",
  "夏皮",
  "채피", // ko — common Hangul transliteration of "chappie"
  "찹피",
  "차피",
] as const;

interface WakeCandidate {
  /** Normalized form (NFKC + lowercase) used for matching. */
  norm: string;
  /** If set, matching this candidate also asks the loop to switch the
   *  active VOICEVOX speaker before responding. */
  speakerId?: number;
}

const ALL_WAKE_WORDS: WakeCandidate[] = (() => {
  const out: WakeCandidate[] = BASE_WAKE_WORDS.map((w) => ({
    norm: normalize(w),
  }));
  for (const sp of VOICEVOX_CURATED_SPEAKERS) {
    for (const name of sp.wakeNames) {
      out.push({ norm: normalize(name), speakerId: sp.id });
    }
  }
  return out;
})();

const LEAD_TRIM_RE = /^[\s、。．，,.!！?？:：;；\-—–…]+/;
const TRAIL_TRIM_RE = /\s+$/;

function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

export function detectWake(input: string): WakeMatch {
  if (!input.trim()) return { matched: false };
  const normalized = normalize(input);

  let bestIdx = -1;
  let bestLen = 0;
  let bestSpeakerId: number | undefined;
  for (const w of ALL_WAKE_WORDS) {
    const idx = normalized.indexOf(w.norm);
    if (idx < 0) continue;
    // Earliest position wins; on ties the longer match wins so a more
    // specific name like "四国めたん" beats the alias "めたん" when both
    // appear at the same index.
    const better =
      bestIdx === -1 ||
      idx < bestIdx ||
      (idx === bestIdx && w.norm.length > bestLen);
    if (better) {
      bestIdx = idx;
      bestLen = w.norm.length;
      bestSpeakerId = w.speakerId;
    }
  }
  if (bestIdx === -1) return { matched: false };

  const body = normalized
    .slice(bestIdx + bestLen)
    .replace(LEAD_TRIM_RE, "")
    .replace(TRAIL_TRIM_RE, "");

  if (bestSpeakerId !== undefined) {
    return { matched: true, body, speakerId: bestSpeakerId };
  }
  return { matched: true, body };
}
