import "server-only";
import { serverEnv } from "../env";
import { supabaseAdmin } from "../supabase-admin";

// Admin panel access (D51). The browser never decides who is an admin: the server checks the verified JWT against
// ADMIN_EMAILS, and only for Google sign-ins (Google proves the mailbox, so an email/password sign-up with the same
// address can't pass).

export type Admin = { id: string; email: string };

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** "signed_out" = no valid token; "forbidden" = signed in but not an admin. */
export async function checkAdmin(req: Request): Promise<Admin | "signed_out" | "forbidden"> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return "signed_out";
  try {
    const { data, error } = await supabaseAdmin().auth.getClaims(token);
    const c = data?.claims;
    if (error || !c?.sub || c.role !== "authenticated") return "signed_out";
    const email = typeof c.email === "string" ? c.email.toLowerCase() : "";
    const provider = (c.app_metadata as { provider?: string } | undefined)?.provider;
    const allowed = serverEnv().ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!email || provider !== "google" || !allowed.includes(email)) return "forbidden";
    return { id: c.sub, email };
  } catch {
    return "signed_out";
  }
}

/** The admin behind a request, or the error response to send back. */
export async function requireAdmin(req: Request): Promise<Admin | Response> {
  const a = await checkAdmin(req);
  if (a === "signed_out") return json({ error: "unauthorized" }, 401);
  if (a === "forbidden") return json({ error: "forbidden" }, 403);
  return a;
}

export const adminJson = (body: unknown, status = 200) => json(body, status);

/** Postgres/PostgREST errors → a reply. A missing function/table means the admin migration isn't pushed yet. */
export function adminError(where: string, err: unknown): Response {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  if (code === "PGRST202" || code === "42883" || code === "42P01" || code === "PGRST205") return json({ error: "not_migrated" }, 503);
  console.error(`[admin/${where}]`, e?.message ?? err);
  return json({ error: "server_error" }, 500);
}

/** Append to the access log. Never blocks the reply: a failed log line is reported, not fatal. */
export async function audit(admin: Admin, action: "view_user" | "export_user" | "resolve_report" | "food_request" | "food_candidate" | "shared_food", target: string | null, detail?: Record<string, unknown>) {
  const { error } = await supabaseAdmin()
    .from("admin_audit")
    .insert({ admin_id: admin.id, admin_email: admin.email, action, target_user: target, detail: detail ?? null });
  if (error) console.error("[admin/audit]", error.message);
}
