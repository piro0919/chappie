import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as isAutostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { useEffect, useState } from "react";
import { IpcEvent } from "../lib/ipc-events";
import {
  hasPersistedAutostart,
  type Language,
  loadSettings,
  type Mode,
  type Settings,
  saveSettings,
} from "../lib/settings";

// Owns the subset of Settings that the Settings window persists via the
// debounced auto-save (everything in the saveSettings() payload below).
// Extracted from SettingsView so the view + its panels stay presentational:
// the hook does the one-time hydration, the autostart reconcile, and the
// 300ms-debounced write-back; panels just read a value and call its setter.
//
// State NOT owned here (subscription, permissions, voicevox/speaker/ltm
// status, analytics history) is transient — it's either network/OS-derived
// or self-managed by its own panel, and never part of the auto-save payload.

export interface SettingsForm {
  loaded: boolean;

  mode: Mode;
  setMode: (v: Mode) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  language: Language;
  setLanguage: (v: Language) => void;
  autostart: boolean;
  setAutostart: (v: boolean) => void;

  proactiveMorningBriefEnabled: boolean;
  setProactiveMorningBriefEnabled: (v: boolean) => void;
  proactiveMorningBriefTime: string;
  setProactiveMorningBriefTime: (v: string) => void;
  proactiveCalendarEnabled: boolean;
  setProactiveCalendarEnabled: (v: boolean) => void;
  proactiveCalendarLeadMin: number;
  setProactiveCalendarLeadMin: (v: number) => void;
  proactiveWeatherEnabled: boolean;
  setProactiveWeatherEnabled: (v: boolean) => void;
  proactiveIdleChatterEnabled: boolean;
  setProactiveIdleChatterEnabled: (v: boolean) => void;
  proactiveIdleChatterAfterMin: number;
  setProactiveIdleChatterAfterMin: (v: number) => void;
  proactiveQuietHoursStart: string;
  setProactiveQuietHoursStart: (v: string) => void;
  proactiveQuietHoursEnd: string;
  setProactiveQuietHoursEnd: (v: string) => void;
  proactiveOutputChannel: Settings["proactiveOutputChannel"];
  setProactiveOutputChannel: (v: Settings["proactiveOutputChannel"]) => void;

  speakerThreshold: number;
  setSpeakerThreshold: (v: number) => void;
  vadThreshold: number;
  setVadThreshold: (v: number) => void;
  vadSilenceFrames: number;
  setVadSilenceFrames: (v: number) => void;

  analyticsConsent: boolean;
  setAnalyticsConsent: (v: boolean) => void;
  personalizedToolsEnabled: boolean;
  setPersonalizedToolsEnabled: (v: boolean) => void;
  externalMicOutputMode: Settings["externalMicOutputMode"];
  setExternalMicOutputMode: (v: Settings["externalMicOutputMode"]) => void;
  switchbotToken: string;
  setSwitchbotToken: (v: string) => void;
  switchbotSecret: string;
  setSwitchbotSecret: (v: string) => void;
}

