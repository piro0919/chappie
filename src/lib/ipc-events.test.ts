import { describe, expect, it } from "vitest";
import { IpcEvent } from "./ipc-events";

// Locks the wire strings behind the IpcEvent registry. These values are
// the contract with the Rust `emit()` side — a rename here that isn't
// matched in src-tauri/ silently breaks the listener, so the literal
// strings are asserted explicitly rather than trusting the constant name.
describe("IpcEvent", () => {
  it("maps each constant to its exact wire string", () => {
    expect(IpcEvent).toEqual({
      speech: "speech",
      speechActive: "speech-active",
      speechBargein: "speech-bargein",
      speechDropped: "speech-dropped",
      settingsUpdated: "settings:updated",
      deepLink: "deep-link",
      log: "log",
      hudShow: "hud:show",
      trayStopSpeaking: "tray:stop_speaking",
      miniplayerVisible: "miniplayer:visible",
      modelProgress: "model:progress",
      speakerModelProgress: "speaker_model:progress",
      embeddingModelProgress: "embedding_model:progress",
      voicevoxInstallProgress: "voicevox:install_progress",
      speakerEnrollLevel: "speaker_enroll:level",
      timerFired: "timer:fired",
      reminderFired: "reminder:fired",
      proactiveFired: "proactive:fired",
    });
  });
});
