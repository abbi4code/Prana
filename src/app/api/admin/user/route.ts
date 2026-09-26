// GET /api/admin/user?id=<uuid>[&export=1]: everything one account has on the server (D51). Every call is written to
// the admin access log (view or export), so looking at someone's food and body data always leaves a trace.
import { z } from "zod";
import { adminError, adminJson, audit, requireAdmin } from "@/server/admin/auth";
import { userBundle } from "@/server/admin/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({ id: z.uuid(), export: z.enum(["1"]).optional() });

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return adminJson({ error: "bad_request" }, 400);
  try {
    const bundle = await userBundle(q.data.id);
    if (!bundle) return adminJson({ error: "not_found" }, 404);
    await audit(admin, q.data.export ? "export_user" : "view_user", q.data.id);
    return adminJson(bundle);
  } catch (err) {
    return adminError("user", err);
  }
}
