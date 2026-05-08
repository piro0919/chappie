import React from "react";
import ReactDOM from "react-dom/client";
import { installLogBridge } from "./lib/log-bridge";
import { ConversationWorker } from "./views/ConversationWorker";
import { HudView } from "./views/HudView";
import { SettingsView } from "./views/SettingsView";

const view = new URLSearchParams(window.location.search).get("view");
const Root =
  view === "settings"
    ? SettingsView
    : view === "hud"
      ? HudView
      : ConversationWorker;

// Mirror Rust-side `log` events into this window's console so devtools
// becomes the single source of truth for both Rust and JS logs.
installLogBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
