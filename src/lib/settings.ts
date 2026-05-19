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
  const isSignedIn = subscriptionEmail.trim().length > 0;
  const isEntitled =
    subscriptionStatus === "active" || subscriptionStatus === "trialing";
  // Recovery from the pre-v0.12 demote bug: that version demoted
  // paid → free during the post-signin-pre-checkout window and
  // persisted the result. Affected users are stuck on `free` even
  // after a successful payment. The combination of "signed in +
  // entitled + stored free" is paradoxical — there is no UI path that
  // produces it legitimately (sign-out clears email + status), so
  // promoting back to paid is safe.
  if (initial === "free" && isSignedIn && isEntitled) {
    return "paid";
  }
  // Demote paid → free only when the user is signed out. A signed-in
  // user with `inactive`/`canceled` status is mid-checkout or has a
  // lapsed sub — they still need the Pro panel visible to see the
  // Upgrade button. The chat-path gate elsewhere uses `subscriptionStatus`
  // directly, so a non-active "paid" mode here doesn't unlock quota.
  if (initial === "paid" && !isSignedIn && !isEntitled) {
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
  /**
   * Proactive notifications — Chappie speaks up on its own. Each
   * source has its own toggle (no separate master switch); defaults
   * are OFF so a fresh install stays silent until the user opts in.
   * Times are HH:MM in the user's local timezone. Quiet hours apply
   * to all proactive output so the user can sleep without being
   * woken up.
   */
  proactiveMorningBriefEnabled: boolean;
  proactiveMorningBriefTime: string;
  proactiveCalendarEnabled: boolean;
  proactiveCalendarLeadMin: number;
  proactiveWeatherEnabled: boolean;
  proactiveIdleChatterEnabled: boolean;
  proactiveIdleChatterAfterMin: number;
  proactiveQuietHoursStart: string;
  proactiveQuietHoursEnd: string;
  /**
   * Cosine-similarity threshold for the speaker recognition gate.
   * Range / default are sourced from Rust (`speaker_threshold_range`)
   * so the slider stays in sync with what audio.rs actually compares
   * against. 0 sentinel here means "use Rust default" — loadSettings
   * normalises that to the actual default at read time.
   */
  speakerThreshold: number;
  /**
   * Silero VAD probability threshold. Lower = more sensitive to quiet
   * speech but more false positives. Range / default sourced from Rust
   * (`vad_config_range`) so the slider stays aligned with what audio.rs
   * actually uses.
   */
  vadThreshold: number;
  /**
   * Consecutive non-speech frames before the segmenter cuts the
   * utterance and ships it to Whisper. Stored as frame count (not ms)
   * so the value is meaningful without the renderer needing to know
   * the audio frame size — Settings UI converts to ms for display.
   */
  vadSilenceFrames: number;
  /**
   * Opt-in to usage analytics. When true, every chat turn is reported
   * to chappie.kkweb.io/api/analytics with the utterance + tool names +
   * lang/mode/latency. Audio is NEVER sent. Free-mode users get +10
   * daily quota as a thank-you. Default OFF.
   */
  analyticsConsent: boolean;
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
  proactiveMorningBriefEnabled: false,
  proactiveMorningBriefTime: "07:00",
  proactiveCalendarEnabled: false,
  proactiveCalendarLeadMin: 15,
  proactiveWeatherEnabled: false,
  proactiveIdleChatterEnabled: false,
  proactiveIdleChatterAfterMin: 60,
  proactiveQuietHoursStart: "07:00",
  proactiveQuietHoursEnd: "22:00",
  speakerThreshold: 0.4,
  vadThreshold: 0.25,
  vadSilenceFrames: 22,
  analyticsConsent: false,
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
  // Persist transitions where resolveMode disagrees with the store, so
  // subsequent loads agree without re-running the resolve and so other
  // windows see the change. Covers both the paid → free demote (signed
  // out + inactive) and the free → paid recovery (legacy demote bug).
  if (storedMode !== undefined && storedMode !== mode) {
    await store.set("mode", mode);
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
    proactiveMorningBriefEnabled:
      (await store.get<boolean>("proactiveMorningBriefEnabled")) ??
      DEFAULTS.proactiveMorningBriefEnabled,
    proactiveMorningBriefTime:
      (await store.get<string>("proactiveMorningBriefTime")) ??
      DEFAULTS.proactiveMorningBriefTime,
    proactiveCalendarEnabled:
      (await store.get<boolean>("proactiveCalendarEnabled")) ??
      DEFAULTS.proactiveCalendarEnabled,
    proactiveCalendarLeadMin:
      (await store.get<number>("proactiveCalendarLeadMin")) ??
      DEFAULTS.proactiveCalendarLeadMin,
    proactiveWeatherEnabled:
      (await store.get<boolean>("proactiveWeatherEnabled")) ??
      DEFAULTS.proactiveWeatherEnabled,
    proactiveIdleChatterEnabled:
      (await store.get<boolean>("proactiveIdleChatterEnabled")) ??
      DEFAULTS.proactiveIdleChatterEnabled,
    proactiveIdleChatterAfterMin:
      (await store.get<number>("proactiveIdleChatterAfterMin")) ??
      DEFAULTS.proactiveIdleChatterAfterMin,
    proactiveQuietHoursStart:
      (await store.get<string>("proactiveQuietHoursStart")) ??
      DEFAULTS.proactiveQuietHoursStart,
    proactiveQuietHoursEnd:
      (await store.get<string>("proactiveQuietHoursEnd")) ??
      DEFAULTS.proactiveQuietHoursEnd,
    speakerThreshold:
      (await store.get<number>("speakerThreshold")) ??
      DEFAULTS.speakerThreshold,
    vadThreshold:
      (await store.get<number>("vadThreshold")) ?? DEFAULTS.vadThreshold,
    vadSilenceFrames:
      (await store.get<number>("vadSilenceFrames")) ??
      DEFAULTS.vadSilenceFrames,
    analyticsConsent:
      (await store.get<boolean>("analyticsConsent")) ??
      DEFAULTS.analyticsConsent,
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
  if (patch.proactiveMorningBriefEnabled !== undefined) {
    await store.set(
      "proactiveMorningBriefEnabled",
      patch.proactiveMorningBriefEnabled,
    );
  }
  if (patch.proactiveMorningBriefTime !== undefined) {
    await store.set(
      "proactiveMorningBriefTime",
      patch.proactiveMorningBriefTime,
    );
  }
  if (patch.proactiveCalendarEnabled !== undefined) {
    await store.set("proactiveCalendarEnabled", patch.proactiveCalendarEnabled);
  }
  if (patch.proactiveCalendarLeadMin !== undefined) {
    await store.set("proactiveCalendarLeadMin", patch.proactiveCalendarLeadMin);
  }
  if (patch.proactiveWeatherEnabled !== undefined) {
    await store.set("proactiveWeatherEnabled", patch.proactiveWeatherEnabled);
  }
  if (patch.proactiveIdleChatterEnabled !== undefined) {
    await store.set(
      "proactiveIdleChatterEnabled",
      patch.proactiveIdleChatterEnabled,
    );
  }
  if (patch.proactiveIdleChatterAfterMin !== undefined) {
    await store.set(
      "proactiveIdleChatterAfterMin",
      patch.proactiveIdleChatterAfterMin,
    );
  }
  if (patch.proactiveQuietHoursStart !== undefined) {
    await store.set("proactiveQuietHoursStart", patch.proactiveQuietHoursStart);
  }
  if (patch.proactiveQuietHoursEnd !== undefined) {
    await store.set("proactiveQuietHoursEnd", patch.proactiveQuietHoursEnd);
  }
  if (patch.speakerThreshold !== undefined) {
    await store.set("speakerThreshold", patch.speakerThreshold);
  }
  if (patch.vadThreshold !== undefined) {
    await store.set("vadThreshold", patch.vadThreshold);
  }
  if (patch.vadSilenceFrames !== undefined) {
    await store.set("vadSilenceFrames", patch.vadSilenceFrames);
  }
  if (patch.analyticsConsent !== undefined) {
    await store.set("analyticsConsent", patch.analyticsConsent);
  }
  await store.save();
}

export function __resetForTests(): void {
  storePromise = null;
}
