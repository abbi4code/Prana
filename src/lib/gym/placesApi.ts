"use client";

import { getSupabase } from "../supabase";
import { PlacesResponse, type PlacesRequest } from "./places";

export type PlacesOutcome =
  | { ok: true; data: PlacesResponse }
  | { ok: false; reason: "signed_out" | "offline" | "rate_limited" | "not_configured" | "failed"; retryAfterS?: number };

// same request twice in one session (typing back and forth, reopening the sheet) never goes out twice
const memo = new Map<string, PlacesResponse>();

/** Gym place search via /api/places/search. Every failure leaves the map + current location as the way to place a gym. */
export async function searchPlaces(req: PlacesRequest, signal?: AbortSignal): Promise<PlacesOutcome> {
  const k = JSON.stringify(req);
  const seen = memo.get(k);
  if (seen) return { ok: true, data: seen };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, reason: "offline" };
  const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
  if (!token) return { ok: false, reason: "signed_out" };
  try {
    const res = await fetch("/api/places/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
      signal,
    });
    const body = await res.json().catch(() => null);
    if (res.status === 401) return { ok: false, reason: "signed_out" };
    if (res.status === 429) return { ok: false, reason: "rate_limited", retryAfterS: body?.retryAfterS };
    if (res.status === 503 && body?.error === "not_configured") return { ok: false, reason: "not_configured" };
    const parsed = PlacesResponse.safeParse(body); // validate on this side too
    if (!res.ok || !parsed.success) return { ok: false, reason: "failed" };
    if (memo.size > 200) memo.clear();
    memo.set(k, parsed.data);
    return { ok: true, data: parsed.data };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return { ok: false, reason: navigator.onLine ? "failed" : "offline" };
  }
}
