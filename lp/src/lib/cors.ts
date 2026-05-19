import { NextResponse } from "next/server";

// CORS for endpoints hit by the Chappie Tauri renderer (`/api/me`,
// `/api/billing/*`). The renderer's webview origin is `tauri://localhost`
// (macOS) — adding `*` is fine here because every endpoint that uses this
// helper is Bearer-protected, never reads cookies, and never echoes
// credentials.
//
// The chat endpoint doesn't need this: Rust reqwest hits `/api/chat`
// directly, which isn't subject to the browser CORS check.
const ALLOW_HEADERS = "authorization, content-type";
const ALLOW_METHODS = "GET, POST, OPTIONS";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
  };
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export function withCors<T extends NextResponse>(res: T): T {
  for (const [k, v] of Object.entries(corsHeaders())) {
    res.headers.set(k, v);
  }
  // Next's default for dynamic routes is `public, max-age=0, must-revalidate`,
  // which some WebViews honor as "use cached body until revalidated" rather
  // than "always re-fetch". Bearer-protected JSON should never be cached.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
