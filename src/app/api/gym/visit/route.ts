// PATCH /api/gym/visit: fix the guessed end time of an auto-closed visit (D30 phase 4).
// Real check-outs aren't editable; the end must be after the start, within the auto-close window, not in the future.
import { AUTO_CLOSE_HOURS } from "@/lib/gym/config";
import { SetEndBody } from "@/lib/gym/schema";
import type { VisitRow } from "@/lib/sync/rows";
import { requestUser } from "@/server/auth";
import { callGym, json, rateLimited, reply, serverError } from "@/server/gym/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const body = SetEndBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return json({ error: "bad_request" }, 400);
    const limited = await rateLimited(user.id);
    if (limited) return limited;
    const out = await callGym<{ visit: VisitRow }>("gym_set_end", {
      p_user: user.id, p_id: body.data.id, p_ended_at: body.data.endedAt, p_max_minutes: AUTO_CLOSE_HOURS * 60,
    });
    if ("res" in out) return out.res;
    return reply(out.data.visit);
  } catch (err) {
    return serverError("gym/visit", err);
  }
}
