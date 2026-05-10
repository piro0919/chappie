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
import { resolveLanguage } from "../i18n/messages";
import { useT } from "../i18n/useT";
import { detectProvider, providerLabel } from "../lib/provider";
import {
  type Language,
  loadSettings,
  type Settings,
  saveSettings,
} from "../lib/settings";
import {
  getInstallStatus,
  onInstallProgress,
  startInstall,
  uninstall,
} from "../lib/voicevox-install";
import styles from "./SettingsView.module.css";

type MicStatus = "granted" | "denied" | "restricted" | "not_determined";
type ScreenStatus = "granted" | "denied";
type CalendarStatus = "granted" | "denied" | "restricted" | "not_determined";

const MIC_PRIVACY_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";

export function SettingsView() {
  const { t } = useT();
  const [apiKey, setApiKey] = useState("");
  const [language, setLanguage] = useState<Language>("auto");
  const [autostart, setAutostart] = useState(false);
  const [voicevoxStatus, setVoicevoxStatus] = useState<
    "checking" | "connected" | "unreachable"
  >("checking");
  const [voicevoxInstallKind, setVoicevoxInstallKind] = useState<
    "managed" | "bundled_app" | "missing" | "checking"
  >("checking");
  // null = idle. Otherwise the active install phase + progress.
  const [voicevoxInstallProgress, setVoicevoxInstallProgress] = useState<{
    phase: "download" | "extract" | "verify";
    received: number;
    total: number;
  } | null>(null);
  const [voicevoxInstallError, setVoicevoxInstallError] = useState<
    string | null
  >(null);
  const [voicevoxBusy, setVoicevoxBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState("");
  const [micStatus, setMicStatus] = useState<MicStatus>("not_determined");
  const [requestingMic, setRequestingMic] = useState(false);
  const [screenStatus, setScreenStatus] = useState<ScreenStatus>("denied");
  const [requestingScreen, setRequestingScreen] = useState(false);
  const [calendarStatus, setCalendarStatus] =
    useState<CalendarStatus>("not_determined");
  const [requestingCalendar, setRequestingCalendar] = useState(false);

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

  async function refreshScreenStatus() {
    console.info("[settings] refreshScreenStatus");
    try {
      const status = await invoke<ScreenStatus>(
        "check_screen_recording_permission",
      );
      console.info("[settings] check_screen_recording_permission ->", status);
      setScreenStatus(status);
    } catch (e) {
      console.error("[settings] check_screen_recording_permission failed", e);
    }
  }

  async function refreshCalendarStatus() {
    try {
      const status = await invoke<CalendarStatus>("calendar_status");
      setCalendarStatus(status);
    } catch (e) {
      console.error("[settings] calendar_status failed", e);
    }
  }

  async function requestCalendar() {
    setRequestingCalendar(true);
    try {
      const granted = await invoke<boolean>("request_calendar_access");
      console.info("[settings] request_calendar_access ->", granted);
      await refreshCalendarStatus();
    } catch (e) {
      console.error("[settings] request_calendar_access failed", e);
    } finally {
      setRequestingCalendar(false);
    }
  }

  async function requestScreen() {
    console.info("[settings] requestScreen clicked");
    setRequestingScreen(true);
    try {
      const granted = await invoke<boolean>("request_screen_recording_access");
      console.info("[settings] request_screen_recording_access ->", granted);
      await refreshScreenStatus();
    } catch (e) {
      console.error("[settings] request_screen_recording_access failed", e);
    } finally {
      setRequestingScreen(false);
    }
  }

  async function refreshVoicevoxStatus() {
    setVoicevoxStatus("checking");
    try {
      await invoke("voicevox_speakers_list");
      setVoicevoxStatus("connected");
    } catch {
      setVoicevoxStatus("unreachable");
    }
    try {
      const s = await getInstallStatus();
      setVoicevoxInstallKind(s.kind);
    } catch {
      setVoicevoxInstallKind("missing");
    }
  }

  async function handleVoicevoxInstall() {
    setVoicevoxBusy(true);
    setVoicevoxInstallError(null);
    setVoicevoxInstallProgress({ phase: "download", received: 0, total: 0 });
    try {
      await startInstall();
      await refreshVoicevoxStatus();
    } catch (e) {
      setVoicevoxInstallError(String(e));
    } finally {
      setVoicevoxInstallProgress(null);
      setVoicevoxBusy(false);
    }
  }

  async function handleVoicevoxUninstall() {
    setVoicevoxBusy(true);
    setVoicevoxInstallError(null);
    try {
      await uninstall();
      await refreshVoicevoxStatus();
    } catch (e) {
      setVoicevoxInstallError(String(e));
    } finally {
      setVoicevoxBusy(false);
    }
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
      setLanguage(s.language);
      setAutostart(await isAutostartEnabled());
      await refreshMicStatus();
      await refreshScreenStatus();
      await refreshCalendarStatus();
      await refreshVoicevoxStatus();
      setLoaded(true);
    })();
    getVersion()
      .then(setVersion)
      .catch(() => {});
    let unlisten: (() => void) | undefined;
    void onInstallProgress((p) => {
      setVoicevoxInstallProgress(p);
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const onSave = async () => {
    await saveSettings({
      openaiApiKey: apiKey,
      language,
    });
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

      {/* Screen recording */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>
            {t("settings.screenAccess")}
          </span>
          <span
            className={`${styles.badge} ${screenStatus === "granted" ? styles.badgeGranted : styles.badgeDenied}`}
          >
            <span className={styles.badgeDot} />
            {screenStatus === "granted"
              ? t("settings.screenGranted")
              : t("settings.screenDenied")}
          </span>
        </div>
        {screenStatus !== "granted" && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={requestScreen}
              disabled={requestingScreen}
            >
              {t("settings.screenRequest")}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                void invoke("open_screen_recording_settings").catch((e) =>
                  console.error("[settings] open_screen_recording_settings", e),
                );
              }}
            >
              {t("settings.micOpenSystem")}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={refreshScreenStatus}
            >
              {t("settings.micRecheck")}
            </button>
          </div>
        )}
        {screenStatus === "denied" && (
          <p className={styles.note}>{t("settings.screenDeniedNote")}</p>
        )}
      </section>

      {/* Calendar access */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>
            {t("settings.calendarAccess")}
          </span>
          <span
            className={`${styles.badge} ${calendarStatus === "granted" ? styles.badgeGranted : styles.badgeDenied}`}
          >
            <span className={styles.badgeDot} />
            {calendarStatus === "granted"
              ? t("settings.calendarGranted")
              : t("settings.calendarDenied")}
          </span>
        </div>
        {calendarStatus !== "granted" && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={requestCalendar}
              disabled={requestingCalendar}
            >
              {t("settings.calendarRequest")}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={refreshCalendarStatus}
            >
              {t("settings.micRecheck")}
            </button>
          </div>
        )}
        {calendarStatus === "denied" && (
          <p className={styles.note}>{t("settings.calendarDeniedNote")}</p>
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
        {(() => {
          const trimmed = apiKey.trim();
          if (!trimmed) {
            return <p className={styles.note}>{t("settings.apiKeyNote")}</p>;
          }
          const provider = detectProvider(trimmed);
          if (provider) {
            return (
              <p className={styles.note}>
                {t("settings.apiKeyDetected", {
                  provider: providerLabel(provider),
                })}
              </p>
            );
          }
          return <p className={styles.note}>{t("settings.apiKeyUnknown")}</p>;
        })()}
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

      {/* VOICEVOX — Japanese only. Hide entirely when the active UI
          language is anything else, since the engine doesn't speak it.
          Uses the same resolution as the conversation loop so "auto"
          falls back to navigator.language. */}
      {resolveLanguage(language).startsWith("ja") && (
        <section className={styles.card}>
          <div className={styles.statusRow}>
            <span className={styles.statusLabel}>
              {t("settings.voicevoxLabel")}
            </span>
            <span
              className={`${styles.badge} ${
                voicevoxInstallKind === "managed" ||
                voicevoxInstallKind === "bundled_app"
                  ? styles.badgeGranted
                  : voicevoxInstallKind === "missing"
                    ? styles.badgeNeutral
                    : styles.badgeNeutral
              }`}
            >
              <span className={styles.badgeDot} />
              {voicevoxInstallKind === "managed"
                ? t("settings.voicevoxStatusManaged")
                : voicevoxInstallKind === "bundled_app"
                  ? t("settings.voicevoxStatusBundledApp")
                  : voicevoxInstallKind === "missing"
                    ? t("settings.voicevoxStatusMissing")
                    : t("settings.voicevoxStatusChecking")}
            </span>
          </div>
          {voicevoxInstallProgress && (
            <p className={styles.note}>
              {voicevoxInstallProgress.phase === "download"
                ? t("settings.voicevoxInstallProgress", {
                    received: (
                      voicevoxInstallProgress.received /
                      1024 /
                      1024
                    ).toFixed(0),
                    total:
                      voicevoxInstallProgress.total > 0
                        ? (voicevoxInstallProgress.total / 1024 / 1024).toFixed(
                            0,
                          )
                        : "?",
                  })
                : voicevoxInstallProgress.phase === "extract"
                  ? t("settings.voicevoxExtracting")
                  : t("settings.voicevoxVerifying")}
            </p>
          )}
          {voicevoxInstallError && (
            <p className={styles.note}>{voicevoxInstallError}</p>
          )}
          <div className={styles.actions}>
            {voicevoxInstallKind === "missing" && (
              <button
                type="button"
                className={styles.button}
                onClick={handleVoicevoxInstall}
                disabled={voicevoxBusy}
              >
                {voicevoxBusy
                  ? t("settings.voicevoxInstalling")
                  : t("settings.voicevoxInstall")}
              </button>
            )}
            {voicevoxInstallKind === "managed" && (
              <button
                type="button"
                className={styles.button}
                onClick={handleVoicevoxUninstall}
                disabled={voicevoxBusy}
              >
                {t("settings.voicevoxUninstall")}
              </button>
            )}
            {voicevoxInstallKind === "bundled_app" && (
              <button
                type="button"
                className={styles.button}
                onClick={handleVoicevoxInstall}
                disabled={voicevoxBusy}
              >
                {voicevoxBusy
                  ? t("settings.voicevoxInstalling")
                  : t("settings.voicevoxInstallExtra")}
              </button>
            )}
            <button
              type="button"
              className={styles.button}
              onClick={refreshVoicevoxStatus}
              disabled={voicevoxBusy}
            >
              {t("settings.voicevoxRecheck")}
            </button>
          </div>
          {voicevoxStatus === "unreachable" && (
            <p className={styles.note}>
              {t("settings.voicevoxStatusUnreachable")}
            </p>
          )}
          <p className={styles.note}>{t("settings.voicevoxCredits")}</p>
        </section>
      )}

      {/* Autostart */}
      <section className={styles.card}>
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
