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
import { useT } from "../i18n/useT";
import {
  type Language,
  loadSettings,
  type Settings,
  saveSettings,
} from "../lib/settings";
import styles from "./SettingsView.module.css";

type MicStatus = "granted" | "denied" | "restricted" | "not_determined";

const MIC_PRIVACY_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";

export function SettingsView() {
  const { t } = useT();
  const [apiKey, setApiKey] = useState("");
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("auto");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [autostart, setAutostart] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState("");
  const [micStatus, setMicStatus] = useState<MicStatus>("not_determined");
  const [requestingMic, setRequestingMic] = useState(false);

  function micStatusBadge(status: MicStatus): {
    label: string;
    className: string;
  } {
    switch (status) {
      case "granted":
        return {
          label: t("settings.micGranted"),
          className: styles.badgeGranted,
        };
      case "denied":
        return {
          label: t("settings.micDenied"),
          className: styles.badgeDenied,
        };
      case "restricted":
        return {
          label: t("settings.micRestricted"),
          className: styles.badgeDenied,
        };
      default:
        return {
          label: t("settings.micNotDetermined"),
          className: styles.badgeNeutral,
        };
    }
  }

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
      setLanguage(s.language);
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
    await saveSettings({ openaiApiKey: apiKey, voiceURI, language });
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
    return <main className={styles.loading}>{t("common.loading")}</main>;
  }

  const badge = micStatusBadge(micStatus);

  return (
    <main className={styles.root}>
      {/* Microphone access */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>{t("settings.micAccess")}</span>
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
                {requestingMic
                  ? t("settings.micRequesting")
                  : t("settings.micRequest")}
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
                {t("settings.micOpenSystem")}
              </button>
            )}
            <button
              type="button"
              className={styles.button}
              onClick={refreshMicStatus}
            >
              {t("settings.micRecheck")}
            </button>
          </div>
        )}
        {micStatus === "denied" && (
          <p className={styles.note}>{t("settings.micDeniedNote")}</p>
        )}
      </section>

      {/* API key */}
      <section className={styles.card}>
        <div className={styles.row}>
          <label className={styles.rowLabel} htmlFor="api-key">
            {t("settings.apiKey")}
          </label>
          <input
            id="api-key"
            type="password"
            className={styles.input}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("settings.apiKeyPlaceholder")}
          />
        </div>
        <p className={styles.note}>{t("settings.apiKeyNote")}</p>
      </section>

      {/* Language */}
      <section className={styles.card}>
        <div className={styles.row}>
          <label className={styles.rowLabel} htmlFor="language">
            {t("settings.languageLabel")}
          </label>
          <select
            id="language"
            className={styles.select}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            <option value="auto">{t("settings.languageAuto")}</option>
            <option value="ja">{t("settings.languageJa")}</option>
            <option value="en">{t("settings.languageEn")}</option>
            <option value="es">{t("settings.languageEs")}</option>
            <option value="fr">{t("settings.languageFr")}</option>
            <option value="de">{t("settings.languageDe")}</option>
            <option value="it">{t("settings.languageIt")}</option>
            <option value="pt">{t("settings.languagePt")}</option>
            <option value="zh">{t("settings.languageZh")}</option>
            <option value="ko">{t("settings.languageKo")}</option>
          </select>
        </div>
      </section>

      {/* Voice + autostart */}
      <section className={styles.card}>
        <div className={styles.row}>
          <label className={styles.rowLabel} htmlFor="voice">
            {t("settings.voice")}
          </label>
          <select
            id="voice"
            className={styles.select}
            value={voiceURI ?? ""}
            onChange={(e) =>
              setVoiceURI(e.target.value === "" ? null : e.target.value)
            }
          >
            <option value="">{t("settings.voiceSystemDefault")}</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.row}>
          <span className={styles.rowLabel}>
            {t("settings.autostartLabel")}
          </span>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={autostart}
              onChange={(e) => setAutostart(e.target.checked)}
            />
            {t("settings.autostartCheckbox")}
          </label>
        </div>
      </section>

      <div className={styles.saveBar}>
        {saved && (
          <span className={styles.savedFlash}>{t("settings.saved")}</span>
        )}
        <button
          type="button"
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={onSave}
        >
          {t("settings.save")}
        </button>
      </div>

      {version && <div className={styles.footer}>v{version}</div>}
    </main>
  );
}
