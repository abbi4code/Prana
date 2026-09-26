import "server-only";
import { z } from "zod";
import { Place, type PlaceKind } from "@/lib/gym/places";
import type { PlacesProvider } from "./provider";

// Geoapify (OSM-based). Terms: commercial use on the free plan, results may be stored, any map; attribution required
// ("Powered by Geoapify" + OpenStreetMap). Docs: apidocs.geoapify.com/docs/geocoding/address-autocomplete,
// apidocs.geoapify.com/docs/places. Cost: 1 credit per autocomplete call, 1 per 20 places.

const BASE = "https://api.geoapify.com";
const TIMEOUT_MS = 5000;

// the fields we use; everything else is ignored. Rows that don't fit are dropped, not fatal.
const Row = z.object({
  place_id: z.string(),
  name: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
  formatted: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  result_type: z.string().optional(),
  category: z.string().optional(),
  categories: z.array(z.string()).optional(),
});
type Row = z.infer<typeof Row>;

const AREA_TYPES = new Set(["suburb", "district", "city", "postcode", "county", "state", "locality"]);

function kindOf(r: Row): PlaceKind {
  const cats = [r.category ?? "", ...(r.categories ?? [])];
  if (cats.some((c) => c.startsWith("sport.fitness"))) return "gym";
  if (r.result_type && AREA_TYPES.has(r.result_type)) return "area";
  return "place";
}

const isStationOnly = (cats: string[]) =>
  cats.includes("sport.fitness.fitness_station") && !cats.some((c) => c === "sport.fitness.fitness_centre" || c === "sport.fitness.gym");

function toPlace(raw: unknown): Place | null {
  const r = Row.safeParse(raw);
  if (!r.success || r.data.result_type === "country") return null;
  const d = r.data;
  const name = (d.name || d.address_line1 || d.formatted || "").trim();
  // the second line: the rest of the address, without repeating the name
  const label = (d.address_line2 && d.address_line2 !== name ? d.address_line2 : d.formatted ?? "").replace(/, India$/, "").trim();
  const p = Place.safeParse({ id: d.place_id, name: name.slice(0, 160), label: label.slice(0, 240), lat: d.lat, lng: d.lon, kind: kindOf(d) });
  return p.success ? p.data : null;
}

async function get(path: string, params: Record<string, string>, key: string): Promise<unknown> {
  const url = `${BASE}${path}?${new URLSearchParams({ ...params, apiKey: key })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  // never log the URL: it carries the key
  if (!res.ok) throw new Error(`geoapify ${path} ${res.status}`);
  return res.json();
}

const ll = (p: { lat: number; lng: number }) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`; // Geoapify wants lon,lat

export function geoapify(key: string): PlacesProvider {
  return {
    id: "geoapify",
    attribution: [
      { text: "Powered by Geoapify", href: "https://www.geoapify.com/" },
      { text: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
    ],
    async search(q, near) {
      const body = (await get("/v1/geocode/autocomplete", {
        text: q, format: "json", lang: "en", limit: "8", filter: "countrycode:in",
        ...(near ? { bias: `proximity:${ll(near)}` } : {}),
      }, key)) as { results?: unknown[] };
      return (body.results ?? []).map(toPlace).filter((p): p is Place => !!p);
    },
    async nearby(near, radiusM) {
      const body = (await get("/v2/places", {
        categories: "sport.fitness", lang: "en", limit: "20",
        filter: `circle:${ll(near)},${radiusM}`, bias: `proximity:${ll(near)}`,
      }, key)) as { features?: { properties?: unknown }[] };
      return (body.features ?? []).flatMap((f) => {
        const r = Row.safeParse(f.properties);
        // a gym needs a name to be recognisable (else the street would be shown as its name); outdoor
        // "fitness stations" (bars in a park) aren't gyms
        if (!r.success || !r.data.name?.trim() || isStationOnly(r.data.categories ?? [])) return [];
        const p = toPlace(r.data);
        return p && p.kind === "gym" ? [p] : [];
      });
    },
  };
}
