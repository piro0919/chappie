import type { ReactElement } from "react";

// Direct YouTube embed iframe. We load youtube-nocookie.com which has
// looser embed allow-listing than the main domain — important because
// the Tauri webview origin (tauri://localhost) isn't on any normal
// embed allowlist, and the IFrame Player API path tripped a "playback
// error" overlay from YouTube's backend.
//
// Two embed forms:
// - `/embed/{videoId}?autoplay=1` for known IDs / URLs
// - `/embed?listType=search&list={query}&autoplay=1` for search-and-play
//
// `listType=search` is older and YouTube has it under "consider deprecated"
// for years, but it's still functional today. If it eventually breaks
// we'll need to switch to the YouTube Data API for search → resolve
// to a video ID first.

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function extractVideoId(input: string): string | null {
  if (VIDEO_ID_RE.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      if (VIDEO_ID_RE.test(id)) return id;
    }
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && VIDEO_ID_RE.test(v)) return v;
      const m = u.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL — fall through to search
  }
  return null;
}

function buildEmbedUrl(query: string): string {
  const videoId = extractVideoId(query);
  const base = "https://www.youtube-nocookie.com/embed";
  // autoplay=1 + mute=1 because most browsers (and WKWebView) refuse to
  // autoplay sound without a user gesture. The user can unmute with one
  // click on the player itself, and at least video plays immediately.
  const common = "autoplay=1&mute=1&rel=0&modestbranding=1";
  if (videoId) {
    return `${base}/${videoId}?${common}`;
  }
  const encoded = encodeURIComponent(query);
  return `${base}?listType=search&list=${encoded}&${common}`;
}

export function MiniplayerView(): ReactElement {
  const params = new URLSearchParams(window.location.search);
  const query = (params.get("q") ?? "").trim();
  if (!query) {
    return <div style={{ background: "#000", height: "100vh" }} />;
  }
  const src = buildEmbedUrl(query);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      <iframe
        title="Chappie miniplayer"
        src={src}
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
