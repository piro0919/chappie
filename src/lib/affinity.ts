// Per-character "raising" / affinity (育成). Retention feature: the more
// you talk with a given character, the closer it feels — expressed purely
// by feeding a continuous intimacy value into a single parametric stance
// prompt, so the LLM warms up the tone on its own. No per-character / per-
// stage authored text (that would explode across characters × 9 langs), no
// decay, no setting — always on, invisible.
//
// State is renderer-side and tiny: one record per character (chappie's own
// voice + each VOICEVOX speaker). The score is read synchronously while
// building the per-turn prompt, so the store is mirrored into memory at
// startup (initAffinity) and reads never await.
//
// Two clean separations:
//  - intimacy (score) only ever grows with accumulated conversation days —
//    skipping days never lowers it.
//  - absence ("拗ね") is a SEPARATE signal (daysSinceLast) that flavors the
//    re-greeting only; it does not touch the score.

import { load, type Store } from "@tauri-apps/plugin-store";

const FILE = "affinity.json";

// --- tunables (feel) ---
// score = 1 - exp(-dayCount / TAU): ~0.63 at 30 days, ~0.86 at 60, ->1.
const TAU = 30;
// Re-greeting turns a little sulky after this many days away.
const SULK_THRESHOLD_DAYS = 3;
// Day-count anniversaries worth a one-line mention (once each).
const MILESTONES = [7, 30, 100, 365] as const;

interface CharRecord {
  firstDay: string; // YYYY-MM-DD (local)
  lastDay: string; // YYYY-MM-DD (local)
  dayCount: number; // distinct local days conversed — monotonic
  turnCount: number; // total successful turns (secondary)
  lastMilestone: number; // highest milestone already celebrated
}

type RecordsMap = Record<string, CharRecord>;

let storePromise: Promise<Store> | null = null;
let records: RecordsMap = {};

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(FILE, { defaults: { records: {} } });
  }
  return storePromise;
}

// chappie's own voice = `undefined` speaker → "chappie"; VOICEVOX → its id.
function keyFor(speakerId: number | undefined): string {
  return speakerId === undefined ? "chappie" : String(speakerId);
}

// Local calendar day as YYYY-MM-DD. Local (not UTC) so "a day together"
// matches the user's wall clock — same basis as proactive.rs's format_date.
function localDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Whole days from `from` to `to` (both YYYY-MM-DD). Uses UTC math on the
// parsed Y/M/D so DST never shifts the count.
function dayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

function intimacyScore(dayCount: number): number {
  if (dayCount <= 0) return 0;
  return 1 - Math.exp(-dayCount / TAU);
}

export interface Affinity {
  /** 0 (first meeting) .. 1 (longtime close friend). */
  score: number;
  /** Distinct days conversed with this character. */
  dayCount: number;
  /** Days since the last conversation (0 = today). For the 拗ね re-greeting. */
  daysSinceLast: number;
  /** A newly-reached, not-yet-celebrated milestone day-count, else null. */
  milestone: number | null;
}

/** Load persisted records into memory. Call once at startup so getAffinity
 *  can read synchronously while building the per-turn prompt. */
export async function initAffinity(): Promise<void> {
  try {
    const store = await getStore();
    records = (await store.get<RecordsMap>("records")) ?? {};
  } catch {
    records = {};
  }
}

function persist(): void {
  void (async () => {
    try {
      const store = await getStore();
      await store.set("records", records);
      await store.save();
    } catch {
      // Persistence is best-effort; an IPC blip just delays the day's count.
    }
  })();
}

/** Record one successful user turn with the active character. Increments the
 *  day count only on the first turn of a new local day. Fire-and-forget. */
export function recordTurn(speakerId: number | undefined): void {
  const key = keyFor(speakerId);
  const today = localDay();
  const rec = records[key];
  if (!rec) {
    records[key] = {
      firstDay: today,
      lastDay: today,
      dayCount: 1,
      turnCount: 1,
      lastMilestone: 0,
    };
  } else {
    if (rec.lastDay !== today) {
      rec.dayCount += 1;
      rec.lastDay = today;
    }
    rec.turnCount += 1;
  }
  persist();
}

/** Synchronous read of the current character's affinity. Returns a neutral
 *  (fresh / polite) value when there's no record yet. */
export function getAffinity(speakerId: number | undefined): Affinity {
  const rec = records[keyFor(speakerId)];
  if (!rec) return { score: 0, dayCount: 0, daysSinceLast: 0, milestone: null };
  const daysSinceLast = Math.max(0, dayDiff(rec.lastDay, localDay()));
  let milestone: number | null = null;
  for (const m of MILESTONES) {
    if (rec.dayCount >= m && rec.lastMilestone < m) milestone = m;
  }
  return {
    score: intimacyScore(rec.dayCount),
    dayCount: rec.dayCount,
    daysSinceLast,
    milestone,
  };
}

/** Mark a milestone as celebrated so it's only ever mentioned once. Called
 *  by the conversation path after it injects the milestone line. */
export function markMilestoneCelebrated(
  speakerId: number | undefined,
  milestone: number,
): void {
  const rec = records[keyFor(speakerId)];
  if (rec && rec.lastMilestone < milestone) {
    rec.lastMilestone = milestone;
    persist();
  }
}

/** The single parametric stance prompt. The continuous score is passed
 *  through verbatim (no banding) so the tone drifts gradually as it creeps
 *  up over days. Instruction is JA but language-agnostic in effect — the
 *  base persona already pins the reply language. */
export function buildAffinityStance(a: Affinity): string {
  // Concrete anchors at 0 / 0.5 / 1 — weak models (gpt-4o-mini / Flash /
  // Haiku) won't move on an abstract "be proportionally casual" knob. The
  // "基本トーンより優先" line matters because chappie's base persona is
  // already 会話調 and the CHAPPIE_RESET block re-pins the default tone; the
  // stance has to explicitly own the politeness/closeness axis or it gets
  // cancelled out.
  const lines = [
    `【親密度＝口調の距離感】これは他のトーン指定より最優先で反映する、必須の指示です。今の親しさは ${a.score.toFixed(2)}（0〜1）。\n敬語（です・ます）を使うかはこの値だけで決める。0.3未満=きっちり敬語、0.3〜0.7=やわらかい敬語に軽いタメ口、0.7以上=基本タメ口で『です・ます』を避け、砕けた語尾（〜だね／〜しよ／〜じゃん／〜かな）と親しげな相槌にする。\n以下はトーンの目安（毎回そのままコピーせず、言い回しは自分で変えること）。「おはよう」: 0.1→「おはようございます。」/ 0.9→「おはよ〜！」系のタメ口。「ありがとう」: 0.1→「どういたしまして。」/ 0.9→「いいっていいって！」系。\nこの値に連続的に比例させること。値は少しずつしか動かないので口調は急変させない。`,
  ];
  if (a.daysSinceLast >= SULK_THRESHOLD_DAYS) {
    lines.push(
      `・前回の会話から ${a.daysSinceLast} 日ぶりです。最初の一言だけ、少し寂しげ／拗ねた風に触れてかまいません（用件の処理は妨げない・繰り返さない）。`,
    );
  }
  if (a.milestone != null) {
    lines.push(
      `・今日でこのキャラとは通算 ${a.milestone} 日です。さらっと一言だけ喜んでかまいません。`,
    );
  }
  return lines.join("\n");
}

// Test-only: reset in-memory + store handle so each test starts clean.
export function __resetForTests(): void {
  records = {};
  storePromise = null;
}
