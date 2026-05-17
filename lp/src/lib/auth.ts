import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Supabase migrated from HS256 symmetric signing to ES256 asymmetric +
// JWKS publishing at `/auth/v1/.well-known/jwks.json`. Verifying via the
// project's JWKS is the forward-compatible path — kid rotations happen
// transparently because the verifier re-fetches as needed.
//
// `jose`'s `createRemoteJWKSet` caches keys in-process and refreshes on
// kid miss with a built-in cooldown, so this is safe to call on every
// request without hammering Supabase.
const supabaseUrl = process.env.SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL must be set in the environment");
}

const jwks = createRemoteJWKSet(
  new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`),
);

export type AuthedUser = {
  userId: string;
  email: string;
};

export async function verifyBearer(
  authHeader: string | null,
): Promise<AuthedUser | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], jwks, {
      // Cover the algorithms Supabase has shipped for project signing
      // keys (ES256 is the current default; RS256 / EdDSA exist on some
      // older / migrated projects).
      algorithms: ["ES256", "RS256", "EdDSA"],
    });
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}
