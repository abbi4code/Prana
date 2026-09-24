// Workout-name matching for natural-language logging (nl-logging.md). PURE: types-only imports, so the
// eval script can run it with node. Same engine as foods (match.ts) over the exercise library + cardio.
import type { Activity, Exercise } from "../types";
import { buildMatcher, type Candidate } from "./match.ts";

export type WorkoutCandidate =
  | { kind: "lift"; item: Exercise; score: number }
  | { kind: "cardio"; item: Activity; score: number };

export function buildWorkoutMatcher(exercises: Exercise[], activities: Activity[]) {
  // common gym exercises win ties ("bench" → barbell bench press before exotic variants)
  const lifts = buildMatcher(exercises, { boost: (e) => e.pop * 0.01 });
  const cardio = buildMatcher(activities, { boost: () => 0.02 }); // "walk"/"run" mean cardio, not a lift
  return {
    match(name: string, limit = 4): WorkoutCandidate[] {
      const a = lifts.match(name, limit).map((c: Candidate<Exercise>) => ({ kind: "lift" as const, item: c.item, score: c.score }));
      const b = cardio.match(name, limit).map((c: Candidate<Activity>) => ({ kind: "cardio" as const, item: c.item, score: c.score }));
      return [...a, ...b].sort((x, y) => y.score - x.score).slice(0, limit);
    },
  };
}
