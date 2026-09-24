import "server-only";
import OpenAI from "openai";
import { parseRequest } from "@/lib/nl/request";
import { ParsedLog } from "@/lib/nl/schema";
import { serverEnv } from "../env";

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: serverEnv().OPENAI_API_KEY, timeout: 12_000, maxRetries: 1 }));

export class ParseFailed extends Error {}

/**
 * Text → validated structure. The model returns strict-schema JSON (Structured Outputs); we then run
 * the stricter ParsedLog validation. One retry if the output is missing/invalid; then ParseFailed.
 * Network/API errors propagate (the route maps them to a fallback response).
 */
export async function parseWithLlm(text: string): Promise<ParsedLog> {
  const model = serverEnv().NL_MODEL;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await openai().responses.parse(parseRequest(text, model)); // same request the eval tests
    const checked = ParsedLog.safeParse(res.output_parsed);
    if (checked.success) return checked.data;
    console.warn(`[parse] invalid model output (attempt ${attempt})`);
  }
  throw new ParseFailed("model output failed validation twice");
}
