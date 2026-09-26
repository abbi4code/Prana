// Weekly sets per muscle (D41, .claude/workouts.md "Muscles this week"). PURE: types-only import, testable with Node.
//
// Counting ("fractional sets"): every set counts 1 for the muscles an exercise targets and 0.5 for the muscles that
// assist it. Pelland et al., Sports Med 2025 (meta-regression, 67 studies) found this predicts growth better than
// counting only direct sets or counting assisting sets in full.
// Bands: Schoenfeld, Ogborn & Krieger, J Sports Sci 2017;35(11):1073–82 compared < 5, 5–9 and 10+ weekly sets per
// muscle, with a graded dose-response (more sets, more growth). The app shows those three bands; 10+ is the top one.

import type { Exercise, Workout } from "./types";

export const MUSCLES = [
  "chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "traps", "lats", "middle back", "lower back",
  "glutes", "quadriceps", "hamstrings", "adductors", "abductors", "calves",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const DIRECT = 1;
export const INDIRECT = 0.5;
/** Schoenfeld 2017's cut points: < 5, 5–9, 10+ weekly sets. */
export const BAND_LOW = 5;
export const BAND_HIGH = 10;

const isMuscle = (m: string): m is Muscle => (MUSCLES as readonly string[]).includes(m);

/** Exercises without muscle data (a few extras) fall back to their sub-group or group. */
const FALLBACK: Record<string, Muscle | undefined> = {
  quads: "quadriceps", chest: "chest", shoulders: "shoulders", biceps: "biceps", triceps: "triceps", forearms: "forearms",
  abs: "abdominals", back: "lats", legs: "quadriceps",
};

export type MuscleInfo = Pick<Exercise, "muscles" | "also" | "sub" | "group">;

/** Targeted + assisting muscles of one exercise, normalised to the 16 names the body map draws. */
export function musclesOf(ex: MuscleInfo): { direct: Muscle[]; indirect: Muscle[] } {
  let direct = ex.muscles.filter(isMuscle);
  if (!direct.length) {
    const f = (ex.sub && (isMuscle(ex.sub) ? ex.sub : FALLBACK[ex.sub])) || FALLBACK[ex.group];
    direct = f ? [f] : [];
  }
  const indirect = ex.also.filter(isMuscle).filter((m) => !direct.includes(m));
  return { direct, indirect };
}

/** Sets per muscle over `from`..`to` (YYYY-MM-DD, inclusive). Lifts only; cardio isn't counted. */
export function weeklySets(workouts: Pick<Workout, "date" | "kind" | "refId" | "sets">[], from: string, to: string, lookup: (refId: string) => MuscleInfo | undefined) {
  const out = new Map<Muscle, number>();
  for (const w of workouts) {
    if (w.kind !== "lift" || w.date < from || w.date > to) continue;
    const ex = lookup(w.refId);
    const n = w.sets?.length ?? 0;
    if (!ex || !n) continue;
    const { direct, indirect } = musclesOf(ex);
    for (const m of direct) out.set(m, (out.get(m) ?? 0) + n * DIRECT);
    for (const m of indirect) out.set(m, (out.get(m) ?? 0) + n * INDIRECT);
  }
  return out;
}

/** 0 = not trained, 1 = under 5 sets, 2 = 5–9, 3 = 10+. */
export function band(sets: number): 0 | 1 | 2 | 3 {
  if (sets <= 0) return 0;
  if (sets < BAND_LOW) return 1;
  if (sets < BAND_HIGH) return 2;
  return 3;
}
