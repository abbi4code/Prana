// GET /api/admin/users?q=&sort=active|joined|logs|name&page=0: every account with its activity, 50 a page (D51).
import { z } from "zod";
import { adminError, adminJson, requireAdmin } from "@/server/admin/auth";
import { supabaseAdmin } from "@/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50; // route files may only export handlers + config
const Query = z.object({
  q: z.string().max(120).default(""),
  sort: z.enum(["active", "joined", "logs", "name"]).default("active"),
  page: z.coerce.number().int().min(0).max(1000).default(0),
  size: z.coerce.number().int().min(1).max(200).default(PAGE_SIZE),
});

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return adminJson({ error: "bad_request" }, 400);
  try {
    const { data, error } = await supabaseAdmin().rpc("admin_users", {
      p_q: q.data.q, p_sort: q.data.sort, p_limit: q.data.size, p_offset: q.data.page * q.data.size,
    });
    if (error) return adminError("users", error);
    return adminJson(data);
  } catch (err) {
    return adminError("users", err);
  }
}
