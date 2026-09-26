import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Place, normalizeQuery, type PlacesRequest } from "@/lib/gym/places";
import { supabaseAdmin } from "../supabase-admin";

// Shared cache of provider answers (place_cache, server only). Same search from anyone nearby = one provider call.
// Places change slowly; an empty answer is kept briefly so a gym added to OpenStreetMap shows up soon.
const TTL_MS = 30 * 86_400_000;
const EMPTY_TTL_MS = 86_400_000;

/**
 * Typed search: position rounded to ~1 km (it only biases the ranking). Nearby: ~110 m (it sets the search circle).
 * The text is normalized, so "HSR  Layout" and "hsr layout" share an entry.
 */
export function placeKey(provider: string, req: PlacesRequest) {
  const round = (n: number, d: number) => n.toFixed(d);
  const query = req.mode === "search" ? normalizeQuery(req.q) : "";
  const at = req.near ? `${round(req.near.lat, req.mode === "search" ? 2 : 3)},${round(req.near.lng, req.mode === "search" ? 2 : 3)}` : "in";
  const text = `${provider}|${req.mode}|${query}|${at}`;
  return { key: createHash("sha256").update(text).digest("hex"), query: `${query}@${at}` };
}

export async function readPlaces(key: string): Promise<Place[] | null> {
  const { data, error } = await supabaseAdmin().from("place_cache").select("result, created_at").eq("key", key).maybeSingle();
  if (error || !data) return null;
  const places = z.array(Place).safeParse(data.result); // re-validate: never trust stored data blindly
  if (!places.success) return null;
  const age = Date.now() - Date.parse(data.created_at);
  if (age > (places.data.length ? TTL_MS : EMPTY_TTL_MS)) return null;
  // stats only, don't wait. Supabase queries are lazy: without .then() the request is never sent
  void supabaseAdmin().rpc("bump_place_cache", { p_key: key }).then(({ error }) => error && console.warn("[places] bump:", error.message));
  return places.data;
}

export async function writePlaces(key: string, provider: string, kind: PlacesRequest["mode"], query: string, result: Place[]) {
  // overwrite: an expired entry is replaced with the fresh answer
  const { error } = await supabaseAdmin()
    .from("place_cache")
    .upsert({ key, provider, kind, query: query.slice(0, 200), result, created_at: new Date().toISOString(), hits: 0 }, { onConflict: "key" });
  if (error) console.error("[places] cache write failed:", error.message);
}
