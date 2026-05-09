import {
  AlarmClock,
  AppWindow,
  BatteryMedium,
  Brain,
  CalendarDays,
  Camera,
  ClipboardCopy,
  Clock,
  CloudSun,
  Globe,
  Hand,
  Lock,
  MessageCircle,
  type Mic,
  Music,
  NotebookPen,
  Timer,
  Volume2,
} from "lucide-react";

export const CAPABILITY_IDS = [
  "chat",
  "timer",
  "reminder",
  "time",
  "weather",
  "calendar",
  "web",
  "apps",
  "volume",
  "music",
  "clipboard",
  "screenshot",
  "notes",
  "memory",
  "battery",
  "lock",
  "goodbye",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

// Pool of capabilities considered "hero-worthy" — strong enough to be a
// first impression. We rotate 4 of these onto the landing page each day
// (date-seeded so SSR and CSR render the same set, and so repeat visitors
// see freshness). Picked for visible action / emotional pull / concrete
// utility — left out: chat (too generic), time / battery / lock (mundane),
// goodbye (meta), web / apps / volume / notes (mid-tier productivity).
export const HERO_POOL: readonly CapabilityId[] = [
  "memory",
  "music",
  "screenshot",
  "weather",
  "calendar",
  "timer",
  "reminder",
  "clipboard",
];

/**
 * Pick `n` capabilities from HERO_POOL, deterministically by date.
 * Same date → same output, so server and client render identically and
 * the selection rotates once per day for repeat visitors.
 */
export function getHeroCapabilities(
  date: Date = new Date(),
  n = 4,
): CapabilityId[] {
  const seed =
    date.getUTCFullYear() * 10000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate();
  const rng = mulberry32(seed);
  const arr = [...HERO_POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// Tiny seeded PRNG. Good enough for "shuffle 8 items reproducibly";
// nothing security-sensitive depends on its quality.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CAPABILITY_ICONS: Record<CapabilityId, typeof Mic> = {
  chat: MessageCircle,
  timer: Timer,
  time: Clock,
  weather: CloudSun,
  calendar: CalendarDays,
  web: Globe,
  apps: AppWindow,
  volume: Volume2,
  music: Music,
  clipboard: ClipboardCopy,
  screenshot: Camera,
  reminder: AlarmClock,
  notes: NotebookPen,
  memory: Brain,
  battery: BatteryMedium,
  lock: Lock,
  goodbye: Hand,
};

export const CAPABILITY_EXAMPLE_KEYS: Record<CapabilityId, string[]> = {
  chat: ["example1", "example2"],
  timer: ["example1", "example2", "example3"],
  time: ["example1", "example2", "example3"],
  weather: ["example1", "example2", "example3"],
  calendar: ["example1", "example2", "example3"],
  web: ["example1", "example2", "example3"],
  apps: ["example1", "example2", "example3"],
  volume: ["example1", "example2", "example3"],
  clipboard: ["example1", "example2", "example3"],
  screenshot: ["example1", "example2", "example3"],
  reminder: ["example1", "example2", "example3"],
  music: ["example1", "example2", "example3"],
  notes: ["example1", "example2", "example3"],
  memory: ["example1", "example2", "example3"],
  battery: ["example1", "example2", "example3"],
  lock: ["example1", "example2", "example3"],
  goodbye: ["example1", "example2", "example3"],
};
