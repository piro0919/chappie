import { type NextRequest, NextResponse } from "next/server";

// HTTPS-origin host page for chappie's voice-launched YouTube mini player.
//
// Why this exists: the desktop miniplayer window can't embed YouTube
// directly. macOS Tauri serves the app over the `tauri://localhost`
// custom scheme, and YouTube's embedded player rejects playback with
// "error 153 / 動画プレーヤーの設定エラー" unless the embedding document
// has a valid http(s) origin (so the browser sends a real Referer). A
// custom-scheme document sends no acceptable referer, and loading the
// /embed/ URL top-level (no referer at all) fails the same way.
//
// So the desktop points the miniplayer window at THIS page instead. It's
// served from https://chappie.kkweb.io, so the iframe below sends
// `Referer: https://chappie.kkweb.io/...` and the embed plays.
//
// Returned as a route handler (raw HTML Response) rather than a React
// page so it sidesteps the [locale] layout entirely — the desktop loads
// it as a bare top-level document, not part of the localized site.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function GET(req: NextRequest): NextResponse {
  const v = (req.nextUrl.searchParams.get("v") ?? "").trim();
  // autoplay=1 + mute=1: WKWebView won't autoplay with sound without a
  // gesture; the user can unmute with one click on the player itself.
  const iframe = VIDEO_ID_RE.test(v)
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${v}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
    : "";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chappie Mini Player</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  iframe { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>${iframe}</body>
</html>`;
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
