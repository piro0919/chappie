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

export type Settings = {
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
};

const DEFAULTS: Settings = {
  openaiApiKey: "",
  language: "auto",
  autostart: false,
};
const FILE = "settings.json";

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) storePromise = load(FILE, { defaults: { ...DEFAULTS } });
  return storePromise;
}

export async function loadSettings(): Promise<Settings> {
  const store = await getStore();
  const apiKey =
    (await store.get<string>("openaiApiKey")) ?? DEFAULTS.openaiApiKey;
  const language = (await store.get<Language>("language")) ?? DEFAULTS.language;
  const autostart =
    (await store.get<boolean>("autostart")) ?? DEFAULTS.autostart;
  return {
    openaiApiKey: apiKey,
    language,
    autostart,
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
  if (patch.openaiApiKey !== undefined) {
    await store.set("openaiApiKey", patch.openaiApiKey);
  }
  if (patch.language !== undefined) {
    await store.set("language", patch.language);
  }
  if (patch.autostart !== undefined) {
    await store.set("autostart", patch.autostart);
  }
  await store.save();
}

export function __resetForTests(): void {
  storePromise = null;
}
