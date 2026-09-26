"use client";

import { useStore, useUI } from "../store";
import { NEARBY_AFTER_VISIT_MINUTES, NEARBY_MAX_AGE_MS, NEARBY_SNOOZE_HOURS } from "./config";
import { permissionState, readLocation } from "./location";
import { currentGym } from "./gyms";
import { verify } from "./verify";
import { activeVisit, finishedVisits } from "./visits";

// Nearby banner (D30 phase 4): the closest the web gets to "automatic". Runs when the app opens or comes back
// to the foreground, ONLY if the app setting is on AND the browser permission is already "granted" (so it can
// never pop a permission prompt). The distance is worked out here on the phone; nothing is sent anywhere.

const key = (gymId: string) => `prana-nearby-${gymId}`;

function snoozed(gymId: string) {
  try {
    const t = Number(localStorage.getItem(key(gymId)));
    return t > 0 && Date.now() - t < NEARBY_SNOOZE_HOURS * 3600_000;
  } catch {
    return false;
  }
}

/** Hide the banner for this gym for a few hours (dismissed, or used to check in). */
export function snoozeNearby(gymId: string) {
  try {
    localStorage.setItem(key(gymId), String(Date.now()));
  } catch {}
  useUI.setState({ nearby: null });
}

/** The gym moved, was switched or removed: an old "not now" or banner no longer applies. */
export function resetNearby(gymId: string) {
  try {
    localStorage.removeItem(key(gymId));
  } catch {}
  if (useUI.getState().nearby) useUI.setState({ nearby: null });
}

let checking = false;
export async function checkNearby() {
  if (checking) return;
  checking = true;
  try {
    const s = useStore.getState();
    const gym = currentGym(s.gyms);
    const clear = () => {
      if (useUI.getState().nearby) useUI.setState({ nearby: null });
    };
    if (!gym || gym.lat == null || gym.lng == null || s.locationConsent !== true) return clear();
    if (activeVisit(s.visits, s.localVisits, s.pendingCheckout?.visitId ?? null)) return clear();
    if (snoozed(gym.id)) return;
    const last = finishedVisits(s.visits, s.localVisits, s.pendingCheckout)[0];
    if (last && Date.now() - last.end < NEARBY_AFTER_VISIT_MINUTES * 60_000) return; // just left
    if ((await permissionState()) !== "granted") return; // "prompt" / "unknown" → never risk a popup
    const r = await readLocation({ highAccuracy: false, maxAgeMs: NEARBY_MAX_AGE_MS, timeoutMs: 10_000 });
    if (!r.ok) return;
    const v = verify(r.reading, { lat: gym.lat, lng: gym.lng, radiusM: gym.radiusM });
    if (v.verification === "verified") useUI.setState({ nearby: { gymId: gym.id, name: gym.name, distanceM: v.distanceM } });
    else clear();
  } finally {
    checking = false;
  }
}
