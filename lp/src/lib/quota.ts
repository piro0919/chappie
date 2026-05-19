import "server-only";
import { supabaseAdmin } from "./supabase";

export const DAILY_LIMIT = Number(process.env.CHAPPIE_FREE_DAILY_LIMIT ?? "20");
export const ANALYTICS_OPT_IN_BONUS = Number(
  process.env.CHAPPIE_ANALYTICS_QUOTA_BONUS ?? "10",
);

export type QuotaResult =
  | { ok: true; count: number; limit: number; remaining: number }
  | { ok: false; count: number; limit: number; remaining: 0 };

/**
 * Atomically record this (device, turn) pair and, only when newly seen,
 * increment the device's daily quota. Subsequent rounds in the same
 * Chappie turn (e.g. tool-call follow-ups) reuse the turn_id and do
 * NOT consume additional quota.
 *
 * `limitOverride` lets callers (currently the chat route, when the
 * client opts in to analytics) raise the daily ceiling above the
 * default DAILY_LIMIT. Pass undefined to use DAILY_LIMIT as-is.
 */
export async function consumeQuota(
  deviceId: string,
  turnId: string,
  limitOverride?: number,
): Promise<QuotaResult> {
  const { data, error } = await supabaseAdmin.rpc("consume_quota_with_turn", {
    p_device_id: deviceId,
    p_turn_id: turnId,
  });

  if (error) {
    throw new Error(`quota increment failed: ${error.message}`);
  }

  const count = typeof data === "number" ? data : Number(data);
  const effectiveLimit = limitOverride ?? DAILY_LIMIT;
  const remaining = Math.max(0, effectiveLimit - count);

  if (count > effectiveLimit) {
    return { ok: false, count, limit: effectiveLimit, remaining: 0 };
  }

  return { ok: true, count, limit: effectiveLimit, remaining };
}
