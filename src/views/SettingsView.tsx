import { emit } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { loadSettings, type Settings, saveSettings } from "../lib/settings";

export function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const s: Settings = await loadSettings();
      setApiKey(s.openaiApiKey);
      setVoiceURI(s.voiceURI);
      setLoaded(true);
    })();
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const onSave = async () => {
    await saveSettings({ openaiApiKey: apiKey, voiceURI });
    await emit("settings:updated");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!loaded) {
    return <main style={{ padding: 16 }}>読み込み中…</main>;
  }

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: 0 }}>Chappie 設定</h1>

      <label style={{ display: "block", marginTop: 16 }}>
        OpenAI API キー
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        読み上げ音声
        <select
          value={voiceURI ?? ""}
          onChange={(e) =>
            setVoiceURI(e.target.value === "" ? null : e.target.value)
          }
          style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
        >
          <option value="">（システム既定）</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </label>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button type="button" onClick={onSave}>
          保存
        </button>
        {saved && <span style={{ color: "#10b981" }}>保存しました</span>}
      </div>
    </main>
  );
}
