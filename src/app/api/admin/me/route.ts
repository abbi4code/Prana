// GET /api/admin/me: is the signed-in user an admin? (D51) Decided on the server only (ADMIN_EMAILS, Google sign-in).
import { adminJson, checkAdmin } from "@/server/admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await checkAdmin(req);
  if (a === "signed_out") return adminJson({ error: "unauthorized" }, 401);
  return adminJson({ admin: a !== "forbidden" });
}
