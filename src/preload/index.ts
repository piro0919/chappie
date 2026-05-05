import { contextBridge, ipcRenderer } from "electron";

export type TrayState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export type SettingsPatch = {
  openaiApiKey?: string;
  voiceURI?: string | null;
};

const api = {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch: SettingsPatch) =>
    ipcRenderer.invoke("settings:set", patch),
  setTrayState: (state: TrayState) =>
    ipcRenderer.invoke("tray:setState", state),
  openSettings: () => ipcRenderer.invoke("window:openSettings"),
};

try {
  contextBridge.exposeInMainWorld("api", api);
} catch (error) {
  console.error(error);
}

export type Api = typeof api;
