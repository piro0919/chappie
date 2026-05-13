import "server-only";
import { supabaseAdmin } from "./supabase";

const DAILY_LIMIT = Number(process.env.CHAPPIE_FREE_DAILY_LIMIT ?? "20");

export type QuotaResult =
  | { ok: true; count: number; limit: number; remaining: number }
  | { ok: false; count: number; limit: number; remaining: 0 };

/**
 * Atomically record this (device, turn) pair and, only when newly seen,
 * increment the device's daily quota. Subsequent rounds in the same
 * Chappie turn (e.g. tool-call follow-ups) reuse the turn_id and do
 * NOT consume additional quota.
 */
export async function consumeQuota(
  deviceId: string,
  turnId: string,
): Promise<QuotaResult> {
  const { data, error } = await supabaseAdmin.rpc("consume_quota_with_turn", {
    p_device_id: deviceId,
    p_turn_id: turnId,
  });

  if (error) {
    throw new Error(`quota increment failed: ${error.message}`);
  }

  const count = typeof data === "number" ? data : Number(data);
  const remaining = Math.max(0, DAILY_LIMIT - count);

  if (count > DAILY_LIMIT) {
    return { ok: false, count, limit: DAILY_LIMIT, remaining: 0 };
  }

  return { ok: true, count, limit: DAILY_LIMIT, remaining };
}
