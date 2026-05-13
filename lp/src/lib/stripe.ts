import "server-only";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY must be set in the environment");
}

export const stripe = new Stripe(secretKey);

export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";
export const PORTAL_CONFIG_ID = process.env.STRIPE_PORTAL_CONFIG_ID ?? "";
export const APP_BASE_URL =
  process.env.APP_BASE_URL ?? "https://chappie.kkweb.io";
