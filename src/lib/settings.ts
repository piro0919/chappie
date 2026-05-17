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
 * - "free": call the proxy at chappie.kkweb.io (no API key, 5 req/day quota).
 * - "paid": call the proxy with a Bearer token so the backend bypasses
 *           quota and unlocks premium features (VOICEVOX paid speakers).
 *           Only valid while `subscriptionStatus in {"active","trialing"}` —
 *           `loadSettings` auto-demotes to "free" if the subscription has
 *           lapsed so a stale settings.json can't trick the UI.
 * - "byok": call OpenAI / Anthropic / Gemini directly with the user's key.
 *           Mutually exclusive with paid features — BYOK users who want
 *           premium voices must switch to "paid".
 *
 * Fresh installs default to "free". Existing users with a saved key
 * migrate to "byok" so behavior stays identical (see migration in
 * `loadSettings`). The renderer holds this as the source of truth; the
 * Rust `chat_complete` Tauri command branches on it.
 */
export type Mode = "free" | "paid" | "byok";

/**
 * Pure helper so the paid-demote rule is unit-testable without touching
 * the Tauri store. `mode === "paid"` requires an active subscription;
 * if status has lapsed we drop back to "free" so the UI and chat path
 * agree.
 */
export function resolveMode(
  storedMode: Mode | undefined,
  apiKey: string,
  subscriptionStatus: SubscriptionStatus,
  subscriptionEmail: string,
): Mode {
  // First-time migration: a pre-Free-mode user with a saved API key was
  // a BYOK user — preserve that behavior. No key + no `mode` is a fresh
  // (or wiped) install → Free.
  const initial: Mode = storedMode ?? (apiKey.trim() ? "byok" : "free");
  // Demote paid → free only when the user is signed out. A signed-in
  // user with `inactive`/`canceled` status is mid-checkout or has a
  // lapsed sub — they still need the Pro panel visible to see the
  // Upgrade button. The chat-path gate elsewhere uses `subscriptionStatus`
  // directly, so a non-active "paid" mode here doesn't unlock quota.
  if (
    initial === "paid" &&
    !subscriptionEmail.trim() &&
    subscriptionStatus !== "active" &&
    subscriptionStatus !== "trialing"
  ) {
    return "free";
  }
  return initial;
}

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
  const storedMode = await store.get<Mode>("mode");
  const subscriptionStatus =
    (await store.get<SubscriptionStatus>("subscriptionStatus")) ??
    DEFAULTS.subscriptionStatus;
  const subscriptionEmail =
    (await store.get<string>("subscriptionEmail")) ??
    DEFAULTS.subscriptionEmail;
  const mode = resolveMode(
    storedMode,
    apiKey,
    subscriptionStatus,
    subscriptionEmail,
  );
  // Persist a paid → free demote so subsequent loads agree without
  // re-running the resolve, and so other windows see the change.
  if (storedMode === "paid" && mode === "free") {
    await store.set("mode", "free");
    await store.save();
  }
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
    subscriptionEmail,
    subscriptionStatus,
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
