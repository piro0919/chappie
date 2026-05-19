import { type NextRequest, NextResponse } from "next/server";

// Pixabay search proxy for chappie's voice wallpaper feature. The
// desktop binary calls this when a user says "壁紙を森に変えて" — we
// return N image URLs that the Rust side then downloads and hands to
// osascript for the actual desktop picture swap.
//
// Pixabay's free tier gives 100 req/min on a verified email API key,
// which is plenty of headroom for chappie's voice cadence. We don't
// enforce a per-device daily quota here (unlike /api/chat) because
// Pixabay's own throttle is generous and there's no upstream LLM bill
// to protect — if abuse becomes a problem we'll add quota later.
//
// Request:
//   GET /api/wallpaper?q=<query>&n=<count>
//   Header: X-Chappie-Device-Id: <stable device id>
//
// Response:
//   { images: [{ url, id, photographer, photographer_url }] }
//
// `url` is always a https://pixabay.com/... or https://cdn.pixabay.com/...
// CDN URL; the desktop binary re-verifies the host before downloading.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PIXABAY_BASE = "https://pixabay.com/api/";
const MAX_IMAGES = 8;
const MIN_QUERY_LEN = 1;
const MAX_QUERY_LEN = 80;

type PixabayHit = {
  id: number;
  pageURL: string;
  user: string;
  largeImageURL: string;
  fullHDURL?: string;
  imageURL?: string;
  imageWidth: number;
  imageHeight: number;
};

type PixabayResponse = {
  total: number;
  hits: PixabayHit[];
};

export async function GET(req: NextRequest) {
  const deviceId = req.headers.get("x-chappie-device-id");
  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { error: "missing or invalid X-Chappie-Device-Id header" },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < MIN_QUERY_LEN || q.length > MAX_QUERY_LEN) {
    return NextResponse.json(
      { error: "q must be 1-80 chars" },
      { status: 400 },
    );
  }
  const nRaw = Number(url.searchParams.get("n") ?? "1");
  const n = Math.max(1, Math.min(MAX_IMAGES, Math.floor(nRaw)));

  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server misconfigured: PIXABAY_API_KEY missing" },
      { status: 500 },
    );
  }

  const hits = await fetchHits(apiKey, q, n);
  if (hits === null) {
    return NextResponse.json(
      { error: "upstream error (pixabay)" },
      { status: 502 },
    );
  }
  if (hits.length === 0) {
    return NextResponse.json({ images: [] }, { status: 200 });
  }

  const images = hits.map((h) => ({
    url: pickBestUrl(h),
    id: h.id,
    photographer: h.user,
    photographer_url: h.pageURL,
  }));

  return NextResponse.json(
    { images },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Two-pass fetch: first try editors_choice + min_width=1920 for the
 * best curation/quality, fall back to an unfiltered query if the
 * curated set is empty (rare-keyword queries like "夜空" can return 0
 * editors-choice hits even when there's plenty of regular hits).
 */
async function fetchHits(
  apiKey: string,
  q: string,
  n: number,
): Promise<PixabayHit[] | null> {
  const curated = await pixabayQuery(apiKey, q, n, true);
  if (curated === null) return null;
  if (curated.length > 0) return curated;
  return pixabayQuery(apiKey, q, n, false);
}

async function pixabayQuery(
  apiKey: string,
  q: string,
  n: number,
  curated: boolean,
): Promise<PixabayHit[] | null> {
  const params = new URLSearchParams({
    key: apiKey,
    q,
    per_page: String(Math.max(3, n)), // Pixabay requires >=3
    orientation: "horizontal",
    safesearch: "true",
    image_type: "photo",
  });
  if (curated) {
    params.set("editors_choice", "true");
    params.set("min_width", "1920");
  }

  const upstreamUrl = `${PIXABAY_BASE}?${params.toString()}`;
  const upstream = await fetch(upstreamUrl, {
    headers: { Accept: "application/json" },
  });
  if (!upstream.ok) {
    return null;
  }
  const body = (await upstream.json()) as PixabayResponse;
  // Take the first `n` hits — Pixabay sorts by popularity descending.
  return body.hits.slice(0, n);
}

function pickBestUrl(hit: PixabayHit): string {
  // Prefer fullHDURL when present (email-verified key unlocks it).
  // Fall back to largeImageURL (1280px) which every key returns.
  return hit.fullHDURL ?? hit.imageURL ?? hit.largeImageURL;
}
