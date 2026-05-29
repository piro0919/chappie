import { useT } from "../../i18n/useT";
import type { MicStatus } from "../../lib/permission-status";
import type { Settings } from "../../lib/settings";
import styles from "../SettingsView.module.css";

// Proactive notifications — Chappie speaks up on its own. Collapsed by
// default: 5 toggles + 3 sub-controls + quiet hours range would dominate
// the window if shown flat. All values are persisted by the settings
// form, so they arrive as props + setters; micStatus gates idle chatter
// (which needs the mic granted to detect idleness).
export interface ProactivePanelProps {
  micStatus: MicStatus;
  outputChannel: Settings["proactiveOutputChannel"];
  setOutputChannel: (v: Settings["proactiveOutputChannel"]) => void;
  morningBriefEnabled: boolean;
  setMorningBriefEnabled: (v: boolean) => void;
  morningBriefTime: string;
  setMorningBriefTime: (v: string) => void;
  calendarEnabled: boolean;
  setCalendarEnabled: (v: boolean) => void;
  calendarLeadMin: number;
  setCalendarLeadMin: (v: number) => void;
  weatherEnabled: boolean;
  setWeatherEnabled: (v: boolean) => void;
  idleChatterEnabled: boolean;
  setIdleChatterEnabled: (v: boolean) => void;
  idleChatterAfterMin: number;
  setIdleChatterAfterMin: (v: number) => void;
  quietHoursStart: string;
  setQuietHoursStart: (v: string) => void;
  quietHoursEnd: string;
  setQuietHoursEnd: (v: string) => void;
}

export function ProactivePanel(props: ProactivePanelProps) {
  const { t } = useT();
  const {
    micStatus,
    outputChannel,
    setOutputChannel,
    morningBriefEnabled,
    setMorningBriefEnabled,
    morningBriefTime,
    setMorningBriefTime,
    calendarEnabled,
    setCalendarEnabled,
    calendarLeadMin,
    setCalendarLeadMin,
    weatherEnabled,
    setWeatherEnabled,
    idleChatterEnabled,
    setIdleChatterEnabled,
    idleChatterAfterMin,
    setIdleChatterAfterMin,
    quietHoursStart,
    setQuietHoursStart,
    quietHoursEnd,
    setQuietHoursEnd,
  } = props;

  return (
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
          {/* One row per toggle, with its sub-control right-aligned so the
              column of inputs stacks visually. */}
          <div className={styles.proactiveRow}>
            <span>{t("settings.proactiveOutputChannelLabel")}</span>
            <select
              className={styles.select}
              style={{ width: "auto" }}
              value={outputChannel}
              onChange={(e) =>
                setOutputChannel(
                  e.target.value as Settings["proactiveOutputChannel"],
                )
              }
            >
              <option value="auto">
                {t("settings.proactiveOutputChannelAuto")}
              </option>
              <option value="voice">
                {t("settings.proactiveOutputChannelVoice")}
              </option>
              <option value="hud">
                {t("settings.proactiveOutputChannelHud")}
              </option>
            </select>
          </div>
          <div className={styles.proactiveRow}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={morningBriefEnabled}
                onChange={(e) => setMorningBriefEnabled(e.target.checked)}
              />
              {t("settings.proactiveMorningBriefToggle")}
            </label>
            <input
              type="time"
              value={morningBriefTime}
              onChange={(e) => setMorningBriefTime(e.target.value)}
              disabled={!morningBriefEnabled}
            />
          </div>
          <div className={styles.proactiveRow}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={calendarEnabled}
                onChange={(e) => setCalendarEnabled(e.target.checked)}
              />
              {t("settings.proactiveCalendarToggle")}
            </label>
            <select
              className={styles.select}
              style={{ width: "auto" }}
              value={String(calendarLeadMin)}
              onChange={(e) => setCalendarLeadMin(Number(e.target.value))}
              disabled={!calendarEnabled}
            >
              <option value="5">{t("settings.proactiveCalendarLead5")}</option>
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
                checked={weatherEnabled}
                onChange={(e) => setWeatherEnabled(e.target.checked)}
              />
              {t("settings.proactiveWeatherToggle")}
            </label>
          </div>
          <div className={styles.proactiveRow}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={idleChatterEnabled && micStatus === "granted"}
                disabled={micStatus !== "granted"}
                onChange={(e) => setIdleChatterEnabled(e.target.checked)}
              />
              {t("settings.proactiveIdleChatterToggle")}
              {micStatus !== "granted" && (
                <span style={{ color: "#6e6e73", fontSize: 11 }}>
                  {t("settings.proactiveIdleChatterMicHint")}
                </span>
              )}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={idleChatterAfterMin}
                onChange={(e) => setIdleChatterAfterMin(Number(e.target.value))}
                disabled={!idleChatterEnabled}
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
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
                aria-label="quiet hours start"
              />
              <span>—</span>
              <input
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
                aria-label="quiet hours end"
              />
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
