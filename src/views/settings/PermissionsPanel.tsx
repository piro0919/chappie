import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { UsePermissionStatusResult } from "../../hooks/usePermissionStatus";
import { useT } from "../../i18n/useT";
import type {
  CalendarStatus,
  LocationStatus,
  MicStatus,
  ScreenStatus,
} from "../../lib/permission-status";
import styles from "../SettingsView.module.css";

const MIC_PRIVACY_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
const LOCATION_PRIVACY_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices";

// All 4 macOS permissions in one group with thin separators. Mic is
// required; the other three are optional. Each row is label + status
// badge + (when not granted) one contextual button. usePermissionStatus
// auto-refreshes on window focus so there's no manual "Recheck" button.
export function PermissionsPanel({
  mic,
  screen,
  calendar,
  location,
}: {
  mic: UsePermissionStatusResult<MicStatus>;
  screen: UsePermissionStatusResult<ScreenStatus>;
  calendar: UsePermissionStatusResult<CalendarStatus>;
  location: UsePermissionStatusResult<LocationStatus>;
}) {
  const { t } = useT();

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

  const badge = micStatusBadge(mic.status);

  return (
    <div className={styles.group}>
      <div className={styles.groupRow}>
        <span className={styles.groupRowLabel}>{t("settings.micAccess")}</span>
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
                void invoke("request_screen_recording_access").catch(() => {});
                void invoke("open_screen_recording_settings").catch((e) =>
                  console.error("[settings] open_screen_recording_settings", e),
                );
              }}
            >
              {t("settings.micOpenSystem")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
