import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "./env";

let admin: SupabaseClient | null = null;

/** Service-role client: bypasses RLS. Server routes only, never sent to a browser. */
export function supabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const env = serverEnv();
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}
