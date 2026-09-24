// The exact OpenAI request for parsing, shared by the server route and scripts/eval-parse.mts so the
// eval always tests what production sends. Imports only packages + sibling files (node can run it).
import { zodTextFormat } from "openai/helpers/zod";
import { SYSTEM_PROMPT } from "./prompt.ts";
import { LlmOutput } from "./schema.ts";

export const DEFAULT_MODEL = "gpt-6-luna";

export function parseRequest(text: string, model: string) {
  return {
    model,
    reasoning: { effort: "none" as const }, // plain extraction: fastest, cheapest
    store: false, // don't keep users' food text at OpenAI
    max_output_tokens: 600,
    instructions: SYSTEM_PROMPT,
    input: text,
    text: { format: zodTextFormat(LlmOutput, "food_log") },
  };
}
