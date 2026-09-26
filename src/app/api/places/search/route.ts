// POST /api/places/search: find a gym's place for the gym sheet's map (gym-checkin.md "Place search").
// { mode: "search", q, near } → areas + named places (India, nearest to the map first)
// { mode: "nearby", near }    → gyms within NEARBY_RADIUS_M of the map centre
// Signed-in users only (rate limited per user); the provider key stays here; answers are cached for everyone.
// Only moves the map / drops a pin: the gym's location is always the pin the user confirms.
import { NEARBY_RADIUS_M, PlacesRequest, type PlacesResponse } from "@/lib/gym/places";
import { requestUser } from "@/server/auth";
import { serverEnv } from "@/server/env";
import { placeKey, readPlaces, writePlaces } from "@/server/places/cache";
import { placesProvider } from "@/server/places/provider";
import { rateLimit } from "@/server/rate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    const body = PlacesRequest.safeParse(await req.json().catch(() => null));
    if (!body.success) return json({ error: "bad_request" }, 400);

    const provider = placesProvider();
    if (!provider) return json({ error: "not_configured" }, 503);

    const env = serverEnv();
    const limited = await rateLimit(user.id, "places", env.PLACES_PER_MINUTE, env.PLACES_PER_DAY);
    if (limited) return limited;

    const { key, query } = placeKey(provider.id, body.data);
    const reply = (places: PlacesResponse["places"], cached: boolean) =>
      json({ places, provider: provider.id, attribution: provider.attribution, cached } satisfies PlacesResponse);

    const hit = await readPlaces(key);
    if (hit) return reply(hit, true);

    const places = body.data.mode === "search"
      ? await provider.search(body.data.q.trim(), body.data.near)
      : await provider.nearby(body.data.near, NEARBY_RADIUS_M);
    await writePlaces(key, provider.id, body.data.mode, query, places);
    console.info(`[places] ${body.data.mode} ${provider.id} n=${places.length} ms=${Date.now() - started}`);
    return reply(places, false);
  } catch (err) {
    // provider down / slow / bad answer: the sheet falls back to current location + the map
    console.error("[places] error:", err instanceof Error ? err.message : err);
    return json({ error: "unavailable" }, 503);
  }
}
