// Per-turn system-prompt override builder. Returns the persona /
// turn-rules block that goes between history and the current user
// message, OR null when no override is needed (unknown speaker id).
//
// Two callers in useConversationLoop: every chat turn either reinforces
// the active VOICEVOX character (samples + identity rule + turn rules)
// or — when chappie's own wake-word came in after a character turn —
// resets back to chappie's persona. Extracted so the hook doesn't own
// the prose templates and so the rule changes can be unit-tested.

import { VOICEVOX_CURATED_SPEAKERS } from "./voicevox-speakers";

// Common rules for every per-turn persona injection. Prevents two
// failure modes we observed:
//  - meta acknowledgments like 「もう一回聞いてくれたんだ」 when the user
//    repeats a question — the model picks up the repetition from
//    history and comments on it.
//  - overly long replies (especially Anthropic) that bury the answer
//    in flavor text.
const TURN_RULES =
  "【共通ルール】\n" +
  "・直前のターンや繰り返し質問への meta コメント（「また」「もう一回」「さっきも」等）はしない。新しい質問として答える。\n" +
  "・返答は短く、原則 1〜2 文。占い・ニュース要約など内容上必要な場合のみ伸ばしてよい。\n" +
  "・前置き（「うーんとね」「ちょっと待ってよ」等のフィラー）は不要。本題から入る。";

// Identity-question rule: without this, "自己紹介して" / "誰？" / "何歳？"
// gets answered as "I'm Chappie, the hands-free assistant, with X
// character's voice" instead of as the character themselves. The base
// persona keeps insisting the assistant is Chappie, so we have to be
// explicit that for identity-shaped questions, the character speaks as
// themselves.
const IDENTITY_RULE =
  "【素性に関する質問の扱い】\n" +
  "「自己紹介して」「あなた誰？」「名前は？」「何歳？」など本人の属性を聞かれた場合は、**Chappie ではなく上記キャラ本人として** 答える（名前・年齢・性格・特徴を上記設定から拾う）。例：めたん→「わたくしは四国めたん、17歳の高校2年生よ」、ずんだもん→「僕、ずんだもんなのだ。ずんだ餅の精なのだ」。\n" +
  "Chappie 本体の機能紹介は「何ができるの？」「使い方教えて」と聞かれたときだけで、その場合もキャラの口調のまま喋る。";

const CHAPPIE_RESET =
  "このターンは「チャッピー」本来の口調で答えてください。直前のターンが別キャラ（ずんだもんやめたん等）の口調だったとしても、その口調・一人称・語尾を引き継がないでください。冒頭のチャッピーのペルソナに従って、フラットで親しみやすい話し方に戻してください。";

// Build the system-message body to inject for this turn. `undefined`
// speakerId = chappie wake (returns the reset block). A known speaker
// id returns the character block (persona + samples + identity rule).
// An unknown speaker id returns null — the hook skips injection in
// that case (the caller has already failed loudly elsewhere).
export function buildPerTurnPrompt(
  speakerId: number | undefined,
): string | null {
  if (speakerId === undefined) {
    return `${CHAPPIE_RESET}\n\n${TURN_RULES}`;
  }
  const speaker = VOICEVOX_CURATED_SPEAKERS.find((s) => s.id === speakerId);
  if (!speaker) return null;
  // Few-shot example utterances grounded in the character's official
  // /calls/ page voice. Concrete instances keep weaker models
  // (Gemini Flash / Anthropic Haiku) in character on long answers
  // where a one-line description alone tends to drift back to neutral.
  const samplesBlock = speaker.samples?.length
    ? `\n\n【話し方の例（このキャラのトーン・語尾・一人称が自然に出るよう参考にしてください）】\n${speaker.samples.map((s) => `・「${s}」`).join("\n")}`
    : "";
  return `${speaker.persona}${samplesBlock}\n\n${IDENTITY_RULE}\n\n${TURN_RULES}\n\n（重要：前のターンが別キャラの口調だったとしても、このターンは上記の設定で答えてください。）`;
}
