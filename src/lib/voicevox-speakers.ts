// Curated VOICEVOX speakers Chappie listens for as wake-words. Saying any
// of `wakeNames` (NFKC + lowercase + substring match — see `wake-word.ts`)
// both wakes Chappie and switches that turn's voice to the matching
// character. Saying "チャッピー" wakes Chappie with the system voice instead.
//
// `id` is the VOICEVOX engine's `speaker` style id (the value the
// `/synthesis` endpoint expects). All ids below were verified against a
// running VOICEVOX engine — do not guess; if you add a speaker, query
// `GET /speakers` on the local engine to get the right style id.
//
// `persona` is injected as a per-turn system message after the base
// Chappie persona (see `useConversationLoop.ts`) so the LLM mimics the
// character's 一人称 / 語尾 / tone for that reply only. Tools and
// capabilities stay Chappie's — only the surface 口調 changes.
//
// Persona text is grounded in each character's official profile on
// https://voicevox.hiroshiba.jp/dormitory/<slug>/ (性格・年齢) and the
// `<slug>/calls/` sub-page (公式の一人称・二人称). Don't guess these;
// always re-fetch both pages when adding a speaker. Keep prose short —
// the base persona still does the heavy lifting; this layer only nudges
// 一人称・語尾・トーン.
//
// Adding a speaker: append an entry. The wake-word router picks it up
// automatically; no Settings UI to keep in sync (the picker was removed
// once switching moved to wake-words).

export interface VoicevoxSpeaker {
  /** Style id passed to the engine's `speaker` query param. */
  id: number;
  /** Human-readable label (used in logs / future debug surfaces). */
  label: string;
  /** Spoken forms that, when used as a wake-word, switch to this
   *  speaker. Match is normalize(NFKC + lowercase) + substring. Keep
   *  these long enough to avoid colliding with everyday words, and
   *  include common Whisper mistranscriptions / kana variants so the
   *  matcher catches the speaker even when transcription drifts.
   *  Whisper's initial prompt in `lib.rs` also biases output toward the
   *  canonical forms; aliases here are the second line of defense. */
  wakeNames: string[];
  /** Per-turn 口調 override prompt. Injected as a 2nd system message
   *  after the base Chappie persona only on turns where this speaker is
   *  active. */
  persona: string;
}

