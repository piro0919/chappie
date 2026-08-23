import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Per-turn event ingestion. Desktop calls this fire-and-forget at the
// end of each chat turn when consent is on.
//
// Body:
//   {
//     turn_id: string,         (8-128 chars, same shape as /api/chat)
//     utterance: string,       (raw whisper output, max 2000 chars)
//     tool_calls: string[],    (tool names; [] for chitchat/pure response)
//     lang: "ja" | "en" | ...,
//     mode: "free" | "paid" | "byok",
//     latency_ms: number,
//     success: boolean,
//   }
//
// Consent is re-verified server-side: even if the desktop sends an
// event, we only insert if a row exists in analytics_consent. This
// guards against stale client state (user flipped off, desktop hadn't
// caught up).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UTTERANCE_CHARS = 2000;
const MAX_TOOL_CALLS = 16;
const VALID_LANGS = new Set([
  "ja",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ko",
  "zh",
]);
const VALID_MODES = new Set(["free", "paid", "byok"]);

type EventBody = {
  turn_id?: string;
  utterance?: string;
  tool_calls?: string[];
  lang?: string;
  mode?: string;
  latency_ms?: number;
  success?: boolean;
};

export async function POST(req: NextRequest) {
  const deviceId = req.headers.get("x-chappie-device-id");
  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { error: "missing or invalid X-Chappie-Device-Id header" },
      { status: 400 },
    );
  }

  let body: EventBody;
  try {
    body = (await req.json()) as EventBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const turnId = body.turn_id;
  if (typeof turnId !== "string" || turnId.length < 8 || turnId.length > 128) {
    return NextResponse.json(
      { error: "turn_id must be a string of length 8-128" },
      { status: 400 },
    );
  }
  if (typeof body.utterance !== "string") {
    return NextResponse.json(
      { error: "utterance must be string" },
      { status: 400 },
    );
  }
  // Trim oversized utterances rather than rejecting — we don't want a
  // user's long ramble to fail silently when the rest of the payload is
  // fine. 2000 chars is far past any plausible spoken utterance.
  const utterance = body.utterance.slice(0, MAX_UTTERANCE_CHARS);
  if (!Array.isArray(body.tool_calls)) {
    return NextResponse.json(
      { error: "tool_calls must be array" },
      { status: 400 },
    );
  }
  if (body.tool_calls.length > MAX_TOOL_CALLS) {
    return NextResponse.json(
      { error: `tool_calls cannot exceed ${MAX_TOOL_CALLS} items` },
      { status: 400 },
    );
  }
  const toolCalls = body.tool_calls.filter(
    (s): s is string =>
      typeof s === "string" && s.length > 0 && s.length <= 128,
  );
  if (typeof body.lang !== "string" || !VALID_LANGS.has(body.lang)) {
    return NextResponse.json(
      { error: "lang must be one of ja/en/es/fr/de/it/pt/ko/zh" },
      { status: 400 },
    );
  }
  if (typeof body.mode !== "string" || !VALID_MODES.has(body.mode)) {
    return NextResponse.json(
      { error: "mode must be free/paid/byok" },
      { status: 400 },
    );
  }
  if (typeof body.success !== "boolean") {
    return NextResponse.json(
      { error: "success must be boolean" },
      { status: 400 },
    );
  }
  const latencyMs =
    typeof body.latency_ms === "number" && body.latency_ms >= 0
      ? Math.floor(body.latency_ms)
      : null;

  // Re-verify consent server-side. If consent row is missing, drop the
  // event silently (200) so a flaky toggle on the client doesn't spam
  // 403s in dev logs. We log the device_id at debug-level upstream so
  // mismatch is still observable.
  const { data: consentRow } = await supabaseAdmin()
    .from("analytics_consent")
    .select("device_id")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!consentRow) {
    return NextResponse.json(
      { ok: true, dropped: "no_consent" },
      { status: 200 },
    );
  }

  const { error } = await supabaseAdmin().from("analytics_event").insert({
    device_id: deviceId,
    turn_id: turnId,
    utterance,
    tool_calls: toolCalls,
    lang: body.lang,
    mode: body.mode,
    latency_ms: latencyMs,
    success: body.success,
  });
  if (error) {
    // Duplicate (device_id, turn_id) — silently treat as success since
    // a retry shouldn't double-count.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, dropped: "duplicate" });
    }
    return NextResponse.json(
      { error: `insert failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
