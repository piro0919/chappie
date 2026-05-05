import { electronApp, is } from "@electron-toolkit/utils";
import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { getSettings, setSettings } from "./settings-store";
import { initTray, setTrayState, type TrayState } from "./tray";

let workerWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

const PRELOAD = join(__dirname, "../preload/index.js");
const RENDERER_FILE = join(__dirname, "../renderer/index.html");

function loadRenderer(
  win: BrowserWindow,
  view: "conversation" | "settings",
): void {
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}?view=${view}`);
  } else {
    win.loadFile(RENDERER_FILE, { query: { view } });
  }
}

function createWorkerWindow(): void {
  workerWindow = new BrowserWindow({
    show: false,
    webPreferences: { preload: PRELOAD, sandbox: false },
  });
  loadRenderer(workerWindow, "conversation");
}

function openSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 360,
    title: "Chappie 設定",
    autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, sandbox: false },
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  loadRenderer(settingsWindow, "settings");
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("io.kkweb.chappie");

  if (process.platform === "darwin") app.dock?.hide();

  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:set", (_e, patch) => {
    setSettings(patch);
    return getSettings();
  });
  ipcMain.handle("tray:setState", (_e, state: TrayState) =>
    setTrayState(state),
  );
  ipcMain.handle("window:openSettings", () => openSettingsWindow());

  initTray({ onOpenSettings: openSettingsWindow });
  createWorkerWindow();
});

// Tray-only app: stay alive when all windows close.
app.on("window-all-closed", () => {});
