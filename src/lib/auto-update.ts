import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

export async function runUpdateCheck(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;

    const confirmed = await ask(
      `新しいバージョン v${update.version} が利用可能です。\nアップデートしますか？`,
      {
        title: "アップデート",
        kind: "info",
        okLabel: "OK",
        cancelLabel: "キャンセル",
      },
    );
    if (!confirmed) return;

    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    console.error("update check failed", e);
  }
}
