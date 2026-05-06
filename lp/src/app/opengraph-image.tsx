import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Chappie — ハンズフリーの音声 AI アシスタント";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  const iconBuffer = readFileSync(join(process.cwd(), "public/icon-512.png"));
  const iconSrc = `data:image/png;base64,${iconBuffer.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #fffaf3 0%, #fbdcdc 100%)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        gap: 28,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse cannot use next/image */}
      <img
        alt="Chappie"
        src={iconSrc}
        width={200}
        height={200}
        style={{
          borderRadius: 44,
          boxShadow: "0 16px 40px -12px rgba(106, 70, 40, 0.35)",
        }}
      />
      <div
        style={{
          display: "flex",
          fontSize: 80,
          fontWeight: 800,
          color: "#4a3826",
          letterSpacing: "-2px",
        }}
      >
        Chappie
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          fontSize: 32,
          color: "#6b4f37",
          maxWidth: 880,
          textAlign: "center",
          lineHeight: 1.4,
          padding: "0 60px",
        }}
      >
        <div style={{ display: "flex" }}>「チャッピー」と呼びかけるだけ。</div>
        <div style={{ display: "flex" }}>
          macOS のメニューバーに常駐する、ハンズフリー音声 AI アシスタント。
        </div>
      </div>
    </div>,
    { ...size },
  );
}
