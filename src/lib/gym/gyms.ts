// The user's gym (D30). The app keeps one current gym; the table can hold more (a switched-away gym is soft-deleted,
// so its past visits keep pointing at it). Pure, no app imports, so it can be tested with Node.
import type { Gym } from "../types";

/**
 * The gym the app works with: the newest one. Normally there is exactly one, but a device that was offline during a
 * switch can bring the old gym back with an edit (last write wins), so "first in the list" isn't safe.
 * Returns an element of `gyms` (never a new object), so it's safe inside a zustand selector.
 */
export function currentGym(gyms: readonly Gym[]): Gym | null {
  let best: Gym | null = null;
  for (const g of gyms) if (!best || g.createdAt > best.createdAt || (g.createdAt === best.createdAt && g.id > best.id)) best = g;
  return best;
}

export const hasLocation = (g: Gym | null): g is Gym & { lat: number; lng: number } => !!g && g.lat != null && g.lng != null;

/** Did an edit move the pin or change the radius? (the nearby banner's "not now" no longer applies) */
export const placeChanged = (a: Gym | null, b: Gym) => !a || a.lat !== b.lat || a.lng !== b.lng || a.radiusM !== b.radiusM;
