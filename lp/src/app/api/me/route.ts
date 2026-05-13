import { type NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("subscription")
    .select("status, current_period_end, stripe_customer_id")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  const now = new Date();
  const isPaid =
    data != null &&
    (data.status === "active" || data.status === "trialing") &&
    new Date(data.current_period_end) > now;

  return NextResponse.json({
    email: user.email,
    user_id: user.userId,
    paid: isPaid,
    status: data?.status ?? null,
    current_period_end: data?.current_period_end ?? null,
  });
}
