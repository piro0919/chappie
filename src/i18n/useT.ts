import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { type Language, loadSettings } from "../lib/settings";
import { type MessageKey, t as tRaw } from "./messages";

export function useT(): {
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  language: Language;
} {
  const [language, setLanguage] = useState<Language>("auto");

  useEffect(() => {
    void loadSettings().then((s) => setLanguage(s.language));
    const unlistenPromise = listen("settings:updated", () => {
      void loadSettings().then((s) => setLanguage(s.language));
    });
    return () => {
      void unlistenPromise.then((u) => u());
    };
  }, []);

  return {
    t: (key, params) => tRaw(language, key, params),
    language,
  };
}
