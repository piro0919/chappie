import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export async function runUpdateCheck(): Promise<void> {
  try {
    const update = await check();
    if (!update) {
      void invoke("set_update_available", { available: false }).catch(() => {});
      return;
    }

    // `ask()` attaches the dialog to the current window, which forces our
    // main (hidden, debug-only) window to become visible. Stash it back to
    // hidden once the dialog returns so the user doesn't end up staring at
    // an empty "Chappie デバッグ" frame.
    const mainWindow = getCurrentWindow();
    let confirmed = false;
    try {
      confirmed = await ask(
        `新しいバージョン v${update.version} が利用可能です。\nアップデートしますか？`,
        {
          title: "アップデート",
          kind: "info",
          okLabel: "OK",
          cancelLabel: "キャンセル",
        },
      );
    } finally {
      mainWindow.hide().catch(() => {});
    }

    if (!confirmed) {
      // User dismissed — leave a 🔔 badge in the tray title so the update
      // doesn't get lost. Cleared on next successful update + relaunch.
      void invoke("set_update_available", { available: true }).catch(() => {});
      return;
    }

    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    console.error("update check failed", e);
  }
}
