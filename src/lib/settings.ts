import { load, type Store } from "@tauri-apps/plugin-store";

export type Settings = {
  openaiApiKey: string;
  voiceURI: string | null;
  model: string;
};

const DEFAULTS: Settings = {
  openaiApiKey: "",
  voiceURI: null,
  model: "gpt-4o-mini",
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
  const model = (await store.get<string>("model")) ?? DEFAULTS.model;
  return { openaiApiKey: apiKey, voiceURI, model };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const store = await getStore();
  if (patch.openaiApiKey !== undefined) {
    await store.set("openaiApiKey", patch.openaiApiKey);
  }
  if (patch.voiceURI !== undefined) {
    await store.set("voiceURI", patch.voiceURI);
  }
  if (patch.model !== undefined) {
    await store.set("model", patch.model);
  }
  await store.save();
}

export function __resetForTests(): void {
  storePromise = null;
}
