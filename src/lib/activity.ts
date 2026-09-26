// Weekly activity against the WHO 2020 guidelines (decision D33, .claude/workouts.md "Activity rings").
// Pure: types-only import, so it can be tested with Node.
//
// WHO guidelines on physical activity and sedentary behaviour, 2020 (Bull et al., Br J Sports Med 2020;54:1451–62),
// adults 18–64:
//   - 150–300 min of moderate-intensity, or 75–150 min of vigorous-intensity aerobic activity, or an equivalent
//     combination, per week → 1 vigorous minute = 2 moderate minutes. We use the lower bound, 150.
//   - muscle-strengthening activities involving all major muscle groups on 2 or more days a week.
// Intensity bands are the standard ones the same guidelines use: moderate 3–<6 METs, vigorous ≥ 6 METs.

import type { Workout } from "./types";

export const WHO_MOVE_MINUTES = 150;
export const WHO_STRENGTH_DAYS = 2;
export const MODERATE_MET = 3;
export const VIGOROUS_MET = 6;

/**
 * Moderate-equivalent aerobic minutes of one entry. Only cardio counts (lifting is the strength side of the
 * guideline); vigorous minutes count double; light activity (< 3 METs, e.g. gentle yoga) doesn't count.
 */
export function moveMinutes(w: Pick<Workout, "kind" | "met" | "minutes">): number {
  if (w.kind !== "cardio") return 0;
  if (w.met >= VIGOROUS_MET) return w.minutes * 2;
  if (w.met >= MODERATE_MET) return w.minutes;
  return 0;
}

/** One week (`from`..`to`, YYYY-MM-DD inclusive): moderate-equivalent minutes and days with any lifting. */
export function weekActivity(workouts: Pick<Workout, "date" | "kind" | "met" | "minutes">[], from: string, to: string) {
  let move = 0;
  const liftDays = new Set<string>();
  for (const w of workouts) {
    if (w.date < from || w.date > to) continue;
    move += moveMinutes(w);
    if (w.kind === "lift") liftDays.add(w.date);
  }
  return { move: Math.round(move), strengthDays: liftDays.size };
}
