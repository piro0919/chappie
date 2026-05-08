import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import "./HudView.global.css";
import styles from "./HudView.module.css";

type HudPayload = { text: string; durationMs: number };

// The renderer separates the main reply from the trailing hint (if any) by
// a blank line. This keeps Rust-side hud::show simple — anything after
// "\n\n" in the payload is shown as a smaller, dimmer suffix.
function splitBody(text: string): { main: string; suffix: string | null } {
  const idx = text.indexOf("\n\n");
  if (idx === -1) return { main: text, suffix: null };
  return { main: text.slice(0, idx), suffix: text.slice(idx + 2) };
}

// Pick a Chappie portrait that matches the message tone. Mute-related and
// negative messages get the calmer "listening" pose; everything else gets
// "talking" since the HUD typically accompanies a reply.
function pickAvatar(text: string): string {
  if (
    text.includes("ミュート") ||
    text.includes("🔇") ||
    text.includes("👂") ||
    text.includes("失敗") ||
    text.includes("エラー")
  ) {
    return "/listening.png";
  }
  return "/talking.png";
}

export function HudView() {
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;
    let dismissTimer: number | undefined;

    const unlistenPromise = listen<HudPayload>("hud:show", (e) => {
      console.info(
        `[hud] event received chars=${e.payload.text.length} dur=${e.payload.durationMs}`,
      );
      window.clearTimeout(hideTimer);
      window.clearTimeout(dismissTimer);
      setText(e.payload.text);
      requestAnimationFrame(() => setVisible(true));

      hideTimer = window.setTimeout(() => {
        setVisible(false);
        dismissTimer = window.setTimeout(() => {
          setText(null);
          void invoke("hud_dismiss");
        }, 220);
      }, e.payload.durationMs);
    });

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(dismissTimer);
      void unlistenPromise.then((u) => u());
    };
  }, []);

  if (!text) return <div className={styles.root} />;

  const { main, suffix } = splitBody(text);
  const avatar = pickAvatar(text);

  return (
    <div className={styles.root}>
      <div className={`${styles.card} ${visible ? styles.visible : ""}`}>
        <img className={styles.avatar} src={avatar} alt="" aria-hidden />
        <div className={styles.body}>
          <span>{main}</span>
          {suffix && <span className={styles.suffix}>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}
