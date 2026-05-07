import React from "react";
import ReactDOM from "react-dom/client";
import { runUpdateCheck } from "./lib/auto-update";
import { installLogBridge } from "./lib/log-bridge";
import { ConversationWorker } from "./views/ConversationWorker";
import { SettingsView } from "./views/SettingsView";

const view = new URLSearchParams(window.location.search).get("view");
const Root = view === "settings" ? SettingsView : ConversationWorker;

// Mirror Rust-side `log` events into this window's console so devtools
// becomes the single source of truth for both Rust and JS logs.
installLogBridge();

// Only the hidden conversation worker window runs the update check on launch.
if (view !== "settings") {
  void runUpdateCheck();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
