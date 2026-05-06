import React from "react";
import ReactDOM from "react-dom/client";
import { ConversationView } from "./views/ConversationView";
import { SettingsView } from "./views/SettingsView";

const view = new URLSearchParams(window.location.search).get("view");
const Root = view === "settings" ? SettingsView : ConversationView;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
