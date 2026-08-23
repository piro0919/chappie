import "server-only";
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  type JWTPayload,
  jwtVerify,
} from "jose";

// Supabase migrated from HS256 symmetric signing to ES256 asymmetric +
// JWKS publishing at `/auth/v1/.well-known/jwks.json`. Verifying via the
// project's JWKS is the forward-compatible path — kid rotations happen
// transparently because the verifier re-fetches as needed.
//
// `jose`'s `createRemoteJWKSet` caches keys in-process and refreshes on
// kid miss with a built-in cooldown, so this is safe to call on every
// request without hammering Supabase.
//
// HS256 path is kept as a local-dev fallback: `supabase start` still
// issues HS256-signed tokens (no JWKS endpoint), so without this the
// LP would reject every locally-issued bearer and block paid-flow
// testing against the docker stack. Prod tokens are ES256; the HS256
// branch only triggers when the JWT header explicitly says HS256 AND
// `SUPABASE_JWT_SECRET` is configured, so it cannot be used to
// downgrade a prod request.
// Read on first use rather than at import time: the build imports every
// route to collect page data, and reading SUPABASE_URL up here made that
// fail wherever it is absent - preview deployments most of all.
let jwksCache: null | ReturnType<typeof createRemoteJWKSet> = null;

function jwks(): ReturnType<typeof createRemoteJWKSet> {
  if (jwksCache) return jwksCache;

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL must be set in the environment");
  }

  jwksCache = createRemoteJWKSet(
    new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`),
  );
  return jwksCache;
}

function hs256Key(): null | Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
}

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
  const token = match[1];

  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    return null;
  }

  let payload: JWTPayload;
  try {
    if (alg === "HS256") {
      const key = hs256Key();
      if (!key) return null;
      ({ payload } = await jwtVerify(token, key, {
        algorithms: ["HS256"],
      }));
    } else {
      // ES256 is the current Supabase default; RS256 / EdDSA exist on
      // some older / migrated projects.
      ({ payload } = await jwtVerify(token, jwks(), {
        algorithms: ["ES256", "RS256", "EdDSA"],
      }));
    }
  } catch {
    return null;
  }

  const userId = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!userId || !email) return null;
  return { userId, email };
}
