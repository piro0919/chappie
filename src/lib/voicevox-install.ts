// Renderer-side wrapper for the Rust `voicevox_install_status` /
// `voicevox_install` / `voicevox_uninstall` Tauri commands.
//
// The Settings view uses these to show install state and drive the
// install / uninstall buttons. Progress is delivered through a Tauri
// event because install is a long-running multi-phase operation
// (download → extract → spawn).

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { IpcEvent } from "./ipc-events";

export type InstallKind = "managed" | "bundled_app" | "missing";

export interface InstallStatus {
  kind: InstallKind;
  /** Path to the engine binary if found. */
  path: string | null;
  /** Currently-active engine HTTP URL the renderer talks to. */
  engine_url: string;
  /** Whether the engine answers a /version probe right now. */
  reachable: boolean;
}

export type InstallPhase = "download" | "extract" | "verify";

export interface InstallProgress {
  phase: InstallPhase;
  /** Bytes received so far (download phase only; 0 otherwise). */
  received: number;
  /** Total bytes (download phase only; 0 if unknown / not download). */
  total: number;
}

export async function getInstallStatus(): Promise<InstallStatus> {
  return invoke<InstallStatus>("voicevox_install_status");
}

export async function startInstall(): Promise<void> {
  await invoke("voicevox_install");
}

export async function uninstall(): Promise<void> {
  await invoke("voicevox_uninstall");
}

/** Subscribe to install progress events. Returns an unlisten fn the
 *  caller MUST invoke on cleanup to avoid leaking the listener. */
export async function onInstallProgress(
  cb: (p: InstallProgress) => void,
): Promise<UnlistenFn> {
  return listen<InstallProgress>(IpcEvent.voicevoxInstallProgress, (e) =>
    cb(e.payload),
  );
}
