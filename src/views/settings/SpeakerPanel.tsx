import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useT } from "../../i18n/useT";
import { IpcEvent } from "../../lib/ipc-events";
import styles from "../SettingsView.module.css";

// Speaker recognition — paired with the microphone: "can Chappie hear?"
// → "whose voice is it?". Owns the enrollment flow (download model →
// record ~9s → enroll), the live RMS meter, enrolled status, and the
// strictness threshold slider. The threshold value itself is persisted
// by the settings form (it's in the auto-save payload), so it comes in
// as a prop + setter; everything else is local to this panel.

// "idle" = nothing happening, "downloading" = pulling the ONNX model on
// first use, "recording" = capturing voice, "enrolling" = sending
// samples to Rust + waiting for save.
type SpeakerPhase =
  | { kind: "idle" }
  | { kind: "downloading"; pct: number }
  | { kind: "recording"; remaining: number; phraseIndex: number }
  | { kind: "enrolling" };

const ENROLL_PHRASE_SECONDS = 3;
const ENROLL_PHRASE_COUNT = 3;
const ENROLL_SECONDS = ENROLL_PHRASE_SECONDS * ENROLL_PHRASE_COUNT;

export function SpeakerPanel({
  speakerThreshold,
  setSpeakerThreshold,
}: {
  speakerThreshold: number;
  setSpeakerThreshold: (v: number) => void;
}) {
  const { t } = useT();
  const [enrolled, setEnrolled] = useState(false);
  const [phase, setPhase] = useState<SpeakerPhase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [range, setRange] = useState<{
    min: number;
    max: number;
    default: number;
  }>({ min: 0.3, max: 0.55, default: 0.4 });

  useEffect(() => {
    void (async () => {
      try {
        const [min, max, def] = await invoke<[number, number, number]>(
          "speaker_threshold_range",
        );
        setRange({ min, max, default: def });
      } catch {}
      try {
        setEnrolled(await invoke<boolean>("speaker_is_enrolled"));
      } catch {}
    })();
    // Speaker model download progress — fires while ensure_speaker_model
    // pulls the ECAPA ONNX from Hugging Face on first enrollment.
    let unlistenSpeaker: (() => void) | undefined;
    void listen<{ received: number; total: number }>(
      IpcEvent.speakerModelProgress,
      (e) => {
        const { received, total } = e.payload;
        const pct = total > 0 ? Math.round((received / total) * 100) : 0;
        setPhase({ kind: "downloading", pct });
      },
    ).then((u) => {
      unlistenSpeaker = u;
    });
    // Live amplitude during enrollment recording — Rust emits coarse RMS
    // every chunk so we can render a meter and reassure the user the mic
    // is actually hearing them.
    let unlistenLevel: (() => void) | undefined;
    void listen<number>(IpcEvent.speakerEnrollLevel, (e) => {
      setLevel(e.payload);
    }).then((u) => {
      unlistenLevel = u;
    });
    return () => {
      unlistenSpeaker?.();
      unlistenLevel?.();
    };
  }, []);

  async function onEnrollVoice() {
    setError(null);
    try {
      // Pull the ONNX model down if needed. ensure_speaker_model is a
      // no-op when the file is already in ~/.chappie/models/, so the
      // happy path on re-enrollment skips this step.
      setPhase({ kind: "downloading", pct: 0 });
      await invoke("ensure_speaker_model");
      // Hand the mic to enrollment mode: audio.rs accumulates post-APM
      // samples into its buffer and skips the wake-word path while
      // recording is active.
      await invoke("start_enrollment_recording");
      setLevel(0);
      for (let s = ENROLL_SECONDS; s > 0; s--) {
        const elapsed = ENROLL_SECONDS - s;
        const phraseIndex = Math.min(
          Math.floor(elapsed / ENROLL_PHRASE_SECONDS),
          ENROLL_PHRASE_COUNT - 1,
        );
        setPhase({ kind: "recording", remaining: s, phraseIndex });
        await new Promise((r) => setTimeout(r, 1000));
      }
      setLevel(0);
      setPhase({ kind: "enrolling" });
      const samples = await invoke<number[]>("finish_enrollment_recording");
      await invoke("speaker_enroll", { samples });
      setEnrolled(true);
      setPhase({ kind: "idle" });
    } catch (e) {
      setError(String(e));
      setPhase({ kind: "idle" });
      // Best-effort: make sure we don't leave the audio pipeline stuck
      // in enrollment mode if we threw before finish_enrollment_recording.
      void invoke("finish_enrollment_recording").catch(() => {});
    }
  }

  async function onClearVoice() {
    setError(null);
    try {
      await invoke("speaker_clear_enrollment");
      setEnrolled(false);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className={styles.group}>
      <div className={styles.groupRow}>
        <span className={styles.groupRowLabel}>
          {t("settings.speakerLabel")}
        </span>
        <div className={styles.groupRowActions}>
          <span
            className={`${styles.badge} ${
              enrolled ? styles.badgeGranted : styles.badgeNeutral
            }`}
          >
            <span className={styles.badgeDot} />
            {enrolled
              ? t("settings.speakerStatusEnrolled")
              : t("settings.speakerStatusNotEnrolled")}
          </span>
          <button
            type="button"
            className={styles.iconButton}
            disabled={phase.kind !== "idle"}
            onClick={() => {
              void onEnrollVoice();
            }}
          >
            {enrolled
              ? t("settings.speakerReenroll")
              : t("settings.speakerEnroll")}
          </button>
          {enrolled && (
            <button
              type="button"
              className={styles.iconButton}
              disabled={phase.kind !== "idle"}
              onClick={() => {
                void onClearVoice();
              }}
            >
              {t("settings.speakerClear")}
            </button>
          )}
        </div>
      </div>
      {(phase.kind !== "idle" || error) && (
        <div className={styles.groupBlock}>
          {phase.kind === "downloading" && (
            <p className={styles.note} style={{ marginTop: 0 }}>
              {t("settings.speakerModelDownloading", {
                pct: String(phase.pct),
              })}
            </p>
          )}
          {phase.kind === "enrolling" && (
            <p className={styles.note} style={{ marginTop: 0 }}>
              {t("settings.speakerEnrolling")}
            </p>
          )}
          {error && (
            <p className={styles.note} style={{ marginTop: 0 }}>
              {t("settings.speakerFailed", { err: error })}
            </p>
          )}
          {phase.kind === "recording" &&
            (() => {
              const idx = phase.phraseIndex;
              const phraseKey = (
                ["speakerPhrase1", "speakerPhrase2", "speakerPhrase3"] as const
              )[idx];
              const meterPct = Math.min(100, Math.round(level * 600));
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
                        seconds: String(phase.remaining),
                      })}
                    </span>
                  </div>
                </div>
              );
            })()}
        </div>
      )}
      {enrolled && (
        <div className={styles.groupBlock}>
          <div className={styles.thresholdLabel}>
            <span>{t("settings.speakerStrictnessLabel")}</span>
            <span className={styles.thresholdValue}>
              {speakerThreshold.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={range.min}
            max={range.max}
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
  );
}
