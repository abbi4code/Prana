import "server-only";
import { serverEnv } from "../env";
import { supabaseAdmin } from "../supabase-admin";

export type Quota = { allowed: boolean; retryAfterS: number; usedToday: number };

/** Atomically counts this request against the user's per-minute and per-day limits (Postgres fn). */
export async function consumeParseQuota(userId: string): Promise<Quota> {
  const env = serverEnv();
  const { data, error } = await supabaseAdmin().rpc("consume_parse_quota", {
    p_user: userId,
    p_per_minute: env.NL_PARSE_PER_MINUTE,
    p_per_day: env.NL_PARSE_PER_DAY,
  });
  if (error) throw new Error(`quota: ${error.message}`);
  const row = (data as { allowed: boolean; retry_after_s: number; used_today: number }[])[0];
  return { allowed: row.allowed, retryAfterS: row.retry_after_s, usedToday: row.used_today };
}
