import "server-only";
import type { Place } from "@/lib/gym/places";
import { serverEnv } from "../env";
import { geoapify } from "./geoapify";

/**
 * A place-search provider (gym-checkin.md "Place search"). Only providers whose terms allow showing results on our
 * Leaflet/OSM map AND keeping the chosen coordinates can be added here (that rules out Google, Mapbox, Mappls, HERE).
 * Adapters return already-validated `Place`s; a provider failure throws (the route answers 503).
 */
export type PlacesProvider = {
  id: string;
  attribution: { text: string; href: string }[];
  /** areas, streets and named places for typed text, preferring results near `near`; India only */
  search: (q: string, near: { lat: number; lng: number } | null) => Promise<Place[]>;
  /** gyms / fitness centres within `radiusM` of a point, nearest first */
  nearby: (near: { lat: number; lng: number }, radiusM: number) => Promise<Place[]>;
};

/** The configured provider, or null when its key isn't set (search then says it's unavailable). */
export function placesProvider(): PlacesProvider | null {
  const env = serverEnv();
  switch (env.PLACES_PROVIDER) {
    case "geoapify":
      return env.GEOAPIFY_API_KEY ? geoapify(env.GEOAPIFY_API_KEY) : null;
  }
}
