import { useT } from "../../i18n/useT";
import styles from "../SettingsView.module.css";

// Personalized tool routing — advanced. Collapsed because it's an
// internal optimization most users never need to touch; default ON and
// degrades safely. The toggle is here as an escape hatch if routing ever
// misbehaves.
export function PersonalizedToolsPanel({
  enabled,
  setEnabled,
}: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}) {
  const { t } = useT();
  return (
    <div className={styles.group}>
      <details className={styles.groupBlock}>
        <summary className={styles.groupRowLabel}>
          {t("settings.personalizedToolsLabel")}
        </summary>
        <div style={{ marginTop: 8 }}>
          <div className={styles.groupRow}>
            <span className={styles.groupRowLabel}>
              {t("settings.personalizedToolsToggle")}
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </div>
          <p className={styles.note} style={{ marginTop: 8 }}>
            {t("settings.personalizedToolsDescription")}
          </p>
        </div>
      </details>
    </div>
  );
}