export function useSettingsForm(): SettingsForm {
  const [loaded, setLoaded] = useState(false);
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
  const [proactiveOutputChannel, setProactiveOutputChannel] =
    useState<Settings["proactiveOutputChannel"]>("auto");
  const [speakerThreshold, setSpeakerThreshold] = useState(0.4);
  const [vadThreshold, setVadThreshold] = useState(0.25);
  const [vadSilenceFrames, setVadSilenceFrames] = useState(22);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [personalizedToolsEnabled, setPersonalizedToolsEnabled] =
    useState(true);
  const [externalMicOutputMode, setExternalMicOutputMode] =
    useState<Settings["externalMicOutputMode"]>("voice");
  const [switchbotToken, setSwitchbotToken] = useState("");
  const [switchbotSecret, setSwitchbotSecret] = useState("");

  useEffect(() => {
    void (async () => {
      const s: Settings = await loadSettings();
      setMode(s.mode);
      setApiKey(s.openaiApiKey);
      setLanguage(s.language);
      setProactiveMorningBriefEnabled(s.proactiveMorningBriefEnabled);
      setProactiveMorningBriefTime(s.proactiveMorningBriefTime);
      setProactiveCalendarEnabled(s.proactiveCalendarEnabled);
      setProactiveCalendarLeadMin(s.proactiveCalendarLeadMin);
      setProactiveWeatherEnabled(s.proactiveWeatherEnabled);
      setProactiveIdleChatterEnabled(s.proactiveIdleChatterEnabled);
      setProactiveIdleChatterAfterMin(s.proactiveIdleChatterAfterMin);
      setProactiveQuietHoursStart(s.proactiveQuietHoursStart);
      setProactiveQuietHoursEnd(s.proactiveQuietHoursEnd);
      setProactiveOutputChannel(s.proactiveOutputChannel);
      setSpeakerThreshold(s.speakerThreshold);
      setVadThreshold(s.vadThreshold);
      setVadSilenceFrames(s.vadSilenceFrames);
      setAnalyticsConsent(s.analyticsConsent);
      setPersonalizedToolsEnabled(s.personalizedToolsEnabled);
      setExternalMicOutputMode(s.externalMicOutputMode);
      setSwitchbotToken(s.switchbotToken);
      setSwitchbotSecret(s.switchbotSecret);
      // Mirror the stored consent flag into the Rust process so the
      // dispatch hot path doesn't run with a stale default-false until
      // the first toggle. Cached-only invoke, no network round-trip.
      try {
        await invoke("analytics_set_consent_cached", {
          consent: s.analyticsConsent,
        });
      } catch {}
      try {
        await invoke("set_personalized_routing_cached", {
          enabled: s.personalizedToolsEnabled,
        });
      } catch {}
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
      setLoaded(true);
    })();
  }, []);

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
            proactiveOutputChannel,
            speakerThreshold,
            vadThreshold,
            vadSilenceFrames,
            analyticsConsent,
            personalizedToolsEnabled,
            externalMicOutputMode,
            switchbotToken,
            switchbotSecret,
          });
          await invoke("set_speaker_threshold", { value: speakerThreshold });
          await invoke("set_vad_threshold", { value: vadThreshold });
          await invoke("set_vad_silence_frames", { frames: vadSilenceFrames });
          if (autostart) await enableAutostart();
          else await disableAutostart();
          await emit(IpcEvent.settingsUpdated);
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
    proactiveOutputChannel,
    speakerThreshold,
    vadThreshold,
    vadSilenceFrames,
    analyticsConsent,
    personalizedToolsEnabled,
    externalMicOutputMode,
    switchbotToken,
    switchbotSecret,
  ]);

  return {
    loaded,
    mode,
    setMode,
    apiKey,
    setApiKey,
    language,
    setLanguage,
    autostart,
    setAutostart,
    proactiveMorningBriefEnabled,
    setProactiveMorningBriefEnabled,
    proactiveMorningBriefTime,
    setProactiveMorningBriefTime,
    proactiveCalendarEnabled,
    setProactiveCalendarEnabled,
    proactiveCalendarLeadMin,
    setProactiveCalendarLeadMin,
    proactiveWeatherEnabled,
    setProactiveWeatherEnabled,
    proactiveIdleChatterEnabled,
    setProactiveIdleChatterEnabled,
    proactiveIdleChatterAfterMin,
    setProactiveIdleChatterAfterMin,
    proactiveQuietHoursStart,
    setProactiveQuietHoursStart,
    proactiveQuietHoursEnd,
    setProactiveQuietHoursEnd,
    proactiveOutputChannel,
    setProactiveOutputChannel,
    speakerThreshold,
    setSpeakerThreshold,
    vadThreshold,
    setVadThreshold,
    vadSilenceFrames,
    setVadSilenceFrames,
    analyticsConsent,
    setAnalyticsConsent,
    personalizedToolsEnabled,
    setPersonalizedToolsEnabled,
    externalMicOutputMode,
    setExternalMicOutputMode,
    switchbotToken,
    setSwitchbotToken,
    switchbotSecret,
    setSwitchbotSecret,
  };
}
