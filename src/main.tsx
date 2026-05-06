import React from "react";
import ReactDOM from "react-dom/client";
import { runUpdateCheck } from "./lib/auto-update";
import { ConversationView } from "./views/ConversationView";
import { SettingsView } from "./views/SettingsView";

const view = new URLSearchParams(window.location.search).get("view");
const Root = view === "settings" ? SettingsView : ConversationView;

// Only the hidden conversation worker window runs the update check on launch.
if (view !== "settings") {
  void runUpdateCheck();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
