import { type NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth";
import { corsPreflight, withCors } from "@/lib/cors";
import { isStaffEmail } from "@/lib/staff";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) {
    return withCors(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("subscription")
    .select("status, current_period_end, stripe_customer_id")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (error) {
    return withCors(
      NextResponse.json({ error: "lookup failed" }, { status: 500 }),
    );
  }

  const now = new Date();
  const staff = isStaffEmail(user.email);
  const isPaid =
    staff ||
    (data != null &&
      (data.status === "active" || data.status === "trialing") &&
      new Date(data.current_period_end) > now);

  return withCors(
    NextResponse.json({
      email: user.email,
      user_id: user.userId,
      paid: isPaid,
      status: staff ? "active" : (data?.status ?? null),
      current_period_end: data?.current_period_end ?? null,
    }),
  );
}
