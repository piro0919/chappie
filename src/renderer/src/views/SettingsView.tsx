import { useEffect, useState } from "react";
import { api } from "../ipc";

export function SettingsView(): React.JSX.Element {
  const [apiKey, setApiKey] = useState("");
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api()
      .getSettings()
      .then((s) => {
        setApiKey(s.openaiApiKey);
        setVoiceURI(s.voiceURI);
      });
    const refreshVoices = (): void =>
      setVoices(window.speechSynthesis.getVoices());
    refreshVoices();
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () =>
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        refreshVoices,
      );
  }, []);

  const onSave = async (): Promise<void> => {
    await api().setSettings({ openaiApiKey: apiKey, voiceURI });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 18, marginTop: 0 }}>Chappie 設定</h1>
      <label style={{ display: "block", marginTop: 12 }}>
        OpenAI API キー
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        読み上げ音声
        <select
          value={voiceURI ?? ""}
          onChange={(e) => setVoiceURI(e.target.value || null)}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        >
          <option value="">（システム既定）</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={onSave} style={{ marginTop: 16 }}>
        保存
      </button>
      {saved && <span style={{ marginLeft: 8 }}>保存しました</span>}
    </div>
  );
}
