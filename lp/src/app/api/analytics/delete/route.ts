import { type NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Hard-delete every analytics row for this device, plus the consent
// row. Called when the user clicks "Delete sent data" in Settings.
//
// This is a single atomic-ish operation from the user's POV. We don't
// try a true transaction (Supabase RPC would be the way) because the
// blast radius is small (one device's rows) and a partial failure is
// acceptable — the next call will finish the job.

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

  const { error: eventErr, count: eventCount } = await supabaseAdmin()
    .from("analytics_event")
    .delete({ count: "exact" })
    .eq("device_id", deviceId);
  if (eventErr) {
    return NextResponse.json(
      { error: `event delete failed: ${eventErr.message}` },
      { status: 500 },
    );
  }

  const { error: consentErr } = await supabaseAdmin()
    .from("analytics_consent")
    .delete()
    .eq("device_id", deviceId);
  if (consentErr) {
    return NextResponse.json(
      { error: `consent delete failed: ${consentErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, events_deleted: eventCount ?? 0 });
}
