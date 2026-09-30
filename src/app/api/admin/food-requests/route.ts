// Missing-food requests (D54 phase 1, .claude/food-requests.md).
// GET  ?filter=open|done|junk|all&days=30: the queue, most wanted first (admin_food_requests).
// POST { id, status: new|alias|not_found|junk, foodId?, reason? }: triage one request; logged in admin_audit.
import { z } from "zod";
import { adminError, adminJson, audit, requireAdmin } from "@/server/admin/auth";
import { supabaseAdmin } from "@/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  filter: z.enum(["open", "done", "junk", "all"]).default("open"),
  days: z.coerce.number().int().min(7).max(365).default(30),
});

const Body = z
  .object({
    id: z.number().int().positive(),
    status: z.enum(["new", "alias", "not_found", "junk"]),
    foodId: z.string().trim().min(1).max(80).optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((b) => b.status !== "alias" || !!b.foodId, { message: "alias needs foodId" });

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return adminJson({ error: "bad_request" }, 400);
  try {
    const { data, error } = await supabaseAdmin().rpc("admin_food_requests", { p_days: q.data.days, p_filter: q.data.filter });
    if (error) return adminError("food-requests", error);
    return adminJson(data);
  } catch (err) {
    return adminError("food-requests", err);
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return adminJson({ error: "bad_request" }, 400);
  const { id, status, foodId, reason } = body.data;
  try {
    const { data, error } = await supabaseAdmin().rpc("admin_food_request_set", {
      p_id: id, p_status: status, p_food_id: foodId ?? null, p_reason: reason ?? null,
    });
    if (error) return adminError("food-requests", error);
    if (!data) return adminJson({ error: "not_found" }, 404);
    await audit(admin, "food_request", null, { request: id, status, ...(foodId ? { foodId } : {}) });
    return adminJson({ ok: true });
  } catch (err) {
    return adminError("food-requests", err);
  }
}
