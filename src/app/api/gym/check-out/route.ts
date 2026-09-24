// POST /api/gym/check-out: ends the active gym visit (D30). No active visit (double tap) → { visit: null }.
// With a reading (phase 2) the end is verified too (end_verification); it never blocks leaving.
import { CheckOutBody } from "@/lib/gym/schema";
import type { VisitRow } from "@/lib/sync/rows";
import { requestUser } from "@/server/auth";
import { activeVisitRow, callGym, json, rateLimited, reply, serverError, serverJudge } from "@/server/gym/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const body = CheckOutBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return json({ error: "bad_request" }, 400);
    const limited = await rateLimited(user.id);
    if (limited) return limited;

    const { offline, location, locationStatus } = body.data;
    const active = offline ? null : await activeVisitRow(user.id);
    if (!offline && !active) return reply(null);
    const j = offline ? { verification: "not_checked" as const, distanceM: null, accuracyM: null } : await serverJudge(user.id, active!.gym_id, locationStatus, location);
    const out = await callGym<{ visit: VisitRow | null; closed: boolean }>("gym_check_out", {
      p_user: user.id, p_verification: j.verification, p_distance: j.distanceM, p_accuracy: j.accuracyM,
      p_source: offline ? "web_offline" : "web_manual", p_ended_at: offline?.endedAt ?? null,
    });
    if ("res" in out) return out.res;
    return reply(out.data.visit);
  } catch (err) {
    return serverError("gym/check-out", err);
  }
}
