import data from "@/data/exercises.generated.json";
import { liftBurn, repBurn, type Person } from "./burn";
import { buildWorkoutMatcher, type WorkoutCandidate } from "./nl/workoutMatch";
import type { Activity, Exercise, MuscleGroup, RepGroup, Workout } from "./types";

export { defaultKg } from "./nl/workoutDraft";

export const EXERCISES = data.exercises as Exercise[];
export const ACTIVITIES = data.activities as Activity[];
/** Measured per-rep costs by movement (lifting burn v2), keyed by Exercise.rep.g */
export const REP_GROUPS = data.repGroups as Record<string, RepGroup>;
const EX_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
const ACT_BY_ID = new Map(ACTIVITIES.map((a) => [a.id, a]));

export const getExercise = (id: string) => EX_BY_ID.get(id);
export const getActivity = (id: string) => ACT_BY_ID.get(id);

// natural-language logging (nl-logging.md): typo-tolerant exercise/activity matching, built on first use
let wMatcher: ReturnType<typeof buildWorkoutMatcher> | null = null;
/** Best exercises/activities for a spoken or typed name; `history` = refIds the user logs (they win ties). */
export function matchWorkout(name: string, limit = 3, history?: ReadonlySet<string>): WorkoutCandidate[] {
  wMatcher ??= buildWorkoutMatcher(EXERCISES, ACTIVITIES);
  const cands = wMatcher.match(name, limit + 3);
  if (history?.size) for (const c of cands) if (history.has(c.item.id)) c.score = Math.min(1, c.score + 0.04);
  return cands.sort((a, b) => b.score - a.score).slice(0, limit);
}

export const GROUPS: { id: MuscleGroup; label: string; subs?: string[] }[] = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back", subs: ["lats", "middle back", "lower back", "traps"] },
  { id: "shoulders", label: "Shoulders" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms", label: "Forearms" },
  { id: "abs", label: "Abs" },
  { id: "legs", label: "Legs", subs: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"] },
  { id: "full", label: "Full body" },
];
export const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.id, g.label])) as Record<MuscleGroup, string>;

const MUSCLE: Record<string, string> = {
  abdominals: "Abs", quadriceps: "Quads", "middle back": "Mid back", "lower back": "Lower back", lats: "Lats",
  hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", adductors: "Inner thigh", abductors: "Outer thigh",
  traps: "Traps", chest: "Chest", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", quads: "Quads",
};
export const muscleLabel = (m: string) => MUSCLE[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

export const EQUIPMENT: { id: string; label: string }[] = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "machine", label: "Machine" },
  { id: "cable", label: "Cable" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "smith machine", label: "Smith" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "ez bar", label: "EZ bar" },
  { id: "bands", label: "Bands" },
];
const EQUIP_LABEL: Record<string, string> = { ...Object.fromEntries(EQUIPMENT.map((e) => [e.id, e.label])), plate: "Plate", "trap bar": "Trap bar", other: "Other" };
export const equipLabel = (id: string) => EQUIP_LABEL[id] ?? id;

/** kg stepper size: plates go up in 2.5 kg, dumbbells/kettlebells in 1 kg (Indian gyms stock 1–2 kg steps). */
export const kgStep = (equip: string) => (equip === "dumbbell" || equip === "kettlebell" || equip === "bands" ? 1 : 2.5);

export const photoUrl = (id: string, frame = 0) => `/exercises/${id}-${frame}.webp`;

/** How-to steps (free-exercise-db), split out of the catalog and loaded on demand. */
export async function loadSteps(id: string): Promise<string[]> {
  const steps = (await import("@/data/exercise-steps.generated.json")).default as Record<string, string[]>;
  return steps[id] ?? [];
}

// search: same idea as food search (lib/foods.ts), every token must match a name or alias
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
type Indexed<T> = { item: T; name: string; alt: string[]; compact: string };
const index = <T extends { name: string; aliases: string[]; id: string }>(item: T): Indexed<T> => {
  const name = norm(item.name);
  const alt = [...item.aliases.map(norm), norm(item.id)];
  return { item, name, alt, compact: [name, ...alt].join(" ").replace(/ /g, "") };
};
const EX_INDEX = EXERCISES.map(index);
const ACT_INDEX = ACTIVITIES.map(index);

