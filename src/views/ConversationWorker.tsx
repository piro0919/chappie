import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useEffect } from "react";
import { useConversationLoop } from "../hooks/useConversationLoop";
import {
  hasPersistedAutostart,
  loadSettings,
  saveSettings,
} from "../lib/settings";

/** Headless worker for the hidden main window. Mounts the conversation loop
 *  (mic capture init, wake-word handling, OpenAI streaming, TTS) and renders
 *  nothing visible — diagnostics live in the Web Inspector console via the
 *  log bridge. The window itself is hidden by lib.rs. */
export function ConversationWorker(): null {
  useConversationLoop();

  // Self-heal the macOS Login Item every launch. The updater replaces
  // the .app bundle in /Applications, which can drop the System Events
  // login-item entry even though the user's preference (stored in
  // settings.json) hasn't changed. Without this, "launch at login"
  // silently breaks after every upgrade.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const actuallyEnabled = await isAutostartEnabled().catch(() => false);
        if (cancelled) return;
        const persisted = await hasPersistedAutostart();
        if (cancelled) return;
        if (!persisted) {
          // Pre-v0.11.1 user: settings.json has no autostart key yet.
          // Adopt the current plugin state as the persisted preference
          // so we don't clobber a Login Item the user set up before
          // we started persisting the preference.
          await saveSettings({ autostart: actuallyEnabled });
          return;
        }
        const s = await loadSettings();
        if (cancelled) return;
        if (s.autostart && !actuallyEnabled) {
          await enableAutostart();
        } else if (!s.autostart && actuallyEnabled) {
          await disableAutostart();
        }
      } catch (e) {
        console.warn("[conversation-worker] autostart self-heal failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
