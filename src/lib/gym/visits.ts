// Pure helpers over server visits + device-only visits (D30). No app imports, so they can be tested with Node.
import type { GymVisit, LocalVisit, Verification } from "../types";

/** The visit in progress, if any. `offline` = only on this device so far (guest, or no signal at check-in). */
export type ActiveVisit = { id: string; gymId: string | null; startedAt: number; offline: boolean; unverified: boolean; verification: Verification };

export function activeVisit(visits: GymVisit[], local: LocalVisit[], pendingCheckoutId: string | null): ActiveVisit | null {
  const l = local.find((v) => v.endedAt == null);
  if (l) return { id: l.id, gymId: l.gymId, startedAt: l.startedAt, offline: true, unverified: true, verification: "not_checked" };
  const v = visits.find((x) => x.endedAt == null && x.id !== pendingCheckoutId);
  if (!v) return null;
  return { id: v.id, gymId: v.gymId, startedAt: Date.parse(v.startedAt), offline: false, unverified: v.startVerification !== "verified", verification: v.startVerification };
}

/** Finished visits from both sources as [start, end] ms, local ones not yet uploaded included. */
export function finishedVisits(visits: GymVisit[], local: LocalVisit[], pendingCheckout: { visitId: string; endedAt: number } | null) {
  const out: { id: string; start: number; end: number }[] = [];
  const serverIds = new Set(visits.map((v) => v.id));
  for (const v of visits) {
    const end = v.endedAt ? Date.parse(v.endedAt) : pendingCheckout?.visitId === v.id ? pendingCheckout.endedAt : null;
    if (end != null) out.push({ id: v.id, start: Date.parse(v.startedAt), end });
  }
  for (const v of local) if (v.endedAt != null && !serverIds.has(v.id)) out.push({ id: v.id, start: v.startedAt, end: v.endedAt });
  return out.sort((a, b) => b.start - a.start);
}

/** "1:02:15" under 10 h, for the live timer. */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** "1 h 12 min" / "45 min". */
export function duration(ms: number) {
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ""}`.trim();
}
