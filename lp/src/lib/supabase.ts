import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: null | SupabaseClient = null;

/**
 * Built on first use rather than at import time. Next collects page data
 * for every route during the build, which imports this module; reading
 * the credentials up there made the build fail wherever they are absent
 * — preview deployments most of all, which do not carry the service role
 * key and should not.
 *
 * A request that actually needs Supabase in an environment without the
 * credentials still fails, which is the honest outcome.
 */
export function supabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment",
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}
