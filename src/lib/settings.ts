import { load, type Store } from "@tauri-apps/plugin-store";

export type Language = "auto" | "ja" | "en" | "es" | "fr" | "de" | "zh";

export type Settings = {
  openaiApiKey: string;
  voiceURI: string | null;
  language: Language;
};

const DEFAULTS: Settings = {
  openaiApiKey: "",
  voiceURI: null,
  language: "auto",
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
  const voiceURI =
    (await store.get<string | null>("voiceURI")) ?? DEFAULTS.voiceURI;
  const language = (await store.get<Language>("language")) ?? DEFAULTS.language;
  return { openaiApiKey: apiKey, voiceURI, language };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const store = await getStore();
  if (patch.openaiApiKey !== undefined) {
    await store.set("openaiApiKey", patch.openaiApiKey);
  }
  if (patch.voiceURI !== undefined) {
    await store.set("voiceURI", patch.voiceURI);
  }
  if (patch.language !== undefined) {
    await store.set("language", patch.language);
  }
  await store.save();
}

export function __resetForTests(): void {
  storePromise = null;
}
