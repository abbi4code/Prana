import "server-only";
import { createHash } from "node:crypto";
import { ParsedLog } from "@/lib/nl/schema";
import { PROMPT_VERSION } from "@/lib/nl/prompt";
import { supabaseAdmin } from "../supabase-admin";

/** Shared across users (no user id stored). Model + prompt version are part of the key. */
export function cacheKey(normalized: string, model: string) {
  return createHash("sha256").update(`${PROMPT_VERSION}|${model}|${normalized}`).digest("hex");
}

export async function readCache(key: string): Promise<ParsedLog | null> {
  const { data, error } = await supabaseAdmin().from("parse_cache").select("result").eq("key", key).maybeSingle();
  if (error || !data) return null;
  const parsed = ParsedLog.safeParse(data.result); // re-validate: never trust stored data blindly
  if (!parsed.success) return null;
  // stats only, don't wait. Supabase queries are lazy: without .then() the request is never sent
  void supabaseAdmin().rpc("bump_parse_cache", { p_key: key }).then(({ error }) => error && console.warn("[parse] bump:", error.message));
  return parsed.data;
}

export async function writeCache(key: string, normalized: string, model: string, result: ParsedLog) {
  const { error } = await supabaseAdmin()
    .from("parse_cache")
    .upsert({ key, normalized_text: normalized, model, prompt_version: PROMPT_VERSION, result }, { onConflict: "key", ignoreDuplicates: true });
  if (error) console.error("[parse] cache write failed:", error.message);
}
