// GET /api/gym/active: the active visit (or null) + the server's clock, so the timer can correct for skew (D30).
// Also closes a forgotten visit (lazy auto-close, called on every app open).
import type { VisitRow } from "@/lib/sync/rows";
import { requestUser } from "@/server/auth";
import { autoClose, json, reply, serverError } from "@/server/gym/visits";
import { supabaseAdmin } from "@/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const autoClosed = await autoClose(user.id); // lazy auto-close: runs whenever the app opens (phase 4)
    const { data, error } = await supabaseAdmin()
      .from("gym_visits")
      .select("*")
      .eq("user_id", user.id)
      .is("ended_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return reply(data as VisitRow | null, { autoClosed });
  } catch (err) {
    return serverError("gym/active", err);
  }
}
