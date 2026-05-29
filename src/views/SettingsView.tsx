import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import { usePermissionStatus } from "../hooks/usePermissionStatus";
import { useSettingsForm } from "../hooks/useSettingsForm";
import { useSubscription } from "../hooks/useSubscription";
import { resolveLanguage } from "../i18n/messages";
import { useT } from "../i18n/useT";
import type {
  CalendarStatus,
  LocationStatus,
  MicStatus,
  ScreenStatus,
} from "../lib/permission-status";
import "./SettingsView.global.css";
import styles from "./SettingsView.module.css";
import { AccountPanel } from "./settings/AccountPanel";
import { AnalyticsPanel } from "./settings/AnalyticsPanel";
import { ExternalMicPanel } from "./settings/ExternalMicPanel";
import { LanguageAutostartPanel } from "./settings/LanguageAutostartPanel";
import { LtmPanel } from "./settings/LtmPanel";
import { ModePanel } from "./settings/ModePanel";
import { PermissionsPanel } from "./settings/PermissionsPanel";
import { PersonalizedToolsPanel } from "./settings/PersonalizedToolsPanel";
import { ProactivePanel } from "./settings/ProactivePanel";
import { SpeakerPanel } from "./settings/SpeakerPanel";
import { SwitchbotPanel } from "./settings/SwitchbotPanel";
import { VadPanel } from "./settings/VadPanel";
import { VoicevoxPanel } from "./settings/VoicevoxPanel";

// Composition root for the Settings window. State lives in two hooks
// (useSettingsForm = the auto-saved form, useSubscription = Pro identity)
// plus the four permission hooks below; each visual section is its own
// panel under ./settings/. The container only owns what's shared across
// panels (permissions, version) and the loaded gate.
export function SettingsView() {
  const { t } = useT();
  const form = useSettingsForm();
  const sub = useSubscription();
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: init runs once
  useEffect(() => {
    void mic.refresh();
    void screen.refresh();
    void calendar.refresh();
    void location.refresh();
    getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  if (!form.loaded) {
    return <main className={styles.loading}>{t("common.loading")}</main>;
  }

  return (
    <main className={styles.root}>
      <ModePanel
        mode={form.mode}
        setMode={form.setMode}
        entitled={sub.entitled}
      />
      <AccountPanel
        mode={form.mode}
        apiKey={form.apiKey}
        setApiKey={form.setApiKey}
        sub={sub}
      />
      <SpeakerPanel
        speakerThreshold={form.speakerThreshold}
        setSpeakerThreshold={form.setSpeakerThreshold}
      />
      <VadPanel
        vadThreshold={form.vadThreshold}
        setVadThreshold={form.setVadThreshold}
        vadSilenceFrames={form.vadSilenceFrames}
        setVadSilenceFrames={form.setVadSilenceFrames}
      />
      <PermissionsPanel
        mic={mic}
        screen={screen}
        calendar={calendar}
        location={location}
      />
      <LtmPanel />
      <AnalyticsPanel
        mode={form.mode}
        entitled={sub.entitled}
        analyticsConsent={form.analyticsConsent}
        setAnalyticsConsent={form.setAnalyticsConsent}
      />
      <PersonalizedToolsPanel
        enabled={form.personalizedToolsEnabled}
        setEnabled={form.setPersonalizedToolsEnabled}
      />
      <ExternalMicPanel
        value={form.externalMicOutputMode}
        setValue={form.setExternalMicOutputMode}
      />
      <SwitchbotPanel
        token={form.switchbotToken}
        setToken={form.setSwitchbotToken}
        secret={form.switchbotSecret}
        setSecret={form.setSwitchbotSecret}
      />
      <ProactivePanel
        micStatus={mic.status}
        outputChannel={form.proactiveOutputChannel}
        setOutputChannel={form.setProactiveOutputChannel}
        morningBriefEnabled={form.proactiveMorningBriefEnabled}
        setMorningBriefEnabled={form.setProactiveMorningBriefEnabled}
        morningBriefTime={form.proactiveMorningBriefTime}
        setMorningBriefTime={form.setProactiveMorningBriefTime}
        calendarEnabled={form.proactiveCalendarEnabled}
        setCalendarEnabled={form.setProactiveCalendarEnabled}
        calendarLeadMin={form.proactiveCalendarLeadMin}
        setCalendarLeadMin={form.setProactiveCalendarLeadMin}
        weatherEnabled={form.proactiveWeatherEnabled}
        setWeatherEnabled={form.setProactiveWeatherEnabled}
        idleChatterEnabled={form.proactiveIdleChatterEnabled}
        setIdleChatterEnabled={form.setProactiveIdleChatterEnabled}
        idleChatterAfterMin={form.proactiveIdleChatterAfterMin}
        setIdleChatterAfterMin={form.setProactiveIdleChatterAfterMin}
        quietHoursStart={form.proactiveQuietHoursStart}
        setQuietHoursStart={form.setProactiveQuietHoursStart}
        quietHoursEnd={form.proactiveQuietHoursEnd}
        setQuietHoursEnd={form.setProactiveQuietHoursEnd}
      />
      <LanguageAutostartPanel
        language={form.language}
        setLanguage={form.setLanguage}
        autostart={form.autostart}
        setAutostart={form.setAutostart}
      />
      {resolveLanguage(form.language).startsWith("ja") && <VoicevoxPanel />}

      {version && <div className={styles.footer}>v{version}</div>}
    </main>
  );
}
