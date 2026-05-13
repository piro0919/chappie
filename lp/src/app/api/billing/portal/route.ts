import { type NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth";
import { APP_BASE_URL, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("subscription")
    .select("stripe_customer_id")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (!data?.stripe_customer_id) {
    return NextResponse.json({ error: "no subscription" }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${APP_BASE_URL}/upgrade/success`,
  });

  return NextResponse.json({ url: session.url });
}
