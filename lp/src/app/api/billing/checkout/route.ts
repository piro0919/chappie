import { type NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth";
import { corsPreflight, withCors } from "@/lib/cors";
import { APP_BASE_URL, PRICE_ID, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  if (!PRICE_ID) {
    return withCors(
      NextResponse.json(
        { error: "server misconfigured: STRIPE_PRICE_ID missing" },
        { status: 500 },
      ),
    );
  }

  const user = await verifyBearer(req.headers.get("authorization"));
  if (!user) {
    return withCors(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("subscription")
    .select("stripe_customer_id")
    .eq("user_id", user.userId)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    ...(existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : { customer_email: user.email }),
    client_reference_id: user.userId,
    subscription_data: {
      metadata: { supabase_user_id: user.userId },
    },
    success_url: `${APP_BASE_URL}/upgrade/success`,
    cancel_url: `${APP_BASE_URL}/upgrade/cancel`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return withCors(
      NextResponse.json(
        { error: "checkout session has no url" },
        { status: 500 },
      ),
    );
  }

  return withCors(NextResponse.json({ url: session.url }));
}
