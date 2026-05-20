import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { ask } from "@tauri-apps/plugin-dialog";
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
  type SubscriptionStatus,
  saveSettings,
} from "../lib/settings";
import {
  installDeepLinkHandler,
  openCheckout,
  openPortal,
  refreshStatus,
  restoreSession,
  sendMagicLink,
  signOut as supabaseSignOut,
} from "../lib/supabase-client";
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
  const [proactiveMorningBriefEnabled, setProactiveMorningBriefEnabled] =
    useState(false);
  const [proactiveMorningBriefTime, setProactiveMorningBriefTime] =
    useState("07:00");
  const [proactiveCalendarEnabled, setProactiveCalendarEnabled] =
    useState(false);
  const [proactiveCalendarLeadMin, setProactiveCalendarLeadMin] = useState(15);
  const [proactiveWeatherEnabled, setProactiveWeatherEnabled] = useState(false);
  const [proactiveIdleChatterEnabled, setProactiveIdleChatterEnabled] =
    useState(false);
  const [proactiveIdleChatterAfterMin, setProactiveIdleChatterAfterMin] =
    useState(60);
  const [proactiveQuietHoursStart, setProactiveQuietHoursStart] =
    useState("07:00");
  const [proactiveQuietHoursEnd, setProactiveQuietHoursEnd] = useState("22:00");
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [analyticsRecent, setAnalyticsRecent] = useState<
    Array<{
      ts_unix: number;
      utterance: string;
      tool_calls: string[];
      lang: string;
      mode: string;
      success: boolean;
    }>
  >([]);
  const [analyticsRecentOpen, setAnalyticsRecentOpen] = useState(false);
  const [subscriptionEmail, setSubscriptionEmail] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>("inactive");
  const subscriptionEntitled =
    subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const [subscriptionPeriodEnd, setSubscriptionPeriodEnd] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [subscriptionBusy, setSubscriptionBusy] = useState<
    "idle" | "sending" | "checkout" | "portal"
  >("idle");
  const [subscriptionNotice, setSubscriptionNotice] = useState<
    "sent" | "send_error" | null
  >(null);
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
  const [speakerThreshold, setSpeakerThreshold] = useState(0.4);
  const [speakerThresholdRange, setSpeakerThresholdRange] = useState<{
    min: number;
    max: number;
    default: number;
  }>({ min: 0.3, max: 0.55, default: 0.4 });
  const [vadThreshold, setVadThreshold] = useState(0.25);
  const [vadSilenceFrames, setVadSilenceFrames] = useState(22);
  const [vadConfigRange, setVadConfigRange] = useState<{
    threshold: { min: number; max: number; default: number };
    silenceFrames: { min: number; max: number; default: number };
    frameMs: number;
  }>({
    threshold: { min: 0.15, max: 0.5, default: 0.25 },
    silenceFrames: { min: 12, max: 38, default: 22 },
    frameMs: 32,
  });
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
      setSubscriptionEmail(s.subscriptionEmail);
      setSubscriptionStatus(s.subscriptionStatus);
      setSubscriptionPeriodEnd(s.subscriptionPeriodEnd);
      setProactiveMorningBriefEnabled(s.proactiveMorningBriefEnabled);
      setProactiveMorningBriefTime(s.proactiveMorningBriefTime);
      setProactiveCalendarEnabled(s.proactiveCalendarEnabled);
      setProactiveCalendarLeadMin(s.proactiveCalendarLeadMin);
      setProactiveWeatherEnabled(s.proactiveWeatherEnabled);
      setProactiveIdleChatterEnabled(s.proactiveIdleChatterEnabled);
      setProactiveIdleChatterAfterMin(s.proactiveIdleChatterAfterMin);
      setProactiveQuietHoursStart(s.proactiveQuietHoursStart);
      setProactiveQuietHoursEnd(s.proactiveQuietHoursEnd);
      setSpeakerThreshold(s.speakerThreshold);
      setVadThreshold(s.vadThreshold);
      setVadSilenceFrames(s.vadSilenceFrames);
      setAnalyticsConsent(s.analyticsConsent);
      // Mirror the stored consent flag into the Rust process so the
      // dispatch hot path doesn't run with a stale default-false until
      // the first toggle. Cached-only invoke, no network round-trip.
      try {
        await invoke("analytics_set_consent_cached", {
          consent: s.analyticsConsent,
        });
      } catch {}
      try {
        const [min, max, def] = await invoke<[number, number, number]>(
          "speaker_threshold_range",
        );
        setSpeakerThresholdRange({ min, max, default: def });
      } catch {}
      try {
        const r = await invoke<{
          threshold: { min: number; max: number; default: number };
          silenceFrames: { min: number; max: number; default: number };
          frameMs: number;
        }>("vad_config_range");
        setVadConfigRange(r);
      } catch {}
      // Hydrate supabase-js and pull live subscription state in the
      // background. If the network is down we'll just keep showing the
      // cached values from settings.json.
      void (async () => {
        try {
          await restoreSession();
          const me = await refreshStatus();
          if (me) {
            setSubscriptionEmail(me.email);
            setSubscriptionPeriodEnd(me.current_period_end ?? "");
            setSubscriptionStatus(
              me.paid
                ? me.status === "trialing"
                  ? "trialing"
                  : "active"
                : me.status === "canceled"
                  ? "canceled"
                  : "inactive",
            );
          }
        } catch {
          // network / token errors are non-fatal; the UI already shows cached state
        }
      })();
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
    // Subscription state can change without us doing anything (post-checkout
    // deep link handled by ConversationWorker, webhook updates in Supabase).
    // Listen to settings:updated and refresh from settings.json.
    let unlistenSettings: (() => void) | undefined;
    void listen("settings:updated", async () => {
      const s = await loadSettings();
      setSubscriptionEmail(s.subscriptionEmail);
      setSubscriptionStatus(s.subscriptionStatus);
      setSubscriptionPeriodEnd(s.subscriptionPeriodEnd);
    }).then((u) => {
      unlistenSettings = u;
    });
    // Also install a deep-link handler scoped to this window so a
    // chappie://refresh that arrives while Settings is foregrounded
    // triggers immediate refresh.
    let unlistenDeepLink: (() => void) | undefined;
    void installDeepLinkHandler().then((u) => {
      unlistenDeepLink = u;
    });
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
      unlistenSettings?.();
      unlistenDeepLink?.();
    };
  }, []);

  async function handleSendMagicLink() {
    setSubscriptionNotice(null);
    setSubscriptionBusy("sending");
    try {
      await sendMagicLink(emailInput.trim());
      setSubscriptionNotice("sent");
    } catch (e) {
      console.warn("[settings] magic link send failed", e);
      setSubscriptionNotice("send_error");
    } finally {
      setSubscriptionBusy("idle");
    }
  }

  async function handleUpgrade() {
    setSubscriptionBusy("checkout");
    try {
      const url = await openCheckout();
      if (url) {
        await openUrl(url);
      }
    } catch (e) {
      console.warn("[settings] checkout open failed", e);
    } finally {
      setSubscriptionBusy("idle");
    }
  }

  async function handleManage() {
    setSubscriptionBusy("portal");
    try {
      const url = await openPortal();
      if (url) {
        await openUrl(url);
      }
    } catch (e) {
      console.warn("[settings] portal open failed", e);
    } finally {
      setSubscriptionBusy("idle");
    }
  }

  async function handleSignOut() {
    await supabaseSignOut();
    setSubscriptionEmail("");
    setSubscriptionStatus("inactive");
    setSubscriptionPeriodEnd("");
    setEmailInput("");
    setSubscriptionNotice(null);
    // Tell the conversation loop to drop the token.
    await emit("settings:updated", {});
  }

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
    if (!(await ask(t("settings.ltmForgetConfirm")))) return;
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
    if (!(await ask(t("settings.ltmDisableConfirm")))) return;
    setLtmError(null);
    try {
      await invoke("remove_embedding_model");
      await refreshLtmStatus();
    } catch (e) {
      setLtmError(String(e));
    }
  }

  async function onToggleAnalyticsConsent(next: boolean) {
    // ON: explicit consent step before the toggle commits. Tier-aware
    // copy (Free gets the quota perk line, others get the plain ask),
    // with button labels matching the inviting tone instead of the
    // default OK / Cancel.
    if (next) {
      const msg =
        mode === "free"
          ? t("settings.analyticsConsentModalFree")
          : t("settings.analyticsConsentModalOther");
      const agreed = await ask(msg, {
        okLabel: t("settings.analyticsConsentOk"),
        cancelLabel: t("settings.analyticsConsentCancel"),
      });
      if (!agreed) return;
    }
    setAnalyticsBusy(true);
    try {
      await invoke("analytics_set_consent", { consent: next });
      setAnalyticsConsent(next);
    } catch (e) {
      console.warn("[settings] analytics consent toggle failed", e);
    } finally {
      setAnalyticsBusy(false);
    }
  }

  async function onDeleteAnalyticsHistory() {
    if (!(await ask(t("settings.analyticsDeleteConfirm")))) return;
    setAnalyticsBusy(true);
    try {
      await invoke("analytics_delete_history");
      setAnalyticsConsent(false);
      setAnalyticsRecent([]);
    } catch (e) {
      console.warn("[settings] analytics delete failed", e);
    } finally {
      setAnalyticsBusy(false);
    }
  }

  async function onRefreshAnalyticsRecent() {
    try {
      const r = await invoke<typeof analyticsRecent>("analytics_recent_events");
      setAnalyticsRecent(r);
    } catch (e) {
      console.warn("[settings] analytics recent failed", e);
    }
  }

  // Auto-save: persist every form-state change after a 300ms debounce.
  // Replaces the explicit save button — matches the macOS System
  // Settings idiom where toggling a control immediately commits, no
  // confirmation step. The debounce keeps text inputs (apiKey, time
  // fields, slider drags) from hammering the tauri-plugin-store on
  // every keystroke / pixel. `loaded` gates the effect so initial
  // hydration doesn't re-save what we just read.
  useEffect(() => {
    if (!loaded) return;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          await saveSettings({
            mode,
            openaiApiKey: apiKey,
            language,
            autostart,
            proactiveMorningBriefEnabled,
            proactiveMorningBriefTime,
            proactiveCalendarEnabled,
            proactiveCalendarLeadMin,
            proactiveWeatherEnabled,
            proactiveIdleChatterEnabled,
            proactiveIdleChatterAfterMin,
            proactiveQuietHoursStart,
            proactiveQuietHoursEnd,
            speakerThreshold,
            vadThreshold,
            vadSilenceFrames,
            analyticsConsent,
          });
          await invoke("set_speaker_threshold", { value: speakerThreshold });
          await invoke("set_vad_threshold", { value: vadThreshold });
          await invoke("set_vad_silence_frames", { frames: vadSilenceFrames });
          if (autostart) await enableAutostart();
          else await disableAutostart();
          await emit("settings:updated");
        } catch (e) {
          console.warn("[settings] auto-save failed", e);
        }
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [
    loaded,
    mode,
    apiKey,
    language,
    autostart,
    proactiveMorningBriefEnabled,
    proactiveMorningBriefTime,
    proactiveCalendarEnabled,
    proactiveCalendarLeadMin,
    proactiveWeatherEnabled,
    proactiveIdleChatterEnabled,
    proactiveIdleChatterAfterMin,
    proactiveQuietHoursStart,
    proactiveQuietHoursEnd,
    speakerThreshold,
    vadThreshold,
    vadSilenceFrames,
    analyticsConsent,
  ]);

  if (!loaded) {
    return <main className={styles.loading}>{t("common.loading")}</main>;
  }

  const badge = micStatusBadge(mic.status);

  return (
    <main className={styles.root}>
      {/* Mode (Free / Pro / BYOK). The selected mode reveals its own
          config below the radio — Pro shows magic-link sign-in /
          subscription status, BYOK shows the API key input, Free has
          nothing else to configure. */}
      <div className={styles.group}>
        {/* Horizontal radios — 3 mutually-exclusive options fit
            comfortably on one row and visually weigh less than the
            stacked layout. The "Pro 有効" entitlement marker that
            used to sit next to the BYOK label is dropped here; it
            was duplicated by the Pro panel below and its position
            next to BYOK was misleading (looked like a BYOK badge).
            Free is disabled while the user has an entitled
            subscription — paying and falling back to the 5/day
            quota would be a UX foot-gun. */}
        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.modeLabel")}
          </span>
          <div
            className={styles.groupRowActions}
            style={{ gap: 16, flexWrap: "wrap" }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: subscriptionEntitled ? 0.5 : 1,
              }}
            >
              <input
                type="radio"
                name="mode"
                value="free"
                checked={mode === "free"}
                disabled={subscriptionEntitled}
                onChange={() => setMode("free")}
              />
              {t("settings.modeFree")}
            </label>
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="radio"
                name="mode"
                value="paid"
                checked={mode === "paid"}
                onChange={() => setMode("paid")}
              />
              {t("settings.modePaid")}
            </label>
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="radio"
                name="mode"
                value="byok"
                checked={mode === "byok"}
                onChange={() => setMode("byok")}
              />
              {t("settings.modeByok")}
            </label>
          </div>
        </div>
        <div className={styles.groupBlock}>
          <p className={styles.note} style={{ marginTop: 0 }}>
            {mode === "free"
              ? t("settings.modeFreeNote")
              : mode === "paid"
                ? t("settings.modePaidNote")
                : t("settings.modeByokNote")}
          </p>
        </div>
      </div>

      {/* Account group — separated from the Mode group so the mode
          selector row looks like every other 1-row group. Holds
          everything tied to the user's identity: Pro sign-in / status
          (visible when on the Paid radio OR already signed in), plus
          the BYOK API key input. Both panels can coexist for a Pro
          subscriber who prefers BYOK for chat. */}
      {(mode === "paid" || mode === "byok" || !!subscriptionEmail) && (
        <div className={styles.group}>
          {(mode === "paid" || !!subscriptionEmail) && (
            <div
              className={styles.groupBlock}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {!subscriptionEmail ? (
                <>
                  <p className={styles.note} style={{ marginTop: 0 }}>
                    {t("settings.subscriptionSignedOut")}
                  </p>
                  <input
                    type="email"
                    className={styles.input}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder={t("settings.subscriptionEmailPlaceholder")}
                    autoComplete="email"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={handleSendMagicLink}
                    disabled={
                      subscriptionBusy === "sending" ||
                      !emailInput.includes("@")
                    }
                    style={{ alignSelf: "flex-end" }}
                  >
                    {t("settings.subscriptionSendMagicLink")}
                  </button>
                  {subscriptionNotice === "sent" && (
                    <p className={styles.note} style={{ marginTop: 0 }}>
                      {t("settings.subscriptionMagicLinkSent")}
                    </p>
                  )}
                  {subscriptionNotice === "send_error" && (
                    <p className={styles.note} style={{ marginTop: 0 }}>
                      {t("settings.subscriptionSendError")}
                    </p>
                  )}
                </>
              ) : subscriptionStatus === "active" ||
                subscriptionStatus === "trialing" ? (
                /* Active subscriber: collapse status + buttons into
                     a single row. Email on the left (signals who is
                     signed in), Pro badge + renewal date next to it,
                     manage / sign-out buttons right-aligned. Replaces
                     the previous 4-line stack which felt scattered. */
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 13 }}>{subscriptionEmail}</span>
                    <span
                      className={styles.note}
                      style={{ marginTop: 2, color: "#2a7a2a" }}
                    >
                      ✓ {t("settings.subscriptionProActive")}
                      {subscriptionPeriodEnd &&
                        ` · ${t("settings.subscriptionPeriodEnd", {
                          date: subscriptionPeriodEnd.slice(0, 10),
                        })}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleManage}
                      disabled={subscriptionBusy === "portal"}
                    >
                      {t("settings.subscriptionManage")}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={subscriptionBusy !== "idle"}
                    >
                      {t("settings.subscriptionSignOut")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={styles.note} style={{ marginTop: 0 }}>
                    {t("settings.subscriptionStatusFreeNote")}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleUpgrade}
                      disabled={subscriptionBusy === "checkout"}
                    >
                      {subscriptionBusy === "checkout"
                        ? t("settings.subscriptionUpgrading")
                        : t("settings.subscriptionUpgrade")}
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={subscriptionBusy !== "idle"}
                    >
                      {t("settings.subscriptionSignOut")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* BYOK panel: API key input + provider detection hint. */}
          {mode === "byok" && (
            <div className={styles.groupBlock}>
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
              {(() => {
                const trimmed = apiKey.trim();
                if (!trimmed) {
                  return (
                    <p className={styles.note}>{t("settings.apiKeyNote")}</p>
                  );
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
                return (
                  <p className={styles.note}>{t("settings.apiKeyUnknown")}</p>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Speaker recognition — paired with the microphone above:
          "can Chappie hear?" → "whose voice is it?". Top row mirrors
          the permission group rows; description / slider / enroll
          flow live in groupBlock children separated by thin lines. */}
      <div className={styles.group}>
        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.speakerLabel")}
          </span>
          <div className={styles.groupRowActions}>
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
            <button
              type="button"
              className={styles.iconButton}
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
                className={styles.iconButton}
                disabled={speakerPhase.kind !== "idle"}
                onClick={() => {
                  void onClearVoice();
                }}
              >
                {t("settings.speakerClear")}
              </button>
            )}
          </div>
        </div>
        {(speakerPhase.kind !== "idle" || speakerError) && (
          <div className={styles.groupBlock}>
            {speakerPhase.kind === "downloading" && (
              <p className={styles.note} style={{ marginTop: 0 }}>
                {t("settings.speakerModelDownloading", {
                  pct: String(speakerPhase.pct),
                })}
              </p>
            )}
            {speakerPhase.kind === "enrolling" && (
              <p className={styles.note} style={{ marginTop: 0 }}>
                {t("settings.speakerEnrolling")}
              </p>
            )}
            {speakerError && (
              <p className={styles.note} style={{ marginTop: 0 }}>
                {t("settings.speakerFailed", { err: speakerError })}
              </p>
            )}
            {speakerPhase.kind === "recording" &&
              (() => {
                const idx = speakerPhase.phraseIndex;
                const phraseKey = (
                  [
                    "speakerPhrase1",
                    "speakerPhrase2",
                    "speakerPhrase3",
                  ] as const
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
          </div>
        )}
        {speakerEnrolled && (
          <div className={styles.groupBlock}>
            <div className={styles.thresholdLabel}>
              <span>{t("settings.speakerStrictnessLabel")}</span>
              <span className={styles.thresholdValue}>
                {speakerThreshold.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={speakerThresholdRange.min}
              max={speakerThresholdRange.max}
              step={0.01}
              value={speakerThreshold}
              onChange={(e) => setSpeakerThreshold(parseFloat(e.target.value))}
              className={styles.thresholdSlider}
            />
            <div className={styles.thresholdScale}>
              <span>{t("settings.speakerStrictnessLow")}</span>
              <span>{t("settings.speakerStrictnessHigh")}</span>
            </div>
            <p className={styles.note}>{t("settings.speakerStrictnessHint")}</p>
          </div>
        )}
      </div>

      {/* VAD tuning — deep audio-pipeline knobs for users whose room
          or voice doesn't match Silero V5 defaults. Hidden behind a
          disclosure so first-time users aren't intimidated. */}
      <div className={styles.group}>
        <details className={styles.groupBlock}>
          <summary className={styles.groupRowLabel}>
            {t("settings.vadLabel")}
          </summary>
          <div className={styles.thresholdBox}>
            <div className={styles.thresholdLabel}>
              <span>{t("settings.vadSensitivityLabel")}</span>
              <span className={styles.thresholdValue}>
                {vadThreshold.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={vadConfigRange.threshold.min}
              max={vadConfigRange.threshold.max}
              step={0.01}
              value={vadThreshold}
              onChange={(e) => setVadThreshold(parseFloat(e.target.value))}
              className={styles.thresholdSlider}
            />
            <div className={styles.thresholdScale}>
              <span>{t("settings.vadSensitivityHigh")}</span>
              <span>{t("settings.vadSensitivityLow")}</span>
            </div>
            <p className={styles.note}>{t("settings.vadSensitivityHint")}</p>
          </div>
          <div className={styles.thresholdBox}>
            <div className={styles.thresholdLabel}>
              <span>{t("settings.vadSilenceLabel")}</span>
              <span className={styles.thresholdValue}>
                {t("settings.vadSilenceMs", {
                  ms: String(vadSilenceFrames * vadConfigRange.frameMs),
                })}
              </span>
            </div>
            <input
              type="range"
              min={vadConfigRange.silenceFrames.min}
              max={vadConfigRange.silenceFrames.max}
              step={1}
              value={vadSilenceFrames}
              onChange={(e) =>
                setVadSilenceFrames(parseInt(e.target.value, 10))
              }
              className={styles.thresholdSlider}
            />
            <div className={styles.thresholdScale}>
              <span>{t("settings.vadSilenceShort")}</span>
              <span>{t("settings.vadSilenceLong")}</span>
            </div>
            <p className={styles.note}>{t("settings.vadSilenceHint")}</p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setVadThreshold(vadConfigRange.threshold.default);
                setVadSilenceFrames(vadConfigRange.silenceFrames.default);
              }}
            >
              {t("settings.vadReset")}
            </button>
          </div>
        </details>
      </div>

      {/* All 4 macOS permissions in one group with thin separators.
          Mic is required; the other three are optional. Each row is
          label + status badge + (when not granted) one contextual
          button. usePermissionStatus auto-refreshes on window focus
          so the manual "Recheck" button is gone. */}
      <div className={styles.group}>
        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.micAccess")}
          </span>
          <div className={styles.groupRowActions}>
            <span className={`${styles.badge} ${badge.className}`}>
              <span className={styles.badgeDot} />
              {badge.label}
            </span>
            {mic.status === "not_determined" && (
              <button
                type="button"
                className={styles.iconButton}
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
                className={styles.iconButton}
                onClick={() => {
                  void openUrl(MIC_PRIVACY_URL).catch(() => {});
                }}
              >
                {t("settings.micOpenSystem")}
              </button>
            )}
          </div>
        </div>
        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.calendarAccess")}
          </span>
          <div className={styles.groupRowActions}>
            <span
              className={`${styles.badge} ${calendar.status === "granted" ? styles.badgeGranted : styles.badgeNeutral}`}
            >
              <span className={styles.badgeDot} />
              {calendar.status === "granted"
                ? t("settings.calendarGranted")
                : t("settings.calendarDenied")}
            </span>
            {calendar.status !== "granted" && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={calendar.request}
                disabled={calendar.requesting}
              >
                {t("settings.calendarRequest")}
              </button>
            )}
          </div>
        </div>

        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.locationAccess")}
          </span>
          <div className={styles.groupRowActions}>
            <span
              className={`${styles.badge} ${location.status === "granted" ? styles.badgeGranted : styles.badgeNeutral}`}
            >
              <span className={styles.badgeDot} />
              {location.status === "granted"
                ? t("settings.locationGranted")
                : t("settings.locationDenied")}
            </span>
            {location.status === "not_determined" && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={location.request}
                disabled={location.requesting}
              >
                {t("settings.locationRequest")}
              </button>
            )}
            {(location.status === "denied" ||
              location.status === "restricted") && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => {
                  void openUrl(LOCATION_PRIVACY_URL).catch(() => {});
                }}
              >
                {t("settings.micOpenSystem")}
              </button>
            )}
          </div>
        </div>

        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.screenAccess")}
          </span>
          <div className={styles.groupRowActions}>
            <span
              className={`${styles.badge} ${screen.status === "granted" ? styles.badgeGranted : styles.badgeNeutral}`}
            >
              <span className={styles.badgeDot} />
              {screen.status === "granted"
                ? t("settings.screenGranted")
                : t("settings.screenDenied")}
            </span>
            {screen.status !== "granted" && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => {
                  // Screen Recording has no in-dialog "Allow" — the user
                  // must flip the toggle in System Settings. But macOS
                  // won't list an app that never invoked a capture API,
                  // so there'd be no toggle to flip. Firing the
                  // ScreenCaptureKit request registers Chappie into the
                  // Screen Recording list (off state) and shows the
                  // one-time prompt; we don't await it (it blocks until
                  // the prompt is dismissed) and open the pane alongside,
                  // where the list updates live.
                  void invoke("request_screen_recording_access").catch(
                    () => {},
                  );
                  void invoke("open_screen_recording_settings").catch((e) =>
                    console.error(
                      "[settings] open_screen_recording_settings",
                      e,
                    ),
                  );
                }}
              >
                {t("settings.micOpenSystem")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Long-term memory (RAG) — opt-in download + privacy-safe wipe.
          Description retained because the 470MB download is a real
          decision the user needs context on; everything else moves
          into the standard group/row idiom. */}
      <div className={styles.group}>
        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>{t("settings.ltmLabel")}</span>
          <div className={styles.groupRowActions}>
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
            {!ltmEnabled ? (
              <button
                type="button"
                className={styles.iconButton}
                onClick={onEnableLtm}
                disabled={ltmPhase.kind !== "idle"}
              >
                {ltmPhase.kind === "downloading"
                  ? t("settings.ltmEnabling")
                  : t("settings.ltmEnable")}
              </button>
            ) : (
              <button
                type="button"
                className={styles.iconButton}
                onClick={onDisableLtm}
                disabled={ltmPhase.kind !== "idle"}
              >
                {t("settings.ltmDisable")}
              </button>
            )}
          </div>
        </div>
        <div className={styles.groupBlock}>
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
          <div className={styles.actions} style={{ marginTop: 8 }}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onForgetLtm}
              disabled={ltmPhase.kind !== "idle"}
            >
              {t("settings.ltmForget")}
            </button>
          </div>
        </div>
      </div>

      {/* Usage analytics — opt-in voice utterance + tool name sharing.
          Default OFF. Free-tier users get +10 daily quota as a thank-
          you; Pro / BYOK get the toggle for altruistic feedback. The
          transparency block lists exactly what gets sent and what
          doesn't; recent events let users preview before / during
          opting in. */}
      <div className={styles.group}>
        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.analyticsLabel")}
          </span>
          <div className={styles.groupRowActions}>
            <span
              className={`${styles.badge} ${
                analyticsConsent ? styles.badgeGranted : styles.badgeNeutral
              }`}
            >
              <span className={styles.badgeDot} />
              {analyticsConsent
                ? t("settings.analyticsStatusOn")
                : t("settings.analyticsStatusOff")}
            </span>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => onToggleAnalyticsConsent(!analyticsConsent)}
              disabled={analyticsBusy}
            >
              {analyticsConsent
                ? t("settings.analyticsTurnOff")
                : t("settings.analyticsTurnOn")}
            </button>
          </div>
        </div>
        <div className={styles.groupBlock}>
          <p className={styles.note}>
            {mode === "free"
              ? t("settings.analyticsDescriptionFree")
              : subscriptionEntitled
                ? t("settings.analyticsDescriptionPro")
                : t("settings.analyticsDescriptionByok")}
          </p>
          <div className={styles.actions} style={{ marginTop: 8, gap: 12 }}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                const next = !analyticsRecentOpen;
                setAnalyticsRecentOpen(next);
                if (next) void onRefreshAnalyticsRecent();
              }}
            >
              {analyticsRecentOpen
                ? t("settings.analyticsRecentHide")
                : t("settings.analyticsRecentShow")}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onDeleteAnalyticsHistory}
              disabled={analyticsBusy}
            >
              {t("settings.analyticsDelete")}
            </button>
          </div>
          {analyticsRecentOpen && (
            <div style={{ marginTop: 12 }}>
              {analyticsRecent.length === 0 ? (
                <p className={styles.note}>
                  {t("settings.analyticsRecentEmpty")}
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    fontSize: 12,
                  }}
                >
                  {analyticsRecent.map((e) => (
                    <li
                      key={e.ts_unix}
                      style={{
                        padding: "6px 0",
                        borderTop: "1px solid var(--border-color, #eee)",
                      }}
                    >
                      <div style={{ opacity: 0.7 }}>
                        {new Date(e.ts_unix * 1000).toLocaleTimeString()} ·{" "}
                        {e.lang} · {e.mode} ·{" "}
                        {e.tool_calls.length === 0
                          ? "(chitchat)"
                          : e.tool_calls.join(", ")}
                      </div>
                      <div>{e.utterance}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Proactive notifications — Chappie speaks up on its own.
          Collapsed by default: this section is 5 toggles + 3 sub-controls
          + quiet hours range, which dominates the Settings window if
          shown flat. The summary line still indicates the feature
          exists; the details open when the user actually wants to
          configure something. */}
      <div className={styles.group}>
        <details className={styles.groupBlock}>
          <summary className={styles.groupRowLabel}>
            {t("settings.proactiveLabel")}
          </summary>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {/* One row per toggle, with its sub-control right-aligned
                so the column of inputs stacks visually. The sub-label
                (時刻 / 何分前 / 話しかけ始める間隔) is dropped — the
                control type makes its purpose obvious and the toggle
                label already says what it's for. */}
            <div className={styles.proactiveRow}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={proactiveMorningBriefEnabled}
                  onChange={(e) =>
                    setProactiveMorningBriefEnabled(e.target.checked)
                  }
                />
                {t("settings.proactiveMorningBriefToggle")}
              </label>
              <input
                type="time"
                value={proactiveMorningBriefTime}
                onChange={(e) => setProactiveMorningBriefTime(e.target.value)}
                disabled={!proactiveMorningBriefEnabled}
              />
            </div>
            <div className={styles.proactiveRow}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={proactiveCalendarEnabled}
                  onChange={(e) =>
                    setProactiveCalendarEnabled(e.target.checked)
                  }
                />
                {t("settings.proactiveCalendarToggle")}
              </label>
              <select
                className={styles.select}
                style={{ width: "auto" }}
                value={String(proactiveCalendarLeadMin)}
                onChange={(e) =>
                  setProactiveCalendarLeadMin(Number(e.target.value))
                }
                disabled={!proactiveCalendarEnabled}
              >
                <option value="5">
                  {t("settings.proactiveCalendarLead5")}
                </option>
                <option value="10">
                  {t("settings.proactiveCalendarLead10")}
                </option>
                <option value="15">
                  {t("settings.proactiveCalendarLead15")}
                </option>
                <option value="30">
                  {t("settings.proactiveCalendarLead30")}
                </option>
              </select>
            </div>
            <div className={styles.proactiveRow}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={proactiveWeatherEnabled}
                  onChange={(e) => setProactiveWeatherEnabled(e.target.checked)}
                />
                {t("settings.proactiveWeatherToggle")}
              </label>
            </div>
            <div className={styles.proactiveRow}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={proactiveIdleChatterEnabled}
                  onChange={(e) =>
                    setProactiveIdleChatterEnabled(e.target.checked)
                  }
                />
                {t("settings.proactiveIdleChatterToggle")}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={proactiveIdleChatterAfterMin}
                  onChange={(e) =>
                    setProactiveIdleChatterAfterMin(Number(e.target.value))
                  }
                  disabled={!proactiveIdleChatterEnabled}
                  style={{ width: 64 }}
                />
                <span>{t("settings.proactiveIdleChatterAfterUnit")}</span>
              </div>
            </div>
            <div className={styles.proactiveRow}>
              <span>{t("settings.proactiveQuietHoursLabel")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="time"
                  value={proactiveQuietHoursStart}
                  onChange={(e) => setProactiveQuietHoursStart(e.target.value)}
                  aria-label="quiet hours start"
                />
                <span>—</span>
                <input
                  type="time"
                  value={proactiveQuietHoursEnd}
                  onChange={(e) => setProactiveQuietHoursEnd(e.target.value)}
                  aria-label="quiet hours end"
                />
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Language + Autostart — two simple single-row settings combined
          into a grouped table. Both are "name + control" with no
          ancillary state, the System Settings idiom fits perfectly. */}
      <div className={styles.group}>
        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.languageLabel")}
          </span>
          <select
            id="language"
            className={`${styles.select} ${styles.groupRowControl}`}
            style={{ width: "auto" }}
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
        <div className={styles.groupRow}>
          <span className={styles.groupRowLabel}>
            {t("settings.autostartCheckbox")}
          </span>
          <input
            type="checkbox"
            className={styles.groupRowControl}
            checked={autostart}
            onChange={(e) => setAutostart(e.target.checked)}
          />
        </div>
      </div>

      {/* VOICEVOX — Japanese only. Hide entirely when the active UI
          language is anything else, since the engine doesn't speak it.
          Uses the same resolution as the conversation loop so "auto"
          falls back to navigator.language. */}
      {resolveLanguage(language).startsWith("ja") && (
        <div className={styles.group}>
          <div className={styles.groupRow}>
            <span className={styles.groupRowLabel}>
              {t("settings.voicevoxLabel")}
            </span>
            <div className={styles.groupRowActions}>
              <span
                className={`${styles.badge} ${
                  voicevoxInstallKind === "managed" ||
                  voicevoxInstallKind === "bundled_app"
                    ? styles.badgeGranted
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
              {voicevoxInstallKind === "missing" && (
                <button
                  type="button"
                  className={styles.iconButton}
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
                  className={styles.iconButton}
                  onClick={handleVoicevoxUninstall}
                  disabled={voicevoxBusy}
                >
                  {t("settings.voicevoxUninstall")}
                </button>
              )}
            </div>
          </div>
          {(voicevoxInstallProgress ||
            voicevoxInstallError ||
            voicevoxStatus === "unreachable") && (
            <div className={styles.groupBlock}>
              {voicevoxInstallProgress && (
                <p className={styles.note} style={{ marginTop: 0 }}>
                  {voicevoxInstallProgress.phase === "download"
                    ? t("settings.voicevoxInstallProgress", {
                        received: (
                          voicevoxInstallProgress.received /
                          1024 /
                          1024
                        ).toFixed(0),
                        total:
                          voicevoxInstallProgress.total > 0
                            ? (
                                voicevoxInstallProgress.total /
                                1024 /
                                1024
                              ).toFixed(0)
                            : "?",
                      })
                    : voicevoxInstallProgress.phase === "extract"
                      ? t("settings.voicevoxExtracting")
                      : t("settings.voicevoxVerifying")}
                </p>
              )}
              {voicevoxInstallError && (
                <p className={styles.note} style={{ marginTop: 0 }}>
                  {voicevoxInstallError}
                </p>
              )}
              {voicevoxStatus === "unreachable" && (
                <p className={styles.note} style={{ marginTop: 0 }}>
                  {t("settings.voicevoxStatusUnreachable")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {version && <div className={styles.footer}>v{version}</div>}
    </main>
  );
}
