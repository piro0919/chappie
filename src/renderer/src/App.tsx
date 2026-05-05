import { useEffect, useState } from "react";
import { ConversationView } from "./views/ConversationView";
import { SettingsView } from "./views/SettingsView";

function getView(): "conversation" | "settings" {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "settings" ? "settings" : "conversation";
}

function App(): React.JSX.Element {
  const [view] = useState(getView());
  useEffect(() => {
    document.title = view === "settings" ? "Chappie 設定" : "Chappie";
  }, [view]);
  return view === "settings" ? <SettingsView /> : <ConversationView />;
}

export default App;
