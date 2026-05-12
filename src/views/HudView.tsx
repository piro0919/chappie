import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import styles from "./HudView.module.css";

// HUD-only global resets. Applied imperatively (instead of via a global CSS
// file) so they don't leak into the settings/conversation windows that share
// the same bundle. Without this scoping, "overflow: hidden" on body would
// kill scrolling in Settings.
function applyHudGlobals() {
  const html = document.documentElement;
  const body = document.body;
  for (const el of [html, body]) {
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.background = "transparent";
    el.style.overflow = "hidden";
    el.style.height = "100vh";
  }
  body.style.userSelect = "none";
  body.style.webkitUserSelect = "none";
  body.style.cursor = "default";
}

type TrayCharacter =
  | "chappie"
  | "zundamon"
  | "metan"
  | "tsumugi"
  | "himari"
  | "sayo"
  | "usagi"
  | "zunko"
  | "kiritan"
  | "itako";

type HudPayload = {
  text: string;
  durationMs: number;
  character?: TrayCharacter;
};

// The renderer separates the main reply from the trailing hint (if any) by
// a blank line. This keeps Rust-side hud::show simple — anything after
// "\n\n" in the payload is shown as a smaller, dimmer suffix.
function splitBody(text: string): { main: string; suffix: string | null } {
  const idx = text.indexOf("\n\n");
  if (idx === -1) return { main: text, suffix: null };
  return { main: text.slice(0, idx), suffix: text.slice(idx + 2) };
}

// Pick a portrait that (a) matches the message tone and (b) matches the
// active tray character — so when the user is talking to a VOICEVOX
// character, the HUD shows that character instead of Chappie. The
// per-character art lives under /characters/<name>-(talking|listening).png
// (sourced from the tray icon pack). Chappie keeps the dedicated 1024px
// portraits at /talking.png and /listening.png.
function pickAvatar(text: string, character: TrayCharacter): string {
  const listeningPose =
    text.includes("ミュート") ||
    text.includes("🔇") ||
    text.includes("👂") ||
    text.includes("失敗") ||
    text.includes("エラー");
  if (character === "chappie") {
    return listeningPose ? "/listening.png" : "/talking.png";
  }
  return listeningPose
    ? `/characters/${character}-listening.png`
    : `/characters/${character}-talking.png`;
}

export function HudView() {
  const [text, setText] = useState<string | null>(null);
  const [character, setCharacter] = useState<TrayCharacter>("chappie");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    applyHudGlobals();
  }, []);

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
      setCharacter(e.payload.character ?? "chappie");
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
  const avatar = pickAvatar(text, character);

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
