// GET /api/admin/stats?section=growth|food|training|system|social&days=30: one panel tab's numbers (D51).
// Computed by Postgres functions only the service role can call (migration 20260927130000_admin).
import { z } from "zod";
import { adminError, adminJson, requireAdmin } from "@/server/admin/auth";
import { supabaseAdmin } from "@/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  section: z.enum(["growth", "food", "training", "system", "social"]),
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return adminJson({ error: "bad_request" }, 400);
  try {
    const { data, error } = await supabaseAdmin().rpc(`admin_${q.data.section}`, { p_days: q.data.days });
    if (error) return adminError(`stats/${q.data.section}`, error);
    return adminJson(data);
  } catch (err) {
    return adminError(`stats/${q.data.section}`, err);
  }
}
