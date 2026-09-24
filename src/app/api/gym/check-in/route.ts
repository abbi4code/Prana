// POST /api/gym/check-in: starts a gym visit (D30). Idempotent: an active visit is returned, not duplicated.
// Phase 2: with a location reading (and the user's consent), the SERVER measures the distance to the gym and
// decides verified / outside_radius / low_accuracy. The last two wait for the user ("Try again" / "Check in
// anyway" = force). Coordinates are never stored. Offline/guest visits are uploaded here too (not_checked).
import { CheckInBody } from "@/lib/gym/schema";
import type { VisitRow } from "@/lib/sync/rows";
import { requestUser } from "@/server/auth";
import { needsConfirm } from "@/lib/gym/verify";
import { activeVisitRow, callGym, json, logFailedAttempt, rateLimited, reply, serverError, serverJudge } from "@/server/gym/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const body = CheckInBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return json({ error: "bad_request" }, 400);
    const limited = await rateLimited(user.id);
    if (limited) return limited;

    const { gymId, offline, location, locationStatus, force } = body.data;
    if (offline) {
      const out = offline.endedAt
        ? await callGym<{ visit: VisitRow; created: boolean }>("gym_record_visit", {
            p_user: user.id, p_gym: gymId, p_id: offline.id, p_started_at: offline.startedAt, p_ended_at: offline.endedAt,
          })
        : await callGym<{ visit: VisitRow; created: boolean }>("gym_check_in", {
            p_user: user.id, p_gym: gymId, p_verification: "not_checked", p_distance: null, p_accuracy: null,
            p_source: "web_offline", p_id: offline.id, p_started_at: offline.startedAt,
          });
      if ("res" in out) return out.res;
      return reply(out.data.visit, { created: out.data.created });
    }

    // already checked in (double tap / another device): no need to measure anything
    const active = await activeVisitRow(user.id);
    if (active) return reply(active, { created: false });

    const j = await serverJudge(user.id, gymId, locationStatus, location);
    if (needsConfirm(j.verification) && !force) {
      await logFailedAttempt(user.id, gymId, j);
      return reply(null, { verdict: { ...j } });
    }
    const out = await callGym<{ visit: VisitRow; created: boolean }>("gym_check_in", {
      p_user: user.id, p_gym: gymId, p_verification: j.verification, p_distance: j.distanceM, p_accuracy: j.accuracyM, p_source: "web_manual",
    });
    if ("res" in out) return out.res;
    return reply(out.data.visit, { created: out.data.created, verdict: { ...j } });
  } catch (err) {
    return serverError("gym/check-in", err);
  }
}
