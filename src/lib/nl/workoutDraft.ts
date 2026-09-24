// Parsed workout → the values the workout logger uses (nl-logging.md). PURE (types-only imports).
// Priority for every number: what the user said → their last session of the same exercise → defaults.
// Burn is NOT computed here: lib/burn.ts does that from these values, exactly like the workout sheet.
import type { Activity, Exercise, WorkSet, Workout } from "../types";
import type { ParsedWorkout } from "./schema.ts";

/** Starting kg when nothing is known: 20 kg = empty Olympic bar; bodyweight/assisted/timed = 0. */
export const defaultKg = (ex: Pick<Exercise, "load" | "equip">) => (ex.load !== "external" ? 0 : ex.equip === "barbell" ? 20 : 10);

export type LiftValues = { sets: WorkSet[]; note?: string };
export type CardioValues = { minutes: number; speedKmh?: number; inclinePct?: number; optionCode?: string; note?: string };

export function liftValues(ex: Exercise, said: ParsedWorkout, last?: Workout): LiftValues {
  const prev = last?.sets ?? [];
  if (ex.load === "timed") {
    const secs = said.minutes ? Math.round(said.minutes * 60) : prev[0]?.secs ?? 30;
    const n = said.sets ?? (prev.length || 1);
    return { sets: Array.from({ length: n }, () => ({ reps: 1, kg: 0, secs })), ...(said.minutes ? {} : { note: "Hold time not said, set it below" }) };
  }
  const n = said.sets ?? (said.reps ? 1 : prev.length || 3);
  const reps = said.reps ?? prev[0]?.reps ?? 10;
  const kg = said.weight_kg ?? prev[0]?.kg ?? defaultKg(ex);
  const guessed = [said.sets == null && said.reps == null && "sets", said.reps == null && "reps", said.weight_kg == null && ex.load === "external" && "weight"].filter(Boolean);
  return {
    sets: Array.from({ length: n }, () => ({ reps, kg })),
    ...(guessed.length ? { note: `${guessed.join(", ")} not said: ${last ? "used last time's" : "using defaults"}` } : {}),
  };
}

export function cardioValues(a: Activity, said: ParsedWorkout, last?: Workout): CardioValues {
  const speedSaid = said.speed_kmh ?? (said.distance_km && said.minutes ? said.distance_km / (said.minutes / 60) : null);
  const minutes = said.minutes ?? (said.distance_km && speedSaid ? (said.distance_km / speedSaid) * 60 : null);
  const out: CardioValues = { minutes: Math.round(minutes ?? last?.minutes ?? 30) };
  if (a.model !== "met") {
    const fallback = a.start?.speed ?? (a.model === "run" ? 8 : 5);
    // a distance with no time: assume the usual pace and derive the minutes from it
    const speed = speedSaid ?? last?.speedKmh ?? fallback;
    if (minutes == null && said.distance_km) out.minutes = Math.round((said.distance_km / speed) * 60);
    out.speedKmh = Math.round(speed * 10) / 10;
    out.inclinePct = a.incline ? last?.inclinePct ?? a.start?.incline ?? 0 : 0;
  } else {
    out.optionCode = last?.optionCode ?? a.options[0]?.code;
  }
  if (minutes == null && !said.distance_km) out.note = `Time not said: ${last ? "used last time's" : "30 min assumed"}, adjust below`;
  return out;
}
