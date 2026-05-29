import { useT } from "../../i18n/useT";
import type { Language } from "../../lib/settings";
import styles from "../SettingsView.module.css";

// Language + Autostart — two simple single-row settings combined into a
// grouped table. Both are "name + control" with no ancillary state, so
// the System Settings idiom fits perfectly.
export function LanguageAutostartPanel({
  language,
  setLanguage,
  autostart,
  setAutostart,
}: {
  language: Language;
  setLanguage: (v: Language) => void;
  autostart: boolean;
  setAutostart: (v: boolean) => void;
}) {
  const { t } = useT();
  return (
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
  );
}
