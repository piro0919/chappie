import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { usePermissionStatus } from "../hooks/usePermissionStatus";
import { resolveLanguage } from "../i18n/messages";
import { useT } from "../i18n/useT";
import { detectProvider, providerLabel } from "../lib/provider";
import {
  hasPersistedAutostart,
  type Language,
  loadSettings,
  type Mode,
  type Settings,
  saveSettings,
} from "../lib/settings";
import {
  getInstallStatus,
  onInstallProgress,
  startInstall,
  uninstall,
} from "../lib/voicevox-install";
import "./SettingsView.global.css";
import styles from "./SettingsView.module.css";

type MicStatus = "granted" | "denied" | "restricted" | "not_determined";
type ScreenStatus = "granted" | "denied";
type CalendarStatus = "granted" | "denied" | "restricted" | "not_determined";
type LocationStatus = "granted" | "denied" | "restricted" | "not_determined";

const MIC_PRIVACY_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
const LOCATION_PRIVACY_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices";

export function SettingsView() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("free");
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
  const mic = usePermissionStatus<MicStatus>({
    initial: "not_determined",
    checkCommand: "check_microphone_permission",
    requestCommand: "request_microphone_access",
  });
  const screen = usePermissionStatus<ScreenStatus>({
    initial: "denied",
    checkCommand: "check_screen_recording_permission",
    requestCommand: "request_screen_recording_access",
  });
  const calendar = usePermissionStatus<CalendarStatus>({
    initial: "not_determined",
    checkCommand: "calendar_status",
    requestCommand: "request_calendar_access",
  });
  const location = usePermissionStatus<LocationStatus>({
    initial: "not_determined",
    checkCommand: "location_permission_status",
    requestCommand: "request_location_permission",
  });
  // Speaker enrollment: "idle" = nothing happening, "downloading" = pulling
  // the ONNX model on first use, "recording" = capturing voice for ~5s,
  // "enrolling" = sending samples to Rust + waiting for save.
  type SpeakerPhase =
    | { kind: "idle" }
    | { kind: "downloading"; pct: number }
    | { kind: "recording"; remaining: number; phraseIndex: number }
    | { kind: "enrolling" };
  const [speakerEnrolled, setSpeakerEnrolled] = useState(false);
  const [speakerPhase, setSpeakerPhase] = useState<SpeakerPhase>({
    kind: "idle",
  });
  const [speakerError, setSpeakerError] = useState<string | null>(null);
  const [speakerLevel, setSpeakerLevel] = useState(0);
  const ENROLL_PHRASE_SECONDS = 3;
  const ENROLL_PHRASE_COUNT = 3;
  const ENROLL_SECONDS = ENROLL_PHRASE_SECONDS * ENROLL_PHRASE_COUNT;

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: init runs once
  useEffect(() => {
    void (async () => {
      const s: Settings = await loadSettings();
      setMode(s.mode);
      setApiKey(s.openaiApiKey);
      setLanguage(s.language);
      // The persisted preference is the source of truth for the
      // checkbox; the System Events login-item entry can get silently
      // dropped when the updater replaces the .app, which would
      // otherwise show the box as unchecked on first open after an
      // upgrade. Reconcile the two: persisted == false but plugin says
      // true means we should disable; persisted == true but plugin
      // says false means restore. ConversationWorker also does this
      // on launch so the next boot honors the preference even if the
      // user never opens this window.
      const actuallyEnabled = await isAutostartEnabled().catch(() => false);
      const persisted = await hasPersistedAutostart();
      const desired = persisted ? s.autostart : actuallyEnabled;
      if (desired && !actuallyEnabled) {
        await enableAutostart().catch((e) =>
          console.warn("[settings] autostart re-heal failed", e),
        );
      } else if (!desired && actuallyEnabled) {
        await disableAutostart().catch((e) =>
          console.warn("[settings] autostart cleanup failed", e),
        );
      }
      setAutostart(desired);
      await mic.refresh();
      await screen.refresh();
      await calendar.refresh();
      await location.refresh();
      await refreshVoicevoxStatus();
      try {
        setSpeakerEnrolled(await invoke<boolean>("speaker_is_enrolled"));
      } catch {}
      await refreshLtmStatus();
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
    // Speaker model download progress — fires while ensure_speaker_model
    // pulls the ECAPA ONNX from Hugging Face on first enrollment.
    let unlistenSpeaker: (() => void) | undefined;
    void listen<{ received: number; total: number }>(
      "speaker_model:progress",
      (e) => {
        const { received, total } = e.payload;
        const pct = total > 0 ? Math.round((received / total) * 100) : 0;
        setSpeakerPhase({ kind: "downloading", pct });
      },
    ).then((u) => {
      unlistenSpeaker = u;
    });
    // Live amplitude during enrollment recording — Rust emits coarse RMS
    // every chunk so we can render a meter and reassure the user the mic
    // is actually hearing them.
    let unlistenLevel: (() => void) | undefined;
    void listen<number>("speaker_enroll:level", (e) => {
      setSpeakerLevel(e.payload);
    }).then((u) => {
      unlistenLevel = u;
    });
    // Long-term-memory model download progress. Two files (model +
    // tokenizer) stream over the same channel; the model file is the
    // overwhelming majority of bytes so we just track aggregate pct.
    let unlistenLtm: (() => void) | undefined;
    void listen<{ kind: string; received: number; total: number }>(
      "embedding_model:progress",
      (e) => {
        const { received, total } = e.payload;
        const pct = total > 0 ? Math.round((received / total) * 100) : 0;
        setLtmPhase({ kind: "downloading", pct });
      },
    ).then((u) => {
      unlistenLtm = u;
    });
    return () => {
      unlisten?.();
      unlistenSpeaker?.();
      unlistenLevel?.();
      unlistenLtm?.();
    };
  }, []);

  async function onEnrollVoice() {
    setSpeakerError(null);
    try {
      // Pull the ONNX model down if needed. ensure_speaker_model is a
      // no-op when the file is already in ~/.chappie/models/, so the
      // happy path on re-enrollment skips this step.
      setSpeakerPhase({ kind: "downloading", pct: 0 });
      await invoke("ensure_speaker_model");
      // Hand the mic to enrollment mode: audio.rs accumulates post-APM
      // samples into its buffer and skips the wake-word path while
      // recording is active.
      await invoke("start_enrollment_recording");
      setSpeakerLevel(0);
      for (let s = ENROLL_SECONDS; s > 0; s--) {
        const elapsed = ENROLL_SECONDS - s;
        const phraseIndex = Math.min(
          Math.floor(elapsed / ENROLL_PHRASE_SECONDS),
          ENROLL_PHRASE_COUNT - 1,
        );
        setSpeakerPhase({ kind: "recording", remaining: s, phraseIndex });
        await new Promise((r) => setTimeout(r, 1000));
      }
      setSpeakerLevel(0);
      setSpeakerPhase({ kind: "enrolling" });
      const samples = await invoke<number[]>("finish_enrollment_recording");
      await invoke("speaker_enroll", { samples });
      setSpeakerEnrolled(true);
      setSpeakerPhase({ kind: "idle" });
    } catch (e) {
      setSpeakerError(String(e));
      setSpeakerPhase({ kind: "idle" });
      // Best-effort: make sure we don't leave the audio pipeline stuck
      // in enrollment mode if we threw before finish_enrollment_recording.
      void invoke("finish_enrollment_recording").catch(() => {});
    }
  }

  async function onClearVoice() {
    setSpeakerError(null);
    try {
      await invoke("speaker_clear_enrollment");
      setSpeakerEnrolled(false);
    } catch (e) {
      setSpeakerError(String(e));
    }
  }

  type LtmPhase =
    | { kind: "idle" }
    | { kind: "downloading"; pct: number }
    | { kind: "wiping" };
  const [ltmEnabled, setLtmEnabled] = useState(false);
  const [ltmPhase, setLtmPhase] = useState<LtmPhase>({ kind: "idle" });
  const [ltmError, setLtmError] = useState<string | null>(null);
  const [ltmForgetDoneAt, setLtmForgetDoneAt] = useState(0);

  async function refreshLtmStatus() {
    try {
      setLtmEnabled(await invoke<boolean>("embedding_model_status"));
    } catch {}
  }

  async function onEnableLtm() {
    setLtmError(null);
    setLtmPhase({ kind: "downloading", pct: 0 });
    try {
      await invoke("ensure_embedding_model");
      await refreshLtmStatus();
      setLtmPhase({ kind: "idle" });
    } catch (e) {
      setLtmError(String(e));
      setLtmPhase({ kind: "idle" });
    }
  }

  async function onForgetLtm() {
    if (!window.confirm(t("settings.ltmForgetConfirm"))) return;
    setLtmError(null);
    setLtmPhase({ kind: "wiping" });
    try {
      await invoke("forget_long_term_memory");
      setLtmForgetDoneAt(Date.now());
      setLtmPhase({ kind: "idle" });
    } catch (e) {
      setLtmError(String(e));
      setLtmPhase({ kind: "idle" });
    }
  }

  async function onDisableLtm() {
    if (!window.confirm(t("settings.ltmDisableConfirm"))) return;
    setLtmError(null);
    try {
      await invoke("remove_embedding_model");
      await refreshLtmStatus();
    } catch (e) {
      setLtmError(String(e));
    }
  }

  const onSave = async () => {
    await saveSettings({
      mode,
      openaiApiKey: apiKey,
      language,
      autostart,
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

  const badge = micStatusBadge(mic.status);

  return (
    <main className={styles.root}>
      <h2 className={styles.sectionHeading}>{t("settings.sectionRequired")}</h2>
      {/* Microphone access */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>{t("settings.micAccess")}</span>
          <span className={`${styles.badge} ${badge.className}`}>
            <span className={styles.badgeDot} />
            {badge.label}
          </span>
        </div>
        {mic.status !== "granted" && (
          <div className={styles.actions}>
            {mic.status === "not_determined" && (
              <button
                type="button"
                className={styles.button}
                onClick={mic.request}
                disabled={mic.requesting}
              >
                {mic.requesting
                  ? t("settings.micRequesting")
                  : t("settings.micRequest")}
              </button>
            )}
            {(mic.status === "denied" || mic.status === "restricted") && (
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
              onClick={mic.refresh}
            >
              {t("settings.micRecheck")}
            </button>
          </div>
        )}
        {mic.status === "denied" && (
          <p className={styles.note}>{t("settings.micDeniedNote")}</p>
        )}
      </section>

      {/* Mode (Free / BYOK) */}
      <section className={styles.card}>
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t("settings.modeLabel")}</span>
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              <input
                type="radio"
                name="mode"
                value="free"
                checked={mode === "free"}
                onChange={() => setMode("free")}
              />{" "}
              {t("settings.modeFree")}
            </label>
            <label style={{ display: "block" }}>
              <input
                type="radio"
                name="mode"
                value="byok"
                checked={mode === "byok"}
                onChange={() => setMode("byok")}
              />{" "}
              {t("settings.modeByok")}
            </label>
          </div>
        </div>
        <p className={styles.note}>
          {mode === "free"
            ? t("settings.modeFreeNote")
            : t("settings.modeByokNote")}
        </p>
      </section>

      {/* API key — only relevant for BYOK */}
      {mode === "byok" && (
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
      )}

      <h2 className={styles.sectionHeading}>{t("settings.sectionOptional")}</h2>

      {/* Speaker recognition — paired with the microphone above:
          "can Chappie hear?" → "whose voice is it?". */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>
            {t("settings.speakerLabel")}
          </span>
          <span
            className={`${styles.badge} ${
              speakerEnrolled ? styles.badgeGranted : styles.badgeNeutral
            }`}
          >
            <span className={styles.badgeDot} />
            {speakerEnrolled
              ? t("settings.speakerStatusEnrolled")
              : t("settings.speakerStatusNotEnrolled")}
          </span>
        </div>
        <p className={styles.note}>{t("settings.speakerDescription")}</p>
        <p className={styles.note}>{t("settings.speakerPrivacy")}</p>
        {speakerPhase.kind === "downloading" && (
          <p className={styles.note}>
            {t("settings.speakerModelDownloading", {
              pct: String(speakerPhase.pct),
            })}
          </p>
        )}
        {speakerPhase.kind === "recording" &&
          (() => {
            const idx = speakerPhase.phraseIndex;
            const phraseKey = (
              ["speakerPhrase1", "speakerPhrase2", "speakerPhrase3"] as const
            )[idx];
            const meterPct = Math.min(100, Math.round(speakerLevel * 600));
            return (
              <div className={styles.enrollBox}>
                <div className={styles.enrollStep}>
                  {t("settings.speakerPhrasePrompt", {
                    cur: String(idx + 1),
                    total: String(ENROLL_PHRASE_COUNT),
                  })}
                </div>
                <p className={styles.enrollPhrase}>
                  「{t(`settings.${phraseKey}`)}」
                </p>
                <div className={styles.enrollMeter}>
                  <div
                    className={styles.enrollMeterBar}
                    style={{ width: `${meterPct}%` }}
                  />
                </div>
                <div className={styles.enrollMeterLabel}>
                  <span>
                    <span className={styles.enrollMeterDot} />
                    {t("settings.speakerRecording", {
                      seconds: String(speakerPhase.remaining),
                    })}
                  </span>
                </div>
              </div>
            );
          })()}
        {speakerPhase.kind === "enrolling" && (
          <p className={styles.note}>{t("settings.speakerEnrolling")}</p>
        )}
        {speakerError && (
          <p className={styles.note}>
            {t("settings.speakerFailed", { err: speakerError })}
          </p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={speakerPhase.kind !== "idle"}
            onClick={() => {
              void onEnrollVoice();
            }}
          >
            {speakerEnrolled
              ? t("settings.speakerReenroll")
              : t("settings.speakerEnroll")}
          </button>
          {speakerEnrolled && (
            <button
              type="button"
              className={styles.button}
              disabled={speakerPhase.kind !== "idle"}
              onClick={() => {
                void onClearVoice();
              }}
            >
              {t("settings.speakerClear")}
            </button>
          )}
        </div>
      </section>

      {/* Screen recording */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>
            {t("settings.screenAccess")}
          </span>
          <span
            className={`${styles.badge} ${screen.status === "granted" ? styles.badgeGranted : styles.badgeDenied}`}
          >
            <span className={styles.badgeDot} />
            {screen.status === "granted"
              ? t("settings.screenGranted")
              : t("settings.screenDenied")}
          </span>
        </div>
        {screen.status !== "granted" && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={screen.request}
              disabled={screen.requesting}
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
              onClick={screen.refresh}
            >
              {t("settings.micRecheck")}
            </button>
          </div>
        )}
        {screen.status === "denied" && (
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
            className={`${styles.badge} ${calendar.status === "granted" ? styles.badgeGranted : styles.badgeDenied}`}
          >
            <span className={styles.badgeDot} />
            {calendar.status === "granted"
              ? t("settings.calendarGranted")
              : t("settings.calendarDenied")}
          </span>
        </div>
        {calendar.status !== "granted" && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={calendar.request}
              disabled={calendar.requesting}
            >
              {t("settings.calendarRequest")}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={calendar.refresh}
            >
              {t("settings.micRecheck")}
            </button>
          </div>
        )}
        {calendar.status === "denied" && (
          <p className={styles.note}>{t("settings.calendarDeniedNote")}</p>
        )}
      </section>

      {/* Location access — accurate fix via CoreLocation when granted,
          otherwise falls back to IP-based estimate (city-level). The
          Japanese ISP routing problem is what makes this worth asking
          for: IP lookups default everyone to Tokyo. */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>
            {t("settings.locationAccess")}
          </span>
          <span
            className={`${styles.badge} ${location.status === "granted" ? styles.badgeGranted : styles.badgeNeutral}`}
          >
            <span className={styles.badgeDot} />
            {location.status === "granted"
              ? t("settings.locationGranted")
              : t("settings.locationDenied")}
          </span>
        </div>
        <p className={styles.note}>{t("settings.locationDescription")}</p>
        {location.status !== "granted" && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={location.request}
              disabled={location.requesting}
            >
              {t("settings.locationRequest")}
            </button>
            {(location.status === "denied" ||
              location.status === "restricted") && (
              <button
                type="button"
                className={styles.button}
                onClick={() => {
                  void openUrl(LOCATION_PRIVACY_URL).catch(() => {});
                }}
              >
                {t("settings.micOpenSystem")}
              </button>
            )}
            <button
              type="button"
              className={styles.button}
              onClick={location.refresh}
            >
              {t("settings.micRecheck")}
            </button>
          </div>
        )}
        {location.status === "denied" && (
          <p className={styles.note}>{t("settings.locationDeniedNote")}</p>
        )}
      </section>

      {/* Long-term memory (RAG) — opt-in download + privacy-safe wipe. */}
      <section className={styles.card}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>{t("settings.ltmLabel")}</span>
          <span
            className={`${styles.badge} ${
              ltmEnabled ? styles.badgeGranted : styles.badgeNeutral
            }`}
          >
            <span className={styles.badgeDot} />
            {ltmEnabled
              ? t("settings.ltmStatusEnabled")
              : t("settings.ltmStatusDisabled")}
          </span>
        </div>
        <p className={styles.note}>{t("settings.ltmDescription")}</p>
        {ltmPhase.kind === "downloading" && (
          <p className={styles.note}>
            {t("settings.ltmEnableDownloadProgress", {
              pct: String(ltmPhase.pct),
            })}
          </p>
        )}
        {ltmError && <p className={styles.note}>{ltmError}</p>}
        {ltmForgetDoneAt > 0 && Date.now() - ltmForgetDoneAt < 5000 && (
          <p className={styles.note}>{t("settings.ltmForgetDone")}</p>
        )}
        <div className={styles.actions}>
          {!ltmEnabled && (
            <button
              type="button"
              className={styles.button}
              onClick={onEnableLtm}
              disabled={ltmPhase.kind !== "idle"}
            >
              {ltmPhase.kind === "downloading"
                ? t("settings.ltmEnabling")
                : t("settings.ltmEnable")}
            </button>
          )}
          {ltmEnabled && (
            <button
              type="button"
              className={styles.button}
              onClick={onDisableLtm}
              disabled={ltmPhase.kind !== "idle"}
            >
              {t("settings.ltmDisable")}
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            onClick={onForgetLtm}
            disabled={ltmPhase.kind !== "idle"}
          >
            {t("settings.ltmForget")}
          </button>
        </div>
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
            {/* When VOICEVOX.app is already installed (kind === "bundled_app")
                Chappie just uses it — no install button is needed. */}
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
