import { useT } from "../../i18n/useT";
import type { Settings } from "../../lib/settings";
import styles from "../SettingsView.module.css";

// Mic etiquette: what to do while another app holds the mic (calls,
// recordings). Defaults to "voice" (off) — opt-in, since an app that
// keeps the mic open while idle would otherwise keep Chappie quiet.
export function ExternalMicPanel({
  value,
  setValue,
}: {
  value: Settings["externalMicOutputMode"];
  setValue: (v: Settings["externalMicOutputMode"]) => void;
}) {
  const { t } = useT();
  return (
    <div className={styles.group}>
      <div className={styles.groupRow}>
        <span className={styles.groupRowLabel}>
          {t("settings.externalMicModeLabel")}
        </span>
        <select
          className={`${styles.select} ${styles.groupRowControl}`}
          style={{ width: "auto" }}
          value={value}
          onChange={(e) =>
            setValue(e.target.value as Settings["externalMicOutputMode"])
          }
        >
          <option value="voice">{t("settings.externalMicModeVoice")}</option>
          <option value="hud">{t("settings.externalMicModeHud")}</option>
          <option value="silent">{t("settings.externalMicModeSilent")}</option>
        </select>
      </div>
      <div className={styles.groupBlock}>
        <p className={styles.note} style={{ margin: 0 }}>
          {t("settings.externalMicModeDescription")}
        </p>
      </div>
    </div>
  );
}
