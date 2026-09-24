// Location verification (D30, phase 2). Pure: runs on the server for check-in/out, and on the phone only for
// the nearby banner (phase 4). No app imports, so it can be tested with Node.
import type { Verification } from "../types";
import { ACCURACY_MAX_M } from "./config.ts"; // .ts: lets Node run this file directly in tests

const EARTH_RADIUS_M = 6_371_008.8; // mean Earth radius (IUGG)

/** Great-circle distance in metres (Haversine). Plenty accurate at gym scale; no PostGIS needed. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Verdict = { verification: Verification; distanceM: number; accuracyM: number };

/**
 * One reading against the gym. `accuracyM` is the phone's 68 % radius around the reported point.
 * - too fuzzy (accuracy > ACCURACY_MAX_M) → low_accuracy
 * - reported point within the radius → verified
 * - outside even after giving the reading its full accuracy → outside_radius
 * - outside, but the fuzz could still put you inside → low_accuracy (try again, or check in anyway)
 */
export function verify(reading: { lat: number; lng: number; accuracy: number }, gym: { lat: number; lng: number; radiusM: number }): Verdict {
  const distanceM = Math.round(haversineM(reading, gym));
  const accuracyM = Math.round(reading.accuracy);
  let verification: Verification;
  if (accuracyM > ACCURACY_MAX_M) verification = "low_accuracy";
  else if (distanceM <= gym.radiusM) verification = "verified";
  else if (distanceM - accuracyM > gym.radiusM) verification = "outside_radius";
  else verification = "low_accuracy";
  return { verification, distanceM, accuracyM };
}

export type LocationStatus = "ok" | "off" | "permission_denied" | "unavailable";
export type Judgement = { verification: Verification; distanceM: number | null; accuracyM: number | null };

/**
 * What the server records for one check-in/out. Coordinates are only used when the user's app-level consent
 * is on and the gym has a saved location; otherwise the visit is "not_checked". Never blocks.
 */
export function judge(status: LocationStatus, reading: { lat: number; lng: number; accuracy: number } | undefined, consent: boolean, gym: { lat: number | null; lng: number | null; radiusM: number } | null): Judgement {
  if (status === "permission_denied" || status === "unavailable") return { verification: status, distanceM: null, accuracyM: null };
  if (status !== "ok" || !reading || !consent || !gym || gym.lat == null || gym.lng == null) return { verification: "not_checked", distanceM: null, accuracyM: null };
  return verify(reading, { lat: gym.lat, lng: gym.lng, radiusM: gym.radiusM });
}

/** Verdicts the user is asked about before a visit starts ("Try again" / "Check in anyway"). */
export const needsConfirm = (v: Verification) => v === "outside_radius" || v === "low_accuracy";
