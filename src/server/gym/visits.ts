import "server-only";
import { AUTO_CLOSE_HOURS, FORGOTTEN_DEFAULT_MINUTES, RATE_PER_DAY, RATE_PER_MINUTE } from "@/lib/gym/config";
import type { GymResponse } from "@/lib/gym/schema";
import { judge, type Judgement, type LocationStatus } from "@/lib/gym/verify";
import { rowToVisit, type VisitRow } from "@/lib/sync/rows";
import { supabaseAdmin } from "../supabase-admin";

// Server side of gym check-in (D30). All writes go through Postgres functions (one transaction each, server
// clock, one-active-visit index), called with the service role: users can read their visits but never write them.

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export const reply = (visit: VisitRow | null, extra: Partial<GymResponse> = {}) =>
  json({ visit: visit ? rowToVisit(visit) : null, serverNow: Date.now(), ...extra } satisfies GymResponse);

/**
 * Lazy auto-close (phase 4, no cron): every gym call first closes a visit left open longer than
 * AUTO_CLOSE_HOURS. Ends at the last exercise logged during it, else start + FORGOTTEN_DEFAULT_MINUTES.
 */
export async function autoClose(userId: string) {
  const { data, error } = await supabaseAdmin().rpc("gym_auto_close", {
    p_user: userId, p_after_minutes: AUTO_CLOSE_HOURS * 60, p_default_minutes: FORGOTTEN_DEFAULT_MINUTES,
  });
  if (error) throw new Error(`auto-close: ${error.message}`);
  const v = (data as { visit: VisitRow | null }).visit;
  return v ? rowToVisit(v) : undefined;
}

/** Per-user limit on check-in/out calls. Returns a 429 response when over, else null. */
export async function rateLimited(userId: string): Promise<Response | null> {
  const { data, error } = await supabaseAdmin().rpc("consume_gym_rate", { p_user: userId, p_per_minute: RATE_PER_MINUTE, p_per_day: RATE_PER_DAY });
  if (error) throw new Error(`gym rate: ${error.message}`);
  const row = (data as { allowed: boolean; retry_after_s: number }[])[0];
  return row.allowed ? null : json({ error: "rate_limited", retryAfterS: row.retry_after_s }, 429, { "Retry-After": String(row.retry_after_s) });
}

/** Calls one of the gym_* functions; maps its raised errors to HTTP responses. */
export async function callGym<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T } | { res: Response }> {
  const { data, error } = await supabaseAdmin().rpc(fn, args);
  if (!error) return { data: data as T };
  if (error.message.includes("gym_not_found")) return { res: json({ error: "gym_not_found" }, 404) };
  if (error.message.includes("bad_time")) return { res: json({ error: "bad_time" }, 400) };
  if (error.message.includes("visit_not_found")) return { res: json({ error: "visit_not_found" }, 404) };
  if (error.message.includes("not_editable")) return { res: json({ error: "not_editable" }, 409) };
  throw new Error(`${fn}: ${error.message}`);
}

export function serverError(route: string, err: unknown) {
  console.error(`[${route}]`, err instanceof Error ? err.message : err);
  return json({ error: "server_error" }, 500);
}

type Reading = { lat: number; lng: number; accuracy: number };

/**
 * The server's verdict for a reading (D30 phase 2). Reads the user's consent and gym from the DB (never trusts
 * the client for either); the coordinates are used for the distance and then dropped.
 */
export async function serverJudge(userId: string, gymId: string | null, status: LocationStatus, reading?: Reading): Promise<Judgement & { radiusM: number | null }> {
  if (status !== "ok" || !reading) return { ...judge(status, undefined, false, null), radiusM: null };
  const db = supabaseAdmin();
  const [goals, gym] = await Promise.all([
    db.from("user_goals").select("location_consent").eq("user_id", userId).maybeSingle(),
    gymId ? db.from("user_gyms").select("lat, lng, radius_m").eq("id", gymId).eq("user_id", userId).is("deleted_at", null).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (goals.error) throw new Error(`consent: ${goals.error.message}`);
  if (gym.error) throw new Error(`gym: ${gym.error.message}`);
  const g = gym.data as { lat: number | null; lng: number | null; radius_m: number } | null;
  const out = judge(status, reading, goals.data?.location_consent === true, g ? { lat: g.lat, lng: g.lng, radiusM: g.radius_m } : null);
  return { ...out, radiusM: g?.radius_m ?? null };
}

/** The user's active visit, if any (service role). */
export async function activeVisitRow(userId: string): Promise<VisitRow | null> {
  const { data, error } = await supabaseAdmin().from("gym_visits").select("*").eq("user_id", userId).is("ended_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  return data as VisitRow | null;
}

/** Append-only record of a check-in the user was asked to confirm (outside the radius / fuzzy reading). */
export async function logFailedAttempt(userId: string, gymId: string | null, j: Judgement) {
  const { error } = await supabaseAdmin().from("gym_events").insert({
    user_id: userId, gym_id: gymId, type: "check_in_attempt_failed", verification: j.verification,
    distance_m: j.distanceM, accuracy_m: j.accuracyM, source: "web_manual",
  });
  if (error) console.error("[gym] attempt event:", error.message); // never block the user over an audit row
}
