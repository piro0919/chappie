export type WakeMatch = { matched: false } | { matched: true; body: string };

// Primary plus common Whisper mistranscriptions of the same utterance.
// Order matters only for tie-breaks; matching is by earliest position in the input.
const WAKE_WORDS = [
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
  "chappi", // es
  "chapie", // fr (also covers some German speakers)
  "tschappi", // de
  "tschapie", // de
  "schappi", // de fallback
  "恰比", // zh — common transliteration
  "查皮",
  "夏皮",
] as const;

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
  for (const w of WAKE_WORDS) {
    const idx = normalized.indexOf(normalize(w));
    if (idx >= 0 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestLen = w.length;
    }
  }
  if (bestIdx === -1) return { matched: false };

  const body = normalized
    .slice(bestIdx + bestLen)
    .replace(LEAD_TRIM_RE, "")
    .replace(TRAIL_TRIM_RE, "");
  return { matched: true, body };
}
