import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Opt-in consent toggle. Desktop calls this when the user flips the
// "Share usage data" switch in Settings.
//
// Body: { consent: boolean }
//   true  → upsert analytics_consent row
//   false → delete analytics_consent row (consent ledger doubles as
//           opt-in state; absence = opted out)
//
// Past events are NOT auto-deleted on opt-out — use /api/analytics/delete
// for that explicitly. This split lets a user "pause" analytics without
// losing the history they already contributed.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deviceId = req.headers.get("x-chappie-device-id");
  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    return NextResponse.json(
      { error: "missing or invalid X-Chappie-Device-Id header" },
      { status: 400 },
    );
  }

  let body: { consent?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.consent !== "boolean") {
    return NextResponse.json(
      { error: "body.consent must be boolean" },
      { status: 400 },
    );
  }

  if (body.consent) {
    const { error } = await supabaseAdmin().from("analytics_consent").upsert(
      {
        device_id: deviceId,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    );
    if (error) {
      return NextResponse.json(
        { error: `upsert failed: ${error.message}` },
        { status: 500 },
      );
    }
  } else {
    const { error } = await supabaseAdmin()
      .from("analytics_consent")
      .delete()
      .eq("device_id", deviceId);
    if (error) {
      return NextResponse.json(
        { error: `delete failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, consent: body.consent });
}
