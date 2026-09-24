"use client";

import { getSupabase } from "../supabase";

/**
 * Record what the user changed on the confirm card (nl-logging.md). Fire-and-forget: a failed
 * insert must never block logging. RLS lets users insert only their own rows.
 */
export function logCorrection(rawInput: string, parsed: unknown, confirmed: unknown) {
  const supabase = getSupabase();
  if (!supabase) return;
  void supabase.auth.getSession().then(({ data }) => {
    const user = data.session?.user;
    if (!user) return;
    return supabase
      .from("parse_corrections")
      .insert({ user_id: user.id, raw_input: rawInput.slice(0, 500), parsed, confirmed })
      .then(({ error }) => error && console.warn("[corrections]", error.message));
  });
}
