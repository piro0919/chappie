import { type NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth";
import { corsPreflight, withCors } from "@/lib/cors";
import { APP_BASE_URL, PORTAL_CONFIG_ID, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) {
    return withCors(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
  }

  const { data } = await supabaseAdmin()
    .from("subscription")
    .select("stripe_customer_id")
    .eq("user_id", user.userId)
    .maybeSingle();

  if (!data?.stripe_customer_id) {
    return withCors(
      NextResponse.json({ error: "no subscription" }, { status: 404 }),
    );
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${APP_BASE_URL}/upgrade/success`,
    ...(PORTAL_CONFIG_ID ? { configuration: PORTAL_CONFIG_ID } : {}),
  });

  return withCors(NextResponse.json({ url: session.url }));
}
