"use client";

import { useAuth } from "../auth";
import { useStore } from "../store";
import { syncNow } from "../sync/engine";
import { gymApi } from "./api";
import type { Reading } from "./location";
import type { Verdict } from "./schema";
import type { LocationStatus } from "./verify";
import { activeVisit } from "./visits";

// Check-in / check-out (D30). Phase 2: an optional location reading, judged by the server.
// Online by default: the server stamps the time and writes the visit. With no signal (or as a guest) the visit
// is saved on the phone with the phone's clock, marked offline + unverified, and uploaded on the next sync.

export type GymResult = { ok: true; offline: boolean } | { ok: false; message: string };
/** What a location attempt produced; `reading` only when status is "ok". Coordinates go to the server once, then are dropped. */
export type Loc = { status: LocationStatus; reading?: Reading; force?: boolean };
export type CheckInResult =
  | { kind: "started"; offline: boolean; verdict?: Verdict }
  | { kind: "confirm"; verdict: Verdict } // outside the radius / fuzzy reading: ask "Try again" or "Check in anyway"
  | { kind: "error"; message: string };

const signedIn = () => useAuth.getState().status === "signedIn";
const syncFor = (ms: number) => Promise.race([syncNow().catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
const tooMany = (s?: number) => `Too many taps. Try again in ${s ?? 60} s.`;

export async function checkIn(gymId: string | null, loc: Loc = { status: "off" }): Promise<CheckInResult> {
  const s = useStore.getState();
  if (activeVisit(s.visits, s.localVisits, s.pendingCheckout?.visitId ?? null)) return { kind: "started", offline: false }; // double tap
  if (!signedIn()) {
    s.startLocalVisit(gymId);
    return { kind: "started", offline: true };
  }
  // the server must already know the gym (and the consent just given) before it can judge a reading;
  // capped, so a slow gym network never leaves the button spinning (worst case: this check-in isn't verified)
  if ((gymId && s.sync.dirtyGyms.includes(gymId)) || (loc.status === "ok" && s.sync.goalsDirty)) await syncFor(4000);

  const body = { gymId, locationStatus: loc.status, location: loc.reading, force: loc.force ?? false };
  let out = await gymApi({ path: "/api/gym/check-in", body });
  if (!out.ok && out.reason === "gym_not_found") {
    await syncFor(4000);
    out = await gymApi({ path: "/api/gym/check-in", body });
  }
  if (out.ok) {
    if (!out.data.visit && out.data.verdict) return { kind: "confirm", verdict: out.data.verdict };
    return { kind: "started", offline: false, verdict: out.data.verdict };
  }
  if (out.reason === "rate_limited") return { kind: "error", message: tooMany(out.retryAfterS) };
  // never block a workout: no signal (or a server hiccup) → keep it on the phone, unverified
  useStore.getState().startLocalVisit(gymId);
  return { kind: "started", offline: true };
}

export async function checkOut(loc: Loc = { status: "off" }): Promise<GymResult & { ms?: number }> {
  const s = useStore.getState();
  const a = activeVisit(s.visits, s.localVisits, s.pendingCheckout?.visitId ?? null);
  if (!a) return { ok: true, offline: false };
  const now = Date.now();
  if (a.offline) {
    s.endLocalVisit(a.id, now);
    if (signedIn()) void syncNow();
    return { ok: true, offline: true, ms: now - a.startedAt };
  }
  const out = await gymApi({ path: "/api/gym/check-out", body: { locationStatus: loc.status, location: loc.reading } });
  if (out.ok) {
    const v = out.data.visit;
    return { ok: true, offline: false, ms: v?.endedAt ? Date.parse(v.endedAt) - Date.parse(v.startedAt) : now - a.startedAt };
  }
  if (out.reason === "rate_limited") return { ok: false, message: tooMany(out.retryAfterS) };
  // offline: stop the timer now, tell the server later (with the phone's time)
  s.setPendingCheckout({ visitId: a.id, endedAt: now });
  return { ok: true, offline: true, ms: now - a.startedAt };
}

/** On app open / back to the foreground: the server's active visit (another device may have changed it) + clock skew. */
export async function refreshActive() {
  if (!signedIn()) return;
  const out = await gymApi({ path: "/api/gym/active" });
  if (!out.ok) return;
  const s = useStore.getState();
  // closed elsewhere (other device): the pull will bring the ended copy; drop our stale "active" view now
  if (!out.data.visit) {
    const stale = s.visits.filter((v) => v.endedAt == null && v.id !== s.pendingCheckout?.visitId);
    if (stale.length) void syncNow();
  }
}

let started = false;
/** Once, after auth is initialised: refresh on sign-in and whenever the app comes back to the foreground. */
export function initGym() {
  if (started || typeof window === "undefined") return;
  started = true;
  useAuth.subscribe((a, prev) => {
    if (a.status === "signedIn" && prev.status !== "signedIn") void refreshActive();
  });
  if (useAuth.getState().status === "signedIn") void refreshActive();
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void refreshActive());
}
