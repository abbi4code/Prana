// POST /api/admin/research { requestId }: research one missing food (D54 phase 3, .claude/food-requests.md).
// OpenAI (RESEARCH_MODEL, web search + tools over INDB / IFCT / USDA) names the source; the server reads the numbers
// and runs the checker (src/server/foods/verify.ts). Outcomes: a candidate waiting for the owner's check, "same as"
// an existing food (a suggestion the owner confirms), not found, or not a food. One food per call (~30–90 s), so the
// admin panel loops for "research the top N" and every call fits Vercel's 300 s.
import { z } from "zod";
import catalogJson from "@/data/foods.generated.json";
import type { Food } from "@/lib/types";
import { adminError, adminJson, audit, requireAdmin } from "@/server/admin/auth";
import { serverEnv } from "@/server/env";
import { labelUrlOk, readAndStore } from "@/server/foods/label";
import { researchFood, toResearchFood } from "@/server/foods/research";
import { verifyResearchFood } from "@/server/foods/verify";
import { rateLimit } from "@/server/rate";
import { supabaseAdmin } from "@/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({ requestId: z.number().int().positive() });
const catalog = catalogJson as Food[];
const cut = (s: string, n = 290) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return adminJson({ error: "bad_request" }, 400);
  const db = supabaseAdmin();
  try {
    const limited = await rateLimit(admin.id, "research", 6, serverEnv().RESEARCH_PER_DAY);
    if (limited) return limited;

    const { data: request, error } = await db.from("food_requests").select("id, name, status").eq("id", body.data.requestId).maybeSingle();
    if (error) return adminError("research", error);
    if (!request) return adminJson({ error: "not_found" }, 404);
    if (["alias", "found", "junk"].includes(request.status)) return adminJson({ error: "decided" }, 409);
    const { count: waiting } = await db.from("food_candidates").select("id", { count: "exact", head: true }).eq("request_id", request.id).eq("status", "pending");
    if (waiting) return adminJson({ error: "in_review" }, 409); // a candidate is already waiting for the owner's check

    const setRequest = (patch: { status: string; reason?: string | null; food_id?: string | null }) =>
      db.from("food_requests").update({ reason: null, food_id: null, ...patch }).eq("id", request.id);
    await setRequest({ status: "researching" });

    const [{ data: sharedRows }, { data: pendingRows }] = await Promise.all([
      db.from("shared_foods").select("data").is("deleted_at", null),
      db.from("food_candidates").select("food_id").eq("status", "pending"),
    ]);
    const shared = (sharedRows ?? []).map((r) => r.data as Food);
    const pendingIds = new Set((pendingRows ?? []).map((r) => r.food_id as string));

    const run = await researchFood(request.name, { shared, pendingIds });
    const meta = { model: run.model, turns: run.turns, searches: run.searches, tools: run.tools, usage: run.usage, ms: run.ms };
    const a = run.answer;
    let reply: Record<string, unknown>;

    if (!a) {
      await setRequest({ status: "new", reason: cut(`Research failed: ${run.error ?? "no answer"}`) });
      reply = { outcome: "error", reason: run.error };
    } else if (a.outcome === "not_food") {
      await setRequest({ status: "junk", reason: cut(`AI: not a food. ${a.reason}`) });
      reply = { outcome: "not_food", reason: a.reason };
    } else if (a.outcome === "not_found") {
      await setRequest({ status: "not_found", reason: cut(a.reason) });
      reply = { outcome: "not_found", reason: a.reason };
    } else if (a.outcome === "alias") {
      const target = [...catalog, ...shared].find((f) => f.id === a.alias_of);
      // a suggestion: it stays open with the food it points at, the owner confirms with "Same as"
      await setRequest(target
        ? { status: "new", food_id: target.id, reason: cut(`AI: same as ${target.name}. ${a.reason}`) }
        : { status: "new", reason: cut(`AI said "same as ${a.alias_of}", which isn't a Prana food`) });
      reply = { outcome: "alias", aliasOf: target?.id ?? null, name: target?.name ?? null, reason: a.reason };
    } else {
      const v = a.food ? await verifyResearchFood(toResearchFood(a.food), { shared, pendingIds, requestName: request.name }) : null;
      if (!v || !v.ok) {
        const problems = v && !v.ok ? v.problems : ["no food in the answer"];
        await setRequest({ status: "new", reason: cut(`AI found ${a.food?.source.id ?? "?"} ${a.food?.source.ref ?? ""} but it failed the checks: ${problems.slice(0, 2).join("; ")}`) });
        reply = { outcome: "failed_checks", problems, reason: a.reason };
      } else {
        // a food from a label: read the label image too (phase 4), so the card shows it beside the numbers
        const img = v.source.id === "MFR_LABEL" ? v.source.image_url : undefined;
        const label = img && labelUrlOk(img) ? await readAndStore(img, "research") : null;
        const { data: cand, error: insErr } = await db.from("food_candidates").insert({
          request_id: request.id, food_id: v.food.id, data: v.food, source: v.source, warnings: v.warnings,
          research: { answer: a, ...meta }, model: run.model, ...(label ? { label } : {}),
        }).select("id").single();
        if (insErr) return adminError("research", insErr);
        reply = { outcome: "food", candidateId: cand.id, name: v.food.name, kcal: v.food.kcal, reason: a.reason };
      }
    }
    await audit(admin, "food_request", null, { request: request.id, research: reply.outcome, ...meta });
    return adminJson({ ...reply, ...meta });
  } catch (err) {
    return adminError("research", err);
  }
}
