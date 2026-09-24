// Shapes for natural-language parsing (nl-logging.md). Shared by the server route, the client and the
// eval script, so it imports only `zod`. Two layers on purpose:
//   LlmOutput: what the model must return (strict JSON schema, no refinements the API can't enforce)
//   ParsedLog: what we accept after validation (bounds, cleanup). Never contains nutrition numbers.
import { z } from "zod";

export const MEAL_SLOTS = ["breakfast", "lunch", "snacks", "dinner"] as const;
export const PARSE_UNITS = [
  "piece", "katori", "bowl", "plate", "glass", "cup", "tbsp", "tsp", "scoop", "slice", "handful", "g", "ml", "serving",
] as const;

export const DAYS = ["today", "yesterday"] as const;

export const LlmOutput = z.object({
  day: z.enum(DAYS).nullable(),
  meal: z.enum(MEAL_SLOTS).nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number().nullable(),
      unit: z.enum(PARSE_UNITS).nullable(),
    }),
  ),
  workouts: z.array(
    z.object({
      name: z.string(),
      sets: z.number().nullable(),
      reps: z.number().nullable(),
      weight_kg: z.number().nullable(),
      minutes: z.number().nullable(),
      distance_km: z.number().nullable(),
      speed_kmh: z.number().nullable(),
    }),
  ),
});
export type LlmOutput = z.infer<typeof LlmOutput>;

export const ParsedItem = z.object({
  name: z.string().trim().toLowerCase().min(1).max(80),
  qty: z.number().positive().max(2000).nullable(), // grams can be large; counts are small
  unit: z.enum(PARSE_UNITS).nullable(),
});
// bounds reject nonsense ("900 sets") instead of silently logging it
const count = (max: number) => z.number().positive().max(max).nullable();
export const ParsedWorkout = z.object({
  name: z.string().trim().toLowerCase().min(1).max(80),
  sets: count(30),
  reps: count(500),
  weight_kg: z.number().min(0).max(500).nullable(),
  minutes: count(600),
  distance_km: count(200),
  speed_kmh: count(45),
});
export const ParsedLog = z.object({
  day: z.enum(DAYS).nullable(),
  meal: z.enum(MEAL_SLOTS).nullable(),
  items: z.array(ParsedItem).max(15),
  workouts: z.array(ParsedWorkout).max(15),
});
export type ParsedItem = z.infer<typeof ParsedItem>;
export type ParsedWorkout = z.infer<typeof ParsedWorkout>;
export type ParsedLog = z.infer<typeof ParsedLog>;

/** Request body of POST /api/food/parse. */
export const ParseRequest = z.object({ text: z.string().trim().min(1).max(300) });

/** Response of POST /api/food/parse (success). */
export const ParseResponse = ParsedLog.extend({ cached: z.boolean() });
export type ParseResponse = z.infer<typeof ParseResponse>;

/** Cache key text: lowercase, trimmed, single spaces, no trailing punctuation. */
export function normalizeInput(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[\s.!?,;]+$/, "").trim();
}
