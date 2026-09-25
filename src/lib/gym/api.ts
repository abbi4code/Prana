"use client";

import { getSupabase } from "../supabase";
import { useStore, useUI } from "../store";
import { AUTO_CLOSE_HOURS } from "./config";
import { GymResponse, type CheckInBody, type CheckOutBody, type SetEndBody } from "./schema";
import { duration } from "./visits";
import type { GymVisit } from "../types";

// Device side of the gym API (D30). No sync-engine import here, so the engine can call flushGym().

export type GymCall =
  | { ok: true; data: GymResponse }
  | { ok: false; reason: "signed_out" | "offline" | "rate_limited" | "gym_not_found" | "bad_time" | "failed"; retryAfterS?: number };

type Route =
  | { path: "/api/gym/check-in"; body: CheckInBody }
  | { path: "/api/gym/check-out"; body: CheckOutBody }
  | { path: "/api/gym/visit"; body: SetEndBody; method: "PATCH" }
  | { path: "/api/gym/active" };

export async function gymApi(route: Route): Promise<GymCall> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, reason: "offline" };
  const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
  if (!token) return { ok: false, reason: "signed_out" };
  const sent = Date.now();
  try {
    const res = await fetch(route.path, {
      method: "method" in route ? route.method : "body" in route ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "body" in route ? JSON.stringify(route.body) : undefined,
    });
    const body = await res.json().catch(() => null);
    if (res.status === 401) return { ok: false, reason: "signed_out" };
    if (res.status === 429) return { ok: false, reason: "rate_limited", retryAfterS: body?.retryAfterS };
    if (res.status === 404 && body?.error === "gym_not_found") return { ok: false, reason: "gym_not_found" };
    if (res.status === 400 && body?.error === "bad_time") return { ok: false, reason: "bad_time" };
    const parsed = GymResponse.safeParse(body);
    if (!res.ok || !parsed.success) return { ok: false, reason: "failed" };
    // timer skew: the server's clock at roughly the middle of the round trip
    useUI.setState({ clockSkew: parsed.data.serverNow - (sent + Date.now()) / 2 });
    if (parsed.data.visit) useStore.getState().putVisit(parsed.data.visit);
    if (parsed.data.autoClosed) announceAutoClosed(parsed.data.autoClosed);
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, reason: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "failed" };
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Uploads visits saved on this device (offline or as a guest) and a check-out tapped while offline.
 * Called by the sync engine after pushing (so the gym row exists on the server first). Stops at the first
 * network failure and leaves the rest for the next sync.
 */
export async function flushGym() {
  for (const v of useStore.getState().localVisits) {
    const body: CheckInBody = { gymId: v.gymId, offline: { id: v.id, startedAt: iso(v.startedAt), endedAt: v.endedAt ? iso(v.endedAt) : null } };
    let out = await gymApi({ path: "/api/gym/check-in", body });
    if (!out.ok && out.reason === "gym_not_found") out = await gymApi({ path: "/api/gym/check-in", body: { ...body, gymId: null } });
    if (!out.ok && out.reason === "bad_time" && v.endedAt == null) {
      // still "active" after a day offline: close it at the auto-close mark and send it next time
      useStore.getState().endLocalVisit(v.id, v.startedAt + AUTO_CLOSE_HOURS * 3600_000);
      continue;
    }
    if (!out.ok) {
      if (out.reason === "bad_time") useStore.getState().dropLocalVisit(v.id); // older than the server accepts
      else return;
      continue;
    }
    useStore.getState().dropLocalVisit(v.id);
  }
  const pc = useStore.getState().pendingCheckout;
  if (pc) {
    const out = await gymApi({ path: "/api/gym/check-out", body: { offline: { endedAt: iso(pc.endedAt) } } });
    if (out.ok || out.reason === "bad_time") useStore.getState().setPendingCheckout(null);
  }
}

/** "Your visit from 7:04 pm was closed automatically (1 h 30 min)" + Fix end. */
function announceAutoClosed(v: GymVisit) {
  useStore.getState().putVisit(v);
  const start = Date.parse(v.startedAt);
  const ms = v.endedAt ? Date.parse(v.endedAt) - start : 0;
  const at = new Date(start).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  useUI.getState().showToast(`Your gym visit from ${at} was closed automatically (${duration(ms)})`, {
    label: "Fix end",
    run: () => useUI.setState({ navTo: "/workout", fixVisitId: v.id }),
  });
}
