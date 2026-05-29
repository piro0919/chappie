// Single registry of the Tauri event names the renderer listens for /
// emits. Each value is the exact wire string the Rust side uses; the
// constant only removes the scattered string literals (and the typo /
// drift risk within the renderer) and gives one place to see the whole
// event surface. Payload shapes stay typed at each listen() callsite.
//
// NOTE: this does NOT enforce the Rust↔renderer contract — Rust keeps its
// own emit() literals. Keep the strings here in sync with the emitters in
// src-tauri/src/ when adding or renaming an event.
export const IpcEvent = {
  // Speech pipeline (audio.rs → conversation loop)
  speech: "speech",
  speechActive: "speech-active",
  speechBargein: "speech-bargein",
  // App-wide
  settingsUpdated: "settings:updated",
  deepLink: "deep-link",
  log: "log",
  // UI surfaces
  hudShow: "hud:show",
  trayStopSpeaking: "tray:stop_speaking",
  miniplayerVisible: "miniplayer:visible",
  // Model / install download progress
  modelProgress: "model:progress",
  speakerModelProgress: "speaker_model:progress",
  embeddingModelProgress: "embedding_model:progress",
  voicevoxInstallProgress: "voicevox:install_progress",
  speakerEnrollLevel: "speaker_enroll:level",
  // Scheduled / proactive fires
  timerFired: "timer:fired",
  reminderFired: "reminder:fired",
  proactiveFired: "proactive:fired",
} as const;

export type IpcEventName = (typeof IpcEvent)[keyof typeof IpcEvent];