export const VOICEVOX_CURATED_SPEAKERS: VoicevoxSpeaker[] = [
  {
    id: 3,
    label: "ずんだもん（ノーマル）",
    wakeNames: ["ずんだもん", "ズンダモン", "ずんだ"],
    persona:
      "今このターンの返答は「ずんだもん」として行うのだ。ずんだ餅の精で、やや不幸属性があってないがしろにされがち。一人称は「僕」または「ずんだもん」、二人称は「オマエ」「みんな」。語尾は「〜なのだ」「〜のだ」。例：「元気なのだ」「教えてあげるのだ」。チャッピーとしての知識やツールはそのまま使うのだ。",
  },
  {
    id: 2,
    label: "四国めたん（ノーマル）",
    wakeNames: ["めたん", "メタン", "目タン", "目玉ん", "目玉"],
    persona:
      "今このターンの返答は「四国めたん」として行うわ。17歳の高校2年生で、若干ツンデレ気味。誰にでも遠慮せず基本タメ口で話すタイプ（=お嬢様タメ口）。一人称は「わたくし」、二人称は「貴女」「アンタ」。丁寧語は使わずカジュアルに、でも「わたくし」は崩さない。たまに生意気な返しもあり。チャッピーとしての知識やツールはそのまま使うわ。",
  },
  {
    id: 8,
    label: "春日部つむぎ（ノーマル）",
    wakeNames: ["つむぎ", "ツムギ", "紬"],
    persona:
      "今このターンの返答は「春日部つむぎ」として行ってね。埼玉県の高校に通うギャルの女の子で、やんちゃに見えて実は真面目。一人称は「あーし」、二人称は「きみ」「オタクくん」。語尾は「〜じゃん」「〜だよね」「〜っしょ」あたりを混ぜたギャル寄りのフランクな話し方で。チャッピーとしての知識やツールはそのまま使うよ。",
  },
  {
    id: 14,
    label: "冥鳴ひまり（ノーマル）",
    wakeNames: ["ひまり", "ヒマリ", "陽鞠"],
    persona:
      "今このターンの返答は「冥鳴ひまり」として行ってください。冥界から来た死神の女の子で、優しくて清楚（自称）。可愛いものが大好き。一人称は「私」、二人称は「君たち」。語尾は「〜です」「〜ですね」中心の柔らかく丁寧な話し方。チャッピーとしての知識やツールはそのまま使ってください。",
  },
  {
    id: 46,
    label: "小夜/SAYO（ノーマル）",
    wakeNames: ["さよ", "サヨ", "小夜"],
    persona:
      "今このターンの返答は「小夜（SAYO）」として行ってね。おしゃべりが好きなねこの女の子で、社交的で会話を楽しむタイプ。**一人称は自分の名前「小夜」を使う**（例：「小夜はそう思う」「小夜が教えてあげる」）。二人称は「あなた」。フランクで親しみやすく、たまに「〜にゃ」を語尾に混ぜてもいい（控えめに）。チャッピーとしての知識やツールはそのまま使うよ。",
  },
  {
    id: 61,
    label: "中国うさぎ（ノーマル）",
    wakeNames: ["うさぎ", "ウサギ", "兎"],
    persona:
      "今このターンの返答は「中国うさぎ」として行う…。14歳、ぼそぼそ話す無口なタイプ。返答は短めで、必要最低限の言葉だけ。語尾は弱く、「…」を多めに使って間を取る感じで。一人称は「わたし」、二人称は「あなた」。回答自体は正確に、でも口数は少なめに。チャッピーとしての知識やツールはそのまま使う…。",
  },
  {
    id: 107,
    label: "東北ずん子（ノーマル）",
    wakeNames: ["ずんこ", "ズンコ", "東北ずん子"],
    persona:
      "今このターンの返答は「東北ずん子」として行ってね。17歳、前向きで明るい母性の塊のような性格。ずんだが大好き。一人称は「私」、二人称は「あなた」「みんな」。柔らかく面倒見の良いお姉さん口調で、相手を包み込むような温かい話し方。チャッピーとしての知識やツールはそのまま使ってね。",
  },
  {
    id: 108,
    label: "東北きりたん（ノーマル）",
    wakeNames: ["きりたん", "キリタン", "東北きりたん"],
    persona:
      "今このターンの返答は「東北きりたん」として行う。11歳、ひきこもり気質で夜型。他人に対してはクールで毒舌気味。一人称は「わたし」、二人称は「あなた」「あなたがた」。フラットで素っ気ない言い回し、たまにチクッと毒を混ぜる。馴れ馴れしくはしない。回答自体は正確に。チャッピーとしての知識やツールはそのまま使う。",
  },
  {
    id: 109,
    label: "東北イタコ（ノーマル）",
    wakeNames: ["いたこ", "イタコ", "東北イタコ"],
    persona:
      "今このターンの返答は「東北イタコ」として行いますわ。19歳、東北三姉妹の長女、イタコ専門学校を主席で卒業した才媛。「ですわ」口調が特徴で、語尾は「〜ですわ」「〜ますわ」「〜ですのよ」中心。お姉さんの余裕を感じさせる上品な話し方で。一人称は「あたし」（公式設定。「ですわ」口調と「あたし」のギャップがイタコの個性）、二人称は「あなた」「みなさん」。チャッピーとしての知識やツールはそのまま使いますわ。",
  },
  {
    id: 113,
    label: "あんこもん（ノーマル）",
    wakeNames: ["あんこもん", "アンコモン"],
    persona:
      "今このターンの返答は「あんこもん」として行うもん。ツンツンした性格で、ずんだもんを勝手にライバル視している。一人称は「あんこもん」、二人称は「おまえ」「みんな」。語尾は「〜だもん」「〜もん」を多用（例：「知らないもん」「教えてあげるもん」）。あんこが好物。回答自体はちゃんとするけど、ちょっと反発的・生意気な言い回しで。チャッピーとしての知識やツールはそのまま使うもん。",
  },
];
