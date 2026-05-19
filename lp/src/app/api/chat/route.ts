import { type NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth";
import { ANALYTICS_OPT_IN_BONUS, consumeQuota, DAILY_LIMIT } from "@/lib/quota";
import { isStaffEmail } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function POST(req: NextRequest) {
  const deviceId = req.headers.get("x-chappie-device-id");
  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { error: "missing or invalid X-Chappie-Device-Id header" },
      { status: 400 },
    );
  }

  const turnId = req.headers.get("x-chappie-turn-id");
  if (!turnId || turnId.length < 8 || turnId.length > 128) {
    return NextResponse.json(
      { error: "missing or invalid X-Chappie-Turn-Id header" },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server misconfigured: GEMINI_API_KEY missing" },
      { status: 500 },
    );
  }

  // Paid users: skip quota entirely.
  const user = await verifyBearer(req.headers.get("authorization"));
  let paid = false;
  if (user) {
    if (isStaffEmail(user.email)) {
      paid = true;
    } else {
      const { data } = await supabaseAdmin
        .from("subscription")
        .select("status, current_period_end")
        .eq("user_id", user.userId)
        .maybeSingle();
      paid =
        data != null &&
        (data.status === "active" || data.status === "trialing") &&
        new Date(data.current_period_end) > new Date();
    }
  }

  // Analytics opt-in bumps Free daily quota. Header is trusted at the
  // quota layer; the analytics ingestion endpoint re-verifies against
  // the analytics_consent table separately, so faking the header here
  // only raises the cap without granting any data flow.
  const consentBonus =
    req.headers.get("x-chappie-analytics-consent") === "true"
      ? ANALYTICS_OPT_IN_BONUS
      : 0;
  const effectiveLimit = DAILY_LIMIT + consentBonus;

  let quotaLimit = 0;
  let quotaRemaining = "unlimited";
  if (!paid) {
    const quota = await consumeQuota(deviceId, turnId, effectiveLimit);
    if (!quota.ok) {
      return NextResponse.json(
        {
          error: "daily quota exceeded",
          limit: quota.limit,
          count: quota.count,
          resets_at_utc: "00:00",
        },
        {
          status: 429,
          headers: {
            "X-Chappie-Quota-Limit": String(quota.limit),
            "X-Chappie-Quota-Remaining": "0",
          },
        },
      );
    }
    quotaLimit = quota.limit;
    quotaRemaining = String(quota.remaining);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const upstreamUrl = `${GEMINI_BASE}/${MODEL}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      {
        error: "upstream error",
        status: upstream.status,
        detail: text.slice(0, 500),
      },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Chappie-Tier": paid ? "paid" : "free",
      "X-Chappie-Quota-Limit": String(quotaLimit),
      "X-Chappie-Quota-Remaining": quotaRemaining,
    },
  });
}
