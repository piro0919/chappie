// Pipes Rust-side `log` events into the renderer's console so a single
// Web Inspector tab shows everything (Rust + JS). Each log line is prefixed
// with [tag] and routed to console.info / console.warn / console.error.

import { listen } from "@tauri-apps/api/event";

type LogPayload = {
  level: "info" | "warn" | "error";
  tag: string;
  message: string;
};

let installed = false;

export function installLogBridge(): void {
  if (installed) return;
  installed = true;
  void listen<LogPayload>("log", (e) => {
    const { level, tag, message } = e.payload;
    const line = `[${tag}] ${message}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.info(line);
  });
}
