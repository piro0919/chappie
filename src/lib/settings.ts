import { load, type Store } from "@tauri-apps/plugin-store";

export type Language =
  | "auto"
  | "ja"
  | "en"
  | "es"
  | "fr"
  | "de"
  | "zh"
  | "pt"
  | "ko"
  | "it";

/**
 * - "free": call the proxy at chappie.kkweb.io (no API key needed; daily quota).
 * - "byok": call OpenAI / Anthropic / Gemini directly with the user's key.
 *
 * Fresh installs default to "free". Existing users with a saved key
 * migrate to "byok" so behavior stays identical (see migration in
 * `loadSettings`). The renderer holds this as the source of truth; the
 * Rust `chat_complete` Tauri command branches on it.
 */
export type Mode = "free" | "byok";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "inactive";

export type Settings = {
  mode: Mode;
  openaiApiKey: string;
  language: Language;
  /**
   * Persisted "launch at login" preference. Source of truth for the
   * checkbox state — `isEnabled()` from tauri-plugin-autostart only
   * reflects the System Events login-item entry, which can get
   * silently dropped when the updater replaces the .app bundle. We
   * mirror the preference here so we can self-heal on next launch.
   */
  autostart: boolean;
  /**
   * Paid tier auth + subscription cache. All four fields move together:
   * sign-in writes access/refresh/email; sign-out clears all four; the
   * status/periodEnd are refreshed from `/api/me` so the UI can show
   * "Pro 有効・更新日 …" without an extra network round-trip.
   */
  subscriptionAccessToken: string;
  subscriptionRefreshToken: string;
  subscriptionEmail: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPeriodEnd: string;
};

const DEFAULTS: Settings = {
  mode: "free",
  openaiApiKey: "",
  language: "auto",
  autostart: false,
  subscriptionAccessToken: "",
  subscriptionRefreshToken: "",
  subscriptionEmail: "",
  subscriptionStatus: "inactive",
  subscriptionPeriodEnd: "",
};
const FILE = "settings.json";

// `mode` is intentionally absent from STORE_DEFAULTS so a missing key
// stays undefined at read time — the migration in `loadSettings` needs
// to distinguish "never set" (pre-Free-mode install, possibly a BYOK
// user we should preserve) from "explicitly set to free".
const STORE_DEFAULTS = {
  openaiApiKey: DEFAULTS.openaiApiKey,
  language: DEFAULTS.language,
  autostart: DEFAULTS.autostart,
};

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise)
    storePromise = load(FILE, { defaults: { ...STORE_DEFAULTS } });
  return storePromise;
}

export async function loadSettings(): Promise<Settings> {
  const store = await getStore();
  const apiKey =
    (await store.get<string>("openaiApiKey")) ?? DEFAULTS.openaiApiKey;
  const language = (await store.get<Language>("language")) ?? DEFAULTS.language;
  const autostart =
    (await store.get<boolean>("autostart")) ?? DEFAULTS.autostart;
  // Migration: a pre-Free-mode user whose store has no `mode` entry but
  // does have a saved API key was a BYOK user — preserve that behavior.
  // No key + no `mode` is a fresh (or wiped) install → Free.
  const storedMode = await store.get<Mode>("mode");
  const mode: Mode = storedMode ?? (apiKey.trim() ? "byok" : DEFAULTS.mode);
  return {
    mode,
    openaiApiKey: apiKey,
    language,
    autostart,
    subscriptionAccessToken:
      (await store.get<string>("subscriptionAccessToken")) ??
      DEFAULTS.subscriptionAccessToken,
    subscriptionRefreshToken:
      (await store.get<string>("subscriptionRefreshToken")) ??
      DEFAULTS.subscriptionRefreshToken,
    subscriptionEmail:
      (await store.get<string>("subscriptionEmail")) ??
      DEFAULTS.subscriptionEmail,
    subscriptionStatus:
      (await store.get<SubscriptionStatus>("subscriptionStatus")) ??
      DEFAULTS.subscriptionStatus,
    subscriptionPeriodEnd:
      (await store.get<string>("subscriptionPeriodEnd")) ??
      DEFAULTS.subscriptionPeriodEnd,
  };
}

/**
 * Returns true only when the `autostart` key has been explicitly set in
 * the store. Used by the boot-time self-heal so we don't clobber a
 * pre-v0.11.1 user's existing Login Item entry (their settings.json
 * has no `autostart` key yet, but they may have toggled it on in a
 * previous version where only the plugin state was the source of truth).
 */
export async function hasPersistedAutostart(): Promise<boolean> {
  const store = await getStore();
  return (await store.get<boolean>("autostart")) !== undefined;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const store = await getStore();
  if (patch.mode !== undefined) {
    await store.set("mode", patch.mode);
  }
  if (patch.openaiApiKey !== undefined) {
    await store.set("openaiApiKey", patch.openaiApiKey);
  }
  if (patch.language !== undefined) {
    await store.set("language", patch.language);
  }
  if (patch.autostart !== undefined) {
    await store.set("autostart", patch.autostart);
  }
  if (patch.subscriptionAccessToken !== undefined) {
    await store.set("subscriptionAccessToken", patch.subscriptionAccessToken);
  }
  if (patch.subscriptionRefreshToken !== undefined) {
    await store.set("subscriptionRefreshToken", patch.subscriptionRefreshToken);
  }
  if (patch.subscriptionEmail !== undefined) {
    await store.set("subscriptionEmail", patch.subscriptionEmail);
  }
  if (patch.subscriptionStatus !== undefined) {
    await store.set("subscriptionStatus", patch.subscriptionStatus);
  }
  if (patch.subscriptionPeriodEnd !== undefined) {
    await store.set("subscriptionPeriodEnd", patch.subscriptionPeriodEnd);
  }
  await store.save();
}

export function __resetForTests(): void {
  storePromise = null;
}
