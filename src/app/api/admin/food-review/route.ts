// Shared foods review (D54 phases 2–4, .claude/food-requests.md).
// GET  ?status=pending|approved|rejected: candidates (with their request + label reading) + every shared food; for
//      pending ones, what would stop Approve (`problems`), notes (`labelNotes`) and the label comparison (`labelChecks`).
// POST { kind: "candidate", id, decision: approve|reject, reason?, labelChecked? }: approve re-checks the food (FoodSchema,
//      not a catalog id, a label food must match its label reading) and, for a label food, needs the owner's tick.
//      { kind: "label", id, image }: read a label image (https link or an uploaded photo) and keep it with the candidate.
//      { kind: "use_label", id }: replace the candidate's numbers with the label reading's.
//      { kind: "shared", id, live }: retract / restore a shared food.
// Every decision is logged in admin_audit.
import { z } from "zod";
import type { Food } from "@/lib/types";
import { adminError, adminJson, audit, requireAdmin } from "@/server/admin/auth";
import { applyLabel, labelUrlOk, labelVerdict, readAndStore, type StoredLabel } from "@/server/foods/label";
import { foodProblems } from "@/server/foods/schema";
import { supabaseAdmin } from "@/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // reading a label takes ~10 s

const Query = z.object({ status: z.enum(["pending", "approved", "rejected"]).default("pending") });
const Body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("candidate"), id: z.number().int().positive(), decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(300).optional(), labelChecked: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("label"), id: z.number().int().positive(), image: z.string().max(4_000_000).refine(labelUrlOk, "not an https image link or a photo") }),
  z.object({ kind: z.literal("use_label"), id: z.number().int().positive() }),
  z.object({ kind: z.literal("shared"), id: z.string().min(1).max(80), live: z.boolean() }),
]);

type Row = { food_id: string; data: Food; source: { id?: string } | null; label: StoredLabel | null; status: string; request_id: number | null };

/** Everything that would stop Approve, plus the label notes and comparison for the card. */
function review(c: Pick<Row, "food_id" | "data" | "source" | "label">) {
  const lv = labelVerdict(c.source?.id, c.data, c.label);
  return { problems: [...foodProblems(c.data, c.food_id), ...lv.problems], labelNotes: lv.warnings, labelChecks: lv.checks };
}

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return adminJson({ error: "bad_request" }, 400);
  try {
    const { data, error } = await supabaseAdmin().rpc("admin_food_review", { p_status: q.data.status });
    if (error) return adminError("food-review", error);
    const d = data as { candidates: { foodId: string; data: Food; status: string; source: Row["source"]; label?: StoredLabel | null }[] };
    for (const c of d.candidates) {
      const r = review({ food_id: c.foodId, data: c.data, source: c.source, label: c.label ?? null });
      Object.assign(c, c.status === "pending" ? r : { problems: [], labelNotes: [], labelChecks: r.labelChecks });
    }
    return adminJson(d);
  } catch (err) {
    return adminError("food-review", err);
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return adminJson({ error: "bad_request" }, 400);
  const b = body.data;
  const db = supabaseAdmin();
  try {
    if (b.kind === "shared") {
      const { data, error } = await db.rpc("admin_shared_food_set", { p_id: b.id, p_live: b.live });
      if (error) return adminError("food-review", error);
      if (!data) return adminJson({ error: "not_found" }, 404);
      await audit(admin, "shared_food", null, { foodId: b.id, live: b.live });
      return adminJson({ ok: true });
    }

    const { data: c, error: rowErr } = await db.from("food_candidates").select("food_id, data, source, label, status, request_id").eq("id", b.id).maybeSingle();
    if (rowErr) return adminError("food-review", rowErr);
    if (!c) return adminJson({ error: "not_found" }, 404);
    const row = c as Row;

    if (b.kind === "label" || b.kind === "use_label") {
      if (row.status !== "pending") return adminJson({ error: "decided" }, 409);
      if (b.kind === "label") {
        const label = await readAndStore(b.image, admin.email);
        // an https label becomes the food's image_url (provenance); an uploaded photo stays only in the admin panel
        const source = b.image.startsWith("https://") && label.reading?.is_nutrition_label ? { ...row.source, image_url: b.image } : row.source;
        const { error } = await db.from("food_candidates").update({ label, source }).eq("id", b.id);
        if (error) return adminError("food-review", error);
        await audit(admin, "food_candidate", null, { candidate: b.id, label: label.reading ? "read" : "failed", model: label.model });
        return adminJson({ ok: true, ...review({ ...row, source, label }), label });
      }
      if (!row.label?.per100) return adminJson({ error: "no_label" }, 409);
      let next: Food;
      try {
        next = applyLabel(row.data, row.label.per100);
      } catch (e) {
        return adminJson({ error: "bad_label", problems: [e instanceof Error ? e.message : String(e)] }, 422);
      }
      const problems = foodProblems(next, row.food_id);
      if (problems.length) return adminJson({ error: "bad_food", problems }, 422);
      const { error } = await db.from("food_candidates").update({ data: next }).eq("id", b.id);
      if (error) return adminError("food-review", error);
      await audit(admin, "food_candidate", null, { candidate: b.id, usedLabel: true, kcal: [row.data.kcal, next.kcal] });
      return adminJson({ ok: true, data: next, ...review({ ...row, data: next }) });
    }

    if (b.decision === "approve") {
      const r = review(row);
      if (r.problems.length) return adminJson({ error: "bad_food", problems: r.problems }, 422);
      // Q12: label numbers are transcribed, so the owner confirms them against the label before they go live
      if (row.source?.id === "MFR_LABEL" && !b.labelChecked) return adminJson({ error: "label_not_checked" }, 422);
    }
    const { data, error } = await db.rpc("admin_food_candidate_decide", { p_id: b.id, p_decision: b.decision, p_by: admin.email, p_reason: b.reason ?? null });
    if (error) return adminError("food-review", error);
    if (data === "not_found") return adminJson({ error: "not_found" }, 404);
    if (data === "decided") return adminJson({ error: "decided" }, 409);
    if (data === "rejected" && row.request_id)
      // the request goes back to the open list with the reason, ready for another try (D54 phase 3)
      await db.from("food_requests").update({ status: "new", food_id: null, reason: `Rejected${b.reason ? `: ${b.reason}` : ""}`.slice(0, 300) }).eq("id", row.request_id).eq("status", "researching");
    await audit(admin, "food_candidate", null, { candidate: b.id, decision: b.decision, ...(b.reason ? { reason: b.reason } : {}), ...(b.labelChecked ? { labelChecked: true } : {}) });
    return adminJson({ ok: true, result: data });
  } catch (err) {
    return adminError("food-review", err);
  }
}
