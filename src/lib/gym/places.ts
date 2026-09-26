// Gym place search (D30 addendum, .claude/gym-checkin.md "Place search"). Shared by the server route, the provider
// adapters and the device, so it imports only zod + sibling files (Node can run it for tests).
//
// The search only moves the map / drops a pin. The gym's location is always the pin the USER confirms (they can drag
// it); the picked place is kept as a reference (`GymPlace`) for its area label and attribution.
import { z } from "zod";
import type { GymPlace } from "../types";
import { haversineM } from "./verify.ts";

export type { GymPlace };

const LatLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const SEARCH_MIN_CHARS = 3;
export const SEARCH_MAX_CHARS = 80;
/** "Gyms near here" looks this far around the map centre. */
export const NEARBY_RADIUS_M = 3000;

export const PlacesRequest = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("search"), q: z.string().trim().min(SEARCH_MIN_CHARS).max(SEARCH_MAX_CHARS), near: LatLng.nullable() }),
  z.object({ mode: z.literal("nearby"), near: LatLng }),
]);
export type PlacesRequest = z.infer<typeof PlacesRequest>;

/** gym = a fitness place · area = locality, suburb, city, pincode · place = any other building/street/POI */
export const PlaceKind = z.enum(["gym", "area", "place"]);
export type PlaceKind = z.infer<typeof PlaceKind>;

export const Place = z.object({
  id: z.string().min(1).max(300),
  name: z.string().min(1).max(160),
  /** the rest of the address, for the second line and the gym card ("HSR Layout, Bengaluru") */
  label: z.string().max(240),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  kind: PlaceKind,
});
export type Place = z.infer<typeof Place>;

export const PlacesResponse = z.object({
  places: z.array(Place),
  provider: z.string(),
  /** shown under the results, as the provider's terms require */
  attribution: z.object({ text: z.string(), href: z.url({ protocol: /^https$/ }) }).array(), // rendered as links: https only
  cached: z.boolean(),
});
export type PlacesResponse = z.infer<typeof PlacesResponse>;

/** Lower-case, trimmed, single spaces: one cache entry for "HSR  Layout" and "hsr layout". */
export const normalizeQuery = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_CHARS);

/** Moving the pin further than this from the picked place means it's somewhere else: drop the place reference. */
export const PLACE_KEEP_M = 1000;
export const placeStillFits = (place: GymPlace | null, pin: { lat: number; lng: number } | null) =>
  !!place && !!pin && haversineM(place, pin) <= PLACE_KEEP_M;

/** A stored place from the server/another device, checked before use (it's jsonb). */
export function readGymPlace(v: unknown): GymPlace | null {
  const p = z.object({ provider: z.string(), id: z.string(), label: z.string(), lat: z.number(), lng: z.number() }).safeParse(v);
  return p.success ? p.data : null;
}
