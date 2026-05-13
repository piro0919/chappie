import "server-only";
import { jwtVerify } from "jose";

const jwtSecret = process.env.SUPABASE_JWT_SECRET;

if (!jwtSecret) {
  throw new Error("SUPABASE_JWT_SECRET must be set in the environment");
}

const encodedSecret = new TextEncoder().encode(jwtSecret);

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
    const { payload } = await jwtVerify(match[1], encodedSecret, {
      algorithms: ["HS256"],
    });
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null;
  }
}
