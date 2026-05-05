import Store from "electron-store";

export type Settings = {
  openaiApiKey: string;
  voiceURI: string | null;
};

const store = new Store<Settings>({
  defaults: { openaiApiKey: "", voiceURI: null },
  name: "chappie-settings",
});

export function getSettings(): Settings {
  return {
    openaiApiKey: store.get("openaiApiKey"),
    voiceURI: store.get("voiceURI"),
  };
}

export function setSettings(patch: Partial<Settings>): void {
  if (patch.openaiApiKey !== undefined)
    store.set("openaiApiKey", patch.openaiApiKey);
  if (patch.voiceURI !== undefined) store.set("voiceURI", patch.voiceURI);
}
