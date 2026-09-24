import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/**
 * The signed-in user behind a request, from `Authorization: Bearer <Supabase access token>`.
 * getClaims() verifies the JWT signature against the project's public keys (ES256, cached JWKS),
 * so it's a local check, not a network round trip per request. Returns null for guests/invalid tokens.
 */
export async function requestUser(req: Request): Promise<{ id: string } | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin().auth.getClaims(token);
    const sub = data?.claims?.sub;
    if (error || !sub || data.claims.role !== "authenticated") return null;
    return { id: sub };
  } catch {
    return null; // malformed tokens can throw instead of returning an error
  }
}
