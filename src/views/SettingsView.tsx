import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { loadSettings, type Settings, saveSettings } from "../lib/settings";

type MicStatus = "granted" | "denied" | "restricted" | "not_determined";

const MIC_PRIVACY_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";

const MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini（高速・低コスト）" },
  { value: "gpt-4o", label: "gpt-4o（高品質）" },
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { value: "gpt-4.1", label: "gpt-4.1" },
];

function micStatusMeta(status: MicStatus): { label: string; color: string } {
  switch (status) {
    case "granted":
      return { label: "許可済み", color: "#10b981" };
    case "denied":
      return { label: "拒否されています", color: "#ef4444" };
    case "restricted":
      return { label: "システムにより制限", color: "#ef4444" };
    default:
      return { label: "未設定", color: "#6b7280" };
  }
}

export function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [model, setModel] = useState("gpt-4o-mini");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [autostart, setAutostart] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState("");
  const [micStatus, setMicStatus] = useState<MicStatus>("not_determined");
  const [requestingMic, setRequestingMic] = useState(false);

  async function refreshMicStatus() {
    try {
      const status = await invoke<MicStatus>("check_microphone_permission");
      setMicStatus(status);
    } catch {}
  }

  async function requestMic() {
    setRequestingMic(true);
    try {
      await invoke<boolean>("request_microphone_access").catch(() => false);
      await refreshMicStatus();
    } finally {
      setRequestingMic(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: init runs once
  useEffect(() => {
    void (async () => {
      const s: Settings = await loadSettings();
      setApiKey(s.openaiApiKey);
      setVoiceURI(s.voiceURI);
      setModel(s.model);
      setAutostart(await isAutostartEnabled());
      await refreshMicStatus();
      setLoaded(true);
    })();
    getVersion()
      .then(setVersion)
      .catch(() => {});
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const onSave = async () => {
    await saveSettings({ openaiApiKey: apiKey, voiceURI, model });
    if (autostart) await enableAutostart();
    else await disableAutostart();
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

      <section
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #e5e5ea",
          borderRadius: 6,
          background: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13 }}>マイクアクセス</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: micStatusMeta(micStatus).color,
            }}
          >
            {micStatusMeta(micStatus).label}
          </span>
        </div>
        {micStatus !== "granted" && (
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            {micStatus === "not_determined" && (
              <button
                type="button"
                onClick={requestMic}
                disabled={requestingMic}
              >
                {requestingMic ? "リクエスト中…" : "マイクを許可する"}
              </button>
            )}
            {(micStatus === "denied" || micStatus === "restricted") && (
              <button
                type="button"
                onClick={() => {
                  void openUrl(MIC_PRIVACY_URL).catch(() => {});
                }}
              >
                システム設定を開く
              </button>
            )}
            <button type="button" onClick={refreshMicStatus}>
              再確認
            </button>
          </div>
        )}
        {micStatus === "denied" && (
          <p style={{ fontSize: 11, color: "#666", margin: "8px 0 0" }}>
            一度拒否すると、システム設定からのみ再有効化できます。
          </p>
        )}
      </section>

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
        モデル
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4, padding: 6 }}
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
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

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 16,
        }}
      >
        <input
          type="checkbox"
          checked={autostart}
          onChange={(e) => setAutostart(e.target.checked)}
        />
        ログイン時に自動起動する
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

      {version && (
        <div
          style={{
            marginTop: 24,
            color: "#888",
            fontSize: 11,
            textAlign: "right",
          }}
        >
          v{version}
        </div>
      )}
    </main>
  );
}