function score<T>(it: Indexed<T>, tokens: string[], q: string) {
  let s = 0;
  for (const t of tokens) {
    const ts = it.name.startsWith(t) ? 100
      : it.name.split(" ").some((w) => w.startsWith(t)) ? 80
      : it.alt.some((a) => a.startsWith(t) || a.split(" ").some((w) => w.startsWith(t))) ? 65
      : it.compact.includes(t) ? 35 : 0;
    if (!ts) return 0;
    s += ts;
  }
  if (it.alt.includes(q) || it.name === q) s += 40; // "bench" → Barbell Bench Press first
  return s - it.name.length * 0.1;
}

export type ExerciseFilter = { group: MuscleGroup | null; sub: string | null; equip: string | null };

/** Library list: filtered, searched, most common first. */
export function findExercises(query: string, f: ExerciseFilter): Exercise[] {
  const q = norm(query);
  const tokens = q ? q.split(" ") : [];
  const out: { e: Exercise; s: number }[] = [];
  for (const it of EX_INDEX) {
    const e = it.item;
    if (f.group && e.group !== f.group) continue;
    if (f.sub && e.sub !== f.sub) continue;
    if (f.equip && e.equip !== f.equip) continue;
    const s = tokens.length ? score(it, tokens, q) : 1;
    if (s) out.push({ e, s: s + e.pop * 12 });
  }
  return out.sort((a, b) => b.s - a.s).map((x) => x.e);
}

export function findActivities(query: string): Activity[] {
  const q = norm(query);
  if (!q) return ACTIVITIES;
  const tokens = q.split(" ");
  return ACT_INDEX.map((it) => ({ a: it.item, s: score(it, tokens, q) }))
    .filter((x) => x.s)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.a);
}

export type WorkoutHit = { kind: "lift"; item: Exercise } | { kind: "cardio"; item: Activity };

/** Exercises + cardio in one ranked list (the "Add anything" sheet); same scoring as the two lists above. */
export function searchWorkouts(query: string, limit = 6): WorkoutHit[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const hits: (WorkoutHit & { s: number })[] = [];
  for (const it of EX_INDEX) {
    const s = score(it, tokens, q);
    if (s) hits.push({ kind: "lift", item: it.item, s: s + it.item.pop * 12 });
  }
  for (const it of ACT_INDEX) {
    const s = score(it, tokens, q);
    if (s) hits.push({ kind: "cardio", item: it.item, s: s + 6 }); // one activity per sport: nudge it above look-alike lifts
  }
  return hits.sort((a, b) => b.s - a.s).slice(0, limit).map((h) => (h.kind === "lift" ? { kind: h.kind, item: h.item } : { kind: h.kind, item: h.item }));
}

/** "50 kg × 8 · 8 · 7" when the weight is the same every set, else "50×8 · 55×6". */
export function setsSummary(w: Pick<Workout, "sets">, ex?: Pick<Exercise, "load">) {
  const sets = w.sets ?? [];
  if (!sets.length) return "";
  if (sets[0].secs != null) return `${sets.length} × ${sets.map((s) => `${s.secs}s`).join(" · ")}`;
  const kgs = new Set(sets.map((s) => s.kg));
  const bw = ex?.load === "bodyweight" || ex?.load === "assisted";
  if (kgs.size === 1) {
    const kg = sets[0].kg;
    const reps = sets.map((s) => s.reps).join(" · ");
    if (!kg && bw) return `${reps} reps`;
    return `${fmtKg(kg)} kg × ${reps}`;
  }
  return sets.map((s) => `${fmtKg(s.kg)}×${s.reps}`).join(" · ");
}
const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1));

/**
 * Calories for logged sets: the measured per-rep model (v2) when the exercise maps to a measured movement,
 * otherwise time × MET. `burn` is stored on the workout so it's clear which model a log used.
 */
export function exerciseBurn(ex: Exercise, sets: Workout["sets"] & object, restSec: number, intense: boolean, p: Person) {
  if (ex.rep) return { ...repBurn(ex, REP_GROUPS[ex.rep.g], sets, restSec, p), burn: "rep" as const };
  return { ...liftBurn(ex, sets, restSec, intense, p), burn: undefined };
}
