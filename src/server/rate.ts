import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Per-user rate limit for a server route, one counter per `bucket` (Postgres `consume_api_rate`, atomic, IST days).
 * Returns a 429 response when over the limit, else null. Rejected calls count too, so hammering doesn't help.
 */
export async function rateLimit(userId: string, bucket: string, perMinute: number, perDay: number): Promise<Response | null> {
  const { data, error } = await supabaseAdmin().rpc("consume_api_rate", { p_user: userId, p_bucket: bucket, p_per_minute: perMinute, p_per_day: perDay });
  if (error) throw new Error(`rate ${bucket}: ${error.message}`);
  const row = (data as { allowed: boolean; retry_after_s: number }[])[0];
  if (row.allowed) return null;
  return Response.json(
    { error: "rate_limited", retryAfterS: row.retry_after_s },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(row.retry_after_s) } },
  );
}
