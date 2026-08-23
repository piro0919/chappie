import "server-only";
import Stripe from "stripe";

let client: null | Stripe = null;

/**
 * Built on first use for the same reason as the Supabase client: the
 * build imports every route to collect page data, and reading the secret
 * key at import time made that fail wherever the key is absent.
 */
export function stripe(): Stripe {
  if (client) return client;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY must be set in the environment");
  }

  client = new Stripe(secretKey);
  return client;
}

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";
export const PORTAL_CONFIG_ID = process.env.STRIPE_PORTAL_CONFIG_ID ?? "";
export const APP_BASE_URL =
  process.env.APP_BASE_URL ?? "https://chappie.kkweb.io";
