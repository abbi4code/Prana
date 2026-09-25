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

/** A finished visit from either source (server copy, or saved on this phone and not yet uploaded). */
export type FinishedVisit = { id: string; start: number; end: number; verified: boolean; auto: boolean; local: boolean };

/** Finished visits from both sources, newest first. A check-out waiting to sync counts as finished. */
export function finishedVisits(visits: GymVisit[], local: LocalVisit[], pendingCheckout: { visitId: string; endedAt: number } | null): FinishedVisit[] {
  const out: FinishedVisit[] = [];
  const serverIds = new Set(visits.map((v) => v.id));
  for (const v of visits) {
    const end = v.endedAt ? Date.parse(v.endedAt) : pendingCheckout?.visitId === v.id ? pendingCheckout.endedAt : null;
    if (end != null)
      out.push({ id: v.id, start: Date.parse(v.startedAt), end, verified: v.startVerification === "verified", auto: v.status === "auto_closed", local: false });
  }
  for (const v of local)
    if (v.endedAt != null && !serverIds.has(v.id)) out.push({ id: v.id, start: v.startedAt, end: v.endedAt, verified: false, auto: false, local: true });
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

/** Visits long enough to count (counter, workout day). Unverified ones count too, with a tag in the UI. */
export const counted = (v: { start: number; end: number }, minMinutes: number) => v.end - v.start >= minMinutes * 60_000;
