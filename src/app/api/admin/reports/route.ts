// POST /api/admin/reports { id }: mark an Akhada report as handled (D51). Three open reports from different people
// hide someone from the global board (D46), so resolving is what un-hides a wrongly reported person.
import { z } from "zod";
import { adminError, adminJson, audit, requireAdmin } from "@/server/admin/auth";
import { supabaseAdmin } from "@/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ id: z.number().int().positive(), target: z.uuid().optional() });

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return adminJson({ error: "bad_request" }, 400);
  try {
    const { data, error } = await supabaseAdmin().rpc("admin_resolve_report", { p_id: body.data.id });
    if (error) return adminError("reports", error);
    if (data) await audit(admin, "resolve_report", body.data.target ?? null, { report: body.data.id });
    return adminJson({ resolved: Boolean(data) });
  } catch (err) {
    return adminError("reports", err);
  }
}
