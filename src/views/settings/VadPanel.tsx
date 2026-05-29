import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useT } from "../../i18n/useT";
import styles from "../SettingsView.module.css";

// VAD tuning — deep audio-pipeline knobs for users whose room or voice
// doesn't match Silero V5 defaults. Hidden behind a disclosure so
// first-time users aren't intimidated. The two values are persisted by
// the settings form (auto-save payload), so they come in as props; the
// allowed ranges are queried from Rust here.
export function VadPanel({
  vadThreshold,
  setVadThreshold,
  vadSilenceFrames,
  setVadSilenceFrames,
}: {
  vadThreshold: number;
  setVadThreshold: (v: number) => void;
  vadSilenceFrames: number;
  setVadSilenceFrames: (v: number) => void;
}) {
  const { t } = useT();
  const [range, setRange] = useState<{
    threshold: { min: number; max: number; default: number };
    silenceFrames: { min: number; max: number; default: number };
    frameMs: number;
  }>({
    threshold: { min: 0.15, max: 0.5, default: 0.25 },
    silenceFrames: { min: 12, max: 38, default: 22 },
    frameMs: 32,
  });

  useEffect(() => {
    void (async () => {
      try {
        const r = await invoke<typeof range>("vad_config_range");
        setRange(r);
      } catch {}
    })();
  }, []);

  return (
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
            min={range.threshold.min}
            max={range.threshold.max}
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
                ms: String(vadSilenceFrames * range.frameMs),
              })}
            </span>
          </div>
          <input
            type="range"
            min={range.silenceFrames.min}
            max={range.silenceFrames.max}
            step={1}
            value={vadSilenceFrames}
            onChange={(e) => setVadSilenceFrames(parseInt(e.target.value, 10))}
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
              setVadThreshold(range.threshold.default);
              setVadSilenceFrames(range.silenceFrames.default);
            }}
          >
            {t("settings.vadReset")}
          </button>
        </div>
      </details>
    </div>
  );
}
