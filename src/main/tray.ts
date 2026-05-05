import { app, Menu, nativeImage, Tray } from "electron";
import errorIcon from "../../resources/tray-error.png?asset";
import idleIcon from "../../resources/tray-idle.png?asset";
import listeningIcon from "../../resources/tray-listening.png?asset";
import speakingIcon from "../../resources/tray-speaking.png?asset";
import thinkingIcon from "../../resources/tray-thinking.png?asset";

export type TrayState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

const iconPathFor: Record<TrayState, string> = {
  idle: idleIcon,
  listening: listeningIcon,
  thinking: thinkingIcon,
  speaking: speakingIcon,
  error: errorIcon,
};

const labelFor: Record<TrayState, string> = {
  idle: "Chappie: 待機中",
  listening: "Chappie: 聞いています",
  thinking: "Chappie: 考え中",
  speaking: "Chappie: 喋っています",
  error: "Chappie: エラー",
};

let tray: Tray | null = null;
let onOpenSettings: () => void = () => {};
let onQuit: () => void = () => app.quit();

export function initTray(opts: {
  onOpenSettings: () => void;
  onQuit?: () => void;
}): void {
  onOpenSettings = opts.onOpenSettings;
  if (opts.onQuit) onQuit = opts.onQuit;
  tray = new Tray(nativeImage.createFromPath(iconPathFor.idle));
  setTrayState("idle");
}

export function setTrayState(state: TrayState): void {
  if (!tray) return;
  tray.setImage(nativeImage.createFromPath(iconPathFor[state]));
  tray.setToolTip(labelFor[state]);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: labelFor[state], enabled: false },
      { type: "separator" },
      { label: "設定…", click: () => onOpenSettings() },
      { label: "終了", click: () => onQuit() },
    ]),
  );
}
