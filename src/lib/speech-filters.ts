// Speech-side classifiers used by the conversation loop. All pure — no
// React, no Tauri, no hook state. Extracted from useConversationLoop so
// they can be unit-tested in isolation and reused without dragging the
// whole hook into the import graph.

// Voice barge-in: utterances accepted as "stop talking" while Chappie is
// speaking. Matched against the normalized (NFKC + lowercase) Whisper
// transcript with substring containment, so "もうストップ" / "stop please"
// both fire. Kept short on purpose — the audio.rs barge-in mode also caps
// utterance length, so longer phrases don't reach this filter anyway.
export const BARGE_IN_PATTERNS: RegExp[] = [
  /ストップ/,
  /すとっぷ/,
  /やめて/,
  /止めて/,
  /止まって/,
  /とまって/,
  /もういい/,
  /うるさい/,
  /だまって/,
  /黙って/,
  /\bstop\b/i,
  /\bquiet\b/i,
  /\bshut up\b/i,
];

// Cancel-only filter applied while an external audio source (miniplayer
// YouTube, and in the future Spotify / Apple Music via control_music) is
// actively producing sound that can leak into the mic. Wider than
// BARGE_IN_PATTERNS — also catches "閉じて / 消して" so the user can
// dismiss whatever's playing by voice. Everything else gets dropped so
// the leaking audio doesn't loop back into the LLM.
export const EXTERNAL_AUDIO_CANCEL_PATTERNS: RegExp[] = [
  ...BARGE_IN_PATTERNS,
  /閉じて/,
  /閉じる/,
  /とじて/,
  /消して/,
  /けして/,
  /(ミニ)?プレイヤー/,
  /\bclose\b/i,
  /\bdismiss\b/i,
];

export function isBargeInCommand(text: string): boolean {
  const norm = text.normalize("NFKC").toLowerCase().trim();
  if (!norm) return false;
  return BARGE_IN_PATTERNS.some((p) => p.test(norm));
}

export function isExternalAudioCancelCommand(text: string): boolean {
  const norm = text.normalize("NFKC").toLowerCase().trim();
  if (!norm) return false;
  return EXTERNAL_AUDIO_CANCEL_PATTERNS.some((p) => p.test(norm));
}

// Common Whisper Japanese hallucinations on silence/noise. Drop these
// utterances instead of letting them flow to wake-word detection.
export const HALLUCINATION_PATTERNS = [
  /^ご(視聴|清聴)(いただき|くださり)?(誠に)?ありがとうございました?/,
  /^ご視聴ありがとうございます/,
  /^チャンネル登録/,
  /^高評価/,
  /^[\s\S]*[Ss]ubscrib/,
  /^字幕\s*by/i,
  /^字幕[製作製作]/,
  /^翻訳/,
  /^Thank(s| you)( so (much|very))? for watching/i,
  /^Bye[\s.!]?$/i,
  /^おやすみなさい[。!]?$/,
  /^ありがとう(ございました|ございます)?[。!]?$/,
  /^見てくださって/,
  /^見ていただき/,
  /^お疲れ様でした[。!]?$/,
  /^バイバイ[。!]?$/,
  /^じゃあ?ね[。!]?$/,
  /^んー[。!]?$/,
  /^ん+[。!]?$/,
  /^[ぁ-ん][。!]?$/, // single hiragana
  /^[、。!?\s]+$/, // punctuation only
  /^\(.*\)$/, // parenthetical only e.g. "(音楽)" "(笑)" "(拍手)"
  /^\[.*\]$/,
  /^[\d\s,.,。、]+$/, // digits + punctuation only
];

export function isHallucination(text: string): boolean {
  const t = text.trim();
  // Anything 2 chars or less is almost certainly garbage from a half-second
  // VAD blip — except for legit short responses that could only follow a
  // wake-word, which the awaitingBody branch handles separately.
  if (t.length <= 2) return true;
  return HALLUCINATION_PATTERNS.some((p) => p.test(t));
}
