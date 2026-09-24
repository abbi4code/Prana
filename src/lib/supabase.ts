"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// new projects call it "publishable key"; older ones "anon key": either works
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** false until .env.local has the Supabase URL + key; the app then runs local-only */
export const supabaseEnabled = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

/** Browser-only client. PKCE: Google redirects back with ?code=, which the client exchanges on load. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled || typeof window === "undefined") return null;
  client ??= createClient(URL!, KEY!, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
