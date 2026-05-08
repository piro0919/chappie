import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { loadSettings, type Settings, saveSettings } from "../lib/settings";
import styles from "./SettingsView.module.css";

type MicStatus = "granted" | "denied" | "restricted" | "not_determined";

const MIC_PRIVACY_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";

function micStatusBadge(status: MicStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "granted":
      return { label: "許可済み", className: styles.badgeGranted };
    case "denied":
      return { label: "拒否されています", className: styles.badgeDenied };
    case "restricted":
      return { label: "システムにより制限", className: styles.badgeDenied };
    default:
      return { label: "未設定", className: styles.badgeNeutral };
  }
}

export function SettingsView() {
  const [apiKey, setApiKey] = useState("");
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
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
    await saveSettings({ openaiApiKey: apiKey, voiceURI });
    try {
      if (autostart) await enableAutostart();
      else await disableAutostart();
    } catch (e) {
      console.warn("[settings] autostart toggle failed", e);
    }
    await emit("settings:updated");
    setSaved(true);
    setTimeout(() => {
      const w = getCurrentWindow();
      console.info("[settings] closing window", w.label);
      w.close()
        .then(() => console.info("[settings] close resolved"))
        .catch((e) => console.error("[settings] close failed", e));
    }, 400);
  };

  if (!loaded) {
    return <main className={styles.loading}>読み込み中…</main>;
  }

  const badge = micStatusBadge(micStatus);

  return (
    <main className={styles.root}>
      {/* Microphone access */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>マイクアクセス</span>
          <span className={`${styles.badge} ${badge.className}`}>
            <span className={styles.badgeDot} />
            {badge.label}
          </span>
        </div>
        {micStatus !== "granted" && (
          <div className={styles.actions}>
            {micStatus === "not_determined" && (
              <button
                type="button"
                className={styles.button}
                onClick={requestMic}
                disabled={requestingMic}
              >
                {requestingMic ? "リクエスト中…" : "マイクを許可する"}
              </button>
            )}
            {(micStatus === "denied" || micStatus === "restricted") && (
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  void openUrl(MIC_PRIVACY_URL).catch(() => {});
                }}
              >
                システム設定を開く
              </button>
            )}
            <button
              type="button"
              className={styles.button}
              onClick={refreshMicStatus}
            >
              再確認
            </button>
          </div>
        )}
        {micStatus === "denied" && (
          <p className={styles.note}>
            一度拒否すると、システム設定からのみ再有効化できます。
          </p>
        )}
      </section>

      {/* API key */}
      <section className={styles.card}>
        <div className={styles.row}>
          <label className={styles.rowLabel} htmlFor="api-key">
            API キー
          </label>
          <input
            id="api-key"
            type="password"
            className={styles.input}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-... / xai-... / sk-or-... / sk-ant-... / AIza..."
          />
        </div>
        <p className={styles.note}>
          OpenAI / xAI / OpenRouter / Anthropic / Gemini に対応。貼り付けた
          キーから自動でプロバイダーを判別します。
        </p>
      </section>

      {/* Voice + autostart */}
      <section className={styles.card}>
        <div className={styles.row}>
          <label className={styles.rowLabel} htmlFor="voice">
            読み上げ音声
          </label>
          <select
            id="voice"
            className={styles.select}
            value={voiceURI ?? ""}
            onChange={(e) =>
              setVoiceURI(e.target.value === "" ? null : e.target.value)
            }
          >
            <option value="">（システム既定）</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>起動</span>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={autostart}
              onChange={(e) => setAutostart(e.target.checked)}
            />
            ログイン時に自動起動する
          </label>
        </div>
      </section>

      <div className={styles.saveBar}>
        {saved && <span className={styles.savedFlash}>保存しました</span>}
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={onSave}
        >
          保存
        </button>
      </div>

      {version && <div className={styles.footer}>v{version}</div>}
    </main>
  );
}
