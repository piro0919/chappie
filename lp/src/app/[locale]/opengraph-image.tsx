import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { routing } from "../../i18n/routing";

export const alt = "Chappie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function dataUrl(relPath: string): string {
  const buf = readFileSync(join(process.cwd(), "public", relPath));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer> {
  // Google Fonts CSS API serves woff2 only when the User-Agent looks like a
  // modern browser. We pass `text` so the API returns a subsetted file
  // covering exactly the glyphs we need (keeps the OG payload small).
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(
    / /g,
    "+",
  )}:wght@${weight}&text=${encodeURIComponent(text)}`;
  // Omit User-Agent: Google Fonts then serves TTF, which Satori can parse.
  // Any UA — even old Firefox — comes back as woff/woff2 which Satori cannot.
  const css = await fetch(cssUrl).then((r) => r.text());
  const match = css.match(
    /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
  );
  if (!match) throw new Error(`font ${family}:${weight} not resolvable`);
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const heroSrc = dataUrl("hero.png");
  const patternSrc = dataUrl("pattern.png");

  const tagline = t("ogTagline");
  const lead = t("ogLead");
  const titleText = "Chappie";
  // Subset the font to exactly the glyphs we render so the OG payload stays small.
  const fontText = `${titleText}${tagline}${lead}`;
  const [bold, semibold, medium] = await Promise.all([
    loadGoogleFont("Zen Maru Gothic", 900, fontText),
    loadGoogleFont("Zen Maru Gothic", 700, fontText),
    loadGoogleFont("Zen Maru Gothic", 500, fontText),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "linear-gradient(135deg, #fffaf3 0%, #fbdcdc 100%)",
        fontFamily: '"Zen Maru Gothic"',
      }}
    >
      {/* Pattern background — tiled via absolute-positioned <img> since
          Satori doesn't honour backgroundImage data URLs nor flex-wrap
          reliably for tiling */}
      {(() => {
        const TILE = 260;
        const COLS = Math.ceil(1200 / TILE);
        const ROWS = Math.ceil(630 / TILE);
        const tiles: { key: string; x: number; y: number }[] = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            tiles.push({ key: `t-${r}-${c}`, x: c * TILE, y: r * TILE });
          }
        }
        return (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              opacity: 0.85,
            }}
          >
            {tiles.map((t) => (
              // biome-ignore lint/performance/noImgElement: ImageResponse uses raw img
              <img
                key={t.key}
                alt=""
                src={patternSrc}
                width={TILE}
                height={TILE}
                style={{
                  position: "absolute",
                  left: t.x,
                  top: t.y,
                }}
              />
            ))}
          </div>
        );
      })()}

      {/* Foreground: two-column layout */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
          gap: 60,
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: ImageResponse cannot use next/image */}
        <img
          alt="Chappie"
          src={heroSrc}
          width={420}
          height={420}
          style={{
            filter: "drop-shadow(0 24px 48px rgba(106, 70, 40, 0.35))",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 110,
              fontWeight: 700,
              color: "#4a3826",
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            Chappie
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 500,
              color: "#6a4628",
              lineHeight: 1.3,
            }}
          >
            {tagline}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              color: "#8b6b4f",
              lineHeight: 1.45,
              maxWidth: 540,
            }}
          >
            {lead}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Zen Maru Gothic", data: medium, weight: 500, style: "normal" },
        {
          name: "Zen Maru Gothic",
          data: semibold,
          weight: 700,
          style: "normal",
        },
        { name: "Zen Maru Gothic", data: bold, weight: 900, style: "normal" },
      ],
    },
  );
}
