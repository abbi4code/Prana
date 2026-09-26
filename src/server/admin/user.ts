import "server-only";
import { supabaseAdmin } from "../supabase-admin";
import type { AdminUserBundle } from "@/lib/admin/types";

// Everything one account has on the server (D51), as raw rows in the sync tables' shape, so the panel can reuse
// the app's own row mapping and maths (lib/sync/rows.ts, streaks, records). Progress photos never reach the server
// (D39) and guest data never leaves the device, so neither can appear here.

const PAGE = 1000;
const MISSING = new Set(["42P01", "PGRST205"]); // table not there yet (a migration that isn't pushed): treat as empty

async function all<T>(table: string, userCol: string, userId: string, opts: { order?: string; deleted?: boolean; limit?: number } = {}): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabaseAdmin().from(table).select("*").eq(userCol, userId);
    if (!opts.deleted) q = q.is("deleted_at", null);
    if (opts.order) q = q.order(opts.order, { ascending: false });
    const to = opts.limit ? Math.min(from + PAGE, opts.limit) - 1 : from + PAGE - 1;
    const { data, error } = await q.range(from, to);
    if (error) {
      if (MISSING.has(error.code)) return [];
      throw error;
    }
    out.push(...(data as T[]));
    if (!data || data.length < PAGE || (opts.limit && out.length >= opts.limit)) return out;
  }
}

async function one<T>(table: string, userCol: string, userId: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin().from(table).select("*").eq(userCol, userId).maybeSingle();
  if (error) {
    if (MISSING.has(error.code)) return null;
    throw error;
  }
  return data as T | null;
}

/** null = no such account. */
export async function userBundle(id: string): Promise<AdminUserBundle | null> {
  const { data: auth, error } = await supabaseAdmin().auth.admin.getUserById(id);
  if (error || !auth?.user) return null;
  const u = auth.user;

  const [goals, logs, workouts, weights, water, customFoods, meals, routines, measurements, gyms, visits, corrections, usage, social, reports, activity] =
    await Promise.all([
      one<AdminUserBundle["goals"]>("user_goals", "user_id", id),
      all<AdminUserBundle["logs"][number]>("food_logs", "user_id", id),
      all<AdminUserBundle["workouts"][number]>("workouts", "user_id", id),
      all<AdminUserBundle["weights"][number]>("weights", "user_id", id),
      all<AdminUserBundle["water"][number]>("water", "user_id", id, { deleted: true }), // water has no soft delete
      all<AdminUserBundle["customFoods"][number]>("custom_foods", "user_id", id),
      all<AdminUserBundle["meals"][number]>("saved_meals", "user_id", id),
      all<AdminUserBundle["routines"][number]>("routines", "user_id", id),
      all<AdminUserBundle["measurements"][number]>("measurements", "user_id", id),
      all<AdminUserBundle["gyms"][number]>("user_gyms", "user_id", id, { deleted: true }), // retired gyms explain old visits
      all<AdminUserBundle["visits"][number]>("gym_visits", "user_id", id, { order: "started_at" }),
      all<AdminUserBundle["corrections"][number]>("parse_corrections", "user_id", id, { deleted: true, order: "created_at", limit: 100 }),
      all<AdminUserBundle["usage"][number]>("parse_usage", "user_id", id, { deleted: true, order: "day", limit: 90 }),
      one<AdminUserBundle["social"]>("social_profiles", "user_id", id),
      all<AdminUserBundle["reports"][number]>("social_reports", "target", id, { deleted: true, order: "created_at", limit: 50 }),
      all<AdminUserBundle["activity"][number]>("activity_days", "user_id", id, { deleted: true, order: "day", limit: 400 }),
    ]);

  const meta = u.user_metadata ?? {};
  return {
    user: {
      id: u.id,
      email: u.email ?? null,
      name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
      avatar: (meta.avatar_url as string | undefined) ?? null,
      provider: (u.app_metadata?.provider as string | undefined) ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
    },
    goals, logs, workouts, weights, water, customFoods, meals, routines, measurements, gyms, visits, corrections, usage,
    social, reports, activity,
  };
}
