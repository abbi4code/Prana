// POST /api/food/parse: sentence → { day, meal, items[{ name, qty, unit }], workouts[{ name, sets, reps, … }] }
// for the confirm card (food + workouts in one call).
// Signed-in users only. Never returns nutrition numbers and never writes food logs (nl-logging.md).
import { APIError } from "openai";
import { ParseRequest, normalizeInput, type ParseResponse } from "@/lib/nl/schema";
import { requestUser } from "@/server/auth";
import { serverEnv } from "@/server/env";
import { cacheKey, readCache, writeCache } from "@/server/nl/cache";
import { ParseFailed, parseWithLlm } from "@/server/nl/llm";
import { consumeParseQuota } from "@/server/nl/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const user = await requestUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = ParseRequest.safeParse(await req.json().catch(() => null));
    if (!body.success) return json({ error: "bad_request" }, 400);

    const quota = await consumeParseQuota(user.id);
    if (!quota.allowed)
      return json({ error: "rate_limited", retryAfterS: quota.retryAfterS }, 429, { "Retry-After": String(quota.retryAfterS) });

    const model = serverEnv().NL_MODEL;
    const normalized = normalizeInput(body.data.text);
    const key = cacheKey(normalized, model);

    const hit = await readCache(key);
    if (hit) return json({ ...hit, cached: true } satisfies ParseResponse);

    const parsed = await parseWithLlm(normalized);
    if (parsed.items.length || parsed.workouts.length) await writeCache(key, normalized, model, parsed);
    console.info(`[parse] ok items=${parsed.items.length} workouts=${parsed.workouts.length} ms=${Date.now() - started}`);
    return json({ ...parsed, cached: false } satisfies ParseResponse);
  } catch (err) {
    // every failure tells the client to fall back to plain search; no internals leak
    if (err instanceof ParseFailed) return json({ error: "parse_failed", fallback: true }, 422);
    if (err instanceof APIError) {
      console.error(`[parse] openai ${err.status}: ${err.message}`);
      return json({ error: "ai_unavailable", fallback: true }, 503);
    }
    console.error("[parse] error:", err instanceof Error ? err.message : err);
    return json({ error: "server_error", fallback: true }, 500);
  }
}
