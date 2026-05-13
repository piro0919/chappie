import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "webhook secret missing" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: `signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  // Idempotency: Stripe retries the same event on failure.
  const { data: seen } = await supabaseAdmin
    .from("processed_event")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (seen) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (userId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscription(userId, sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId =
          sub.metadata?.supabase_user_id ??
          (await lookupUserIdFromCustomer(
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          ));
        if (userId) {
          await upsertSubscription(userId, sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: `handler failed: ${message}` },
      { status: 500 },
    );
  }

  await supabaseAdmin.from("processed_event").insert({ event_id: event.id });

  return NextResponse.json({ received: true });
}

async function upsertSubscription(userId: string, sub: Stripe.Subscription) {
  // current_period_end can be on the subscription or on the first item depending on Stripe API version.
  const periodEndUnix =
    // biome-ignore lint/suspicious/noExplicitAny: Stripe types lag the actual API shape across versions
    (sub as any).current_period_end ??
    sub.items.data[0]?.current_period_end ??
    null;
  const periodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : null;
  if (!periodEnd) return;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  await supabaseAdmin.from("subscription").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

async function lookupUserIdFromCustomer(
  customerId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("subscription")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}
