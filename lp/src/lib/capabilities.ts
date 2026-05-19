export const CAPABILITY_IDS = [
  "chat",
  "timer",
  "reminder",
  "time",
  "weather",
  "news",
  "wikipedia",
  "quake",
  "fx",
  "astro",
  "fetch",
  "calendar",
  "web",
  "apps",
  "volume",
  "music",
  "youtube",
  "clipboard",
  "screenshot",
  "notes",
  "memory",
  "battery",
  "lock",
  "goodbye",
  "mlb",
  "stocks",
  "units",
  "wallpaper",
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
  "youtube",
  "screenshot",
  "weather",
  "news",
  "wikipedia",
  "fx",
  "astro",
  "fetch",
  "calendar",
  "timer",
  "reminder",
  "clipboard",
  "mlb",
  "stocks",
  "units",
  "wallpaper",
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

export const CAPABILITY_ICONS: Record<CapabilityId, string> = {
  chat: "💬",
  timer: "⏲️",
  time: "🕐",
  weather: "☀️",
  news: "📰",
  wikipedia: "📖",
  quake: "🚨",
  fx: "💱",
  astro: "🌅",
  fetch: "📄",
  calendar: "📅",
  web: "🔍",
  apps: "🚀",
  volume: "🔊",
  music: "🎵",
  youtube: "▶️",
  clipboard: "📋",
  screenshot: "📸",
  reminder: "⏰",
  notes: "📝",
  memory: "🧠",
  battery: "🔋",
  lock: "💤",
  goodbye: "👋",
  mlb: "⚾",
  stocks: "📈",
  units: "📐",
  wallpaper: "🖼️",
};

export const CAPABILITY_EXAMPLE_KEYS: Record<CapabilityId, string[]> = {
  chat: ["example1", "example2", "example3"],
  timer: ["example1", "example2", "example3"],
  time: ["example1", "example2", "example3"],
  weather: ["example1", "example2", "example3"],
  news: ["example1", "example2", "example3"],
  wikipedia: ["example1", "example2", "example3"],
  quake: ["example1", "example2", "example3"],
  fx: ["example1", "example2", "example3"],
  astro: ["example1", "example2", "example3"],
  fetch: ["example1", "example2", "example3"],
  calendar: ["example1", "example2", "example3"],
  web: ["example1", "example2", "example3"],
  apps: ["example1", "example2", "example3"],
  volume: ["example1", "example2", "example3"],
  clipboard: ["example1", "example2", "example3"],
  screenshot: ["example1", "example2", "example3"],
  reminder: ["example1", "example2", "example3"],
  music: ["example1", "example2", "example3"],
  youtube: ["example1", "example2", "example3"],
  notes: ["example1", "example2", "example3"],
  memory: ["example1", "example2", "example3"],
  battery: ["example1", "example2", "example3"],
  lock: ["example1", "example2", "example3"],
  goodbye: ["example1", "example2", "example3"],
  mlb: ["example1", "example2", "example3"],
  stocks: ["example1", "example2", "example3"],
  units: ["example1", "example2", "example3"],
  wallpaper: ["example1", "example2", "example3"],
};
