"use client";

import { getSupabase } from "../supabase";
import { ParseResponse } from "./schema";

export type ParseOutcome =
  | { ok: true; data: ParseResponse }
  | { ok: false; reason: "signed_out" | "offline" | "rate_limited" | "failed"; retryAfterS?: number };

/** Sentence → parsed structure via /api/food/parse. Every failure means "fall back to plain search". */
export async function parseSentence(text: string, signal?: AbortSignal): Promise<ParseOutcome> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, reason: "offline" };
  const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
  if (!token) return { ok: false, reason: "signed_out" };
  try {
    const res = await fetch("/api/food/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
      signal,
    });
    const body = await res.json().catch(() => null);
    if (res.status === 401) return { ok: false, reason: "signed_out" };
    if (res.status === 429) return { ok: false, reason: "rate_limited", retryAfterS: body?.retryAfterS };
    const parsed = ParseResponse.safeParse(body); // defence in depth: validate on this side too
    return parsed.success && res.ok ? { ok: true, data: parsed.data } : { ok: false, reason: "failed" };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return { ok: false, reason: navigator.onLine ? "failed" : "offline" };
  }
}
