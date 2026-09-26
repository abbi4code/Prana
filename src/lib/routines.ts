// Routines (workouts.md "Routines"): a named list of exercises you repeat ("Chest day", "Push").
// A routine stores WHICH exercises, never numbers: each one repeats your last session of it (owner's "Option B"),
// so getting stronger never means editing the routine. Burn is computed like every other log (lib/burn.ts).
import { DEFAULT_REST, cardioBurn, type Person } from "./burn";
import { GROUP_LABEL, exerciseBurn, getActivity, getExercise, kgStep } from "./exercises";
import { cardioValues, liftValues } from "./nl/workoutDraft";
import type { ParsedWorkout } from "./nl/schema";
import type { Activity, Exercise, Routine, RoutineItem, WorkSet, Workout } from "./types";
import { lastTime } from "./useWorkouts";

const L = (refId: string): RoutineItem => ({ kind: "lift", refId });
const C = (refId: string): RoutineItem => ({ kind: "cardio", refId });

/** Built-in starters (common Push / Pull / Legs split + a full-body day), from the library's most-used exercises. */
export const STARTERS: { key: string; name: string; blurb: string; items: RoutineItem[] }[] = [
  {
    key: "push", name: "Push", blurb: "Chest, shoulders, triceps",
    items: [L("barbell-bench-press"), L("incline-dumbbell-press"), L("dumbbell-shoulder-press"), L("dumbbell-lateral-raise"), L("rope-pushdown")],
  },
  {
    key: "pull", name: "Pull", blurb: "Back, rear delts, biceps",
    items: [L("lat-pulldown"), L("seated-cable-row"), L("one-arm-dumbbell-row"), L("reverse-pec-deck"), L("barbell-curl"), L("hammer-curl")],
  },
  {
    key: "legs", name: "Legs", blurb: "Quads, hamstrings, glutes, calves",
    items: [L("barbell-back-squat"), L("leg-press"), L("romanian-deadlift"), L("leg-extension"), L("lying-leg-curl"), L("standing-calf-raise")],
  },
  {
    key: "full", name: "Full body", blurb: "Everything once, plus a walk",
    items: [L("barbell-back-squat"), L("dumbbell-bench-press"), L("lat-pulldown"), L("dumbbell-shoulder-press"), L("plank"), C("treadmill-walk")],
  },
];

export const newRoutineId = () => `routine-${crypto.randomUUID()}`;

/**
 * Progressive-overload suggestion. ACSM's position stand (Ratamess et al. 2009) advises a 2–10 % load increase once
 * the current load is completed with reps to spare on two consecutive sessions. We don't know your target reps, so
 * "completed" = every set at the same weight reached the first set's reps (no drop-off), in your last two sessions.
 * The step is the app's kg step (2.5 kg bars/machines, 1 kg dumbbells). Bodyweight moves get +1 rep instead.
 * Only ever a suggestion: nothing changes until you tap it.
 */
export type Hint = { kind: "kg" | "reps"; from: number; to: number };

export function overloadHint(ex: Exercise, workouts: Workout[], date: string): Hint | null {
  if (ex.load === "timed" || ex.load === "assisted") return null;
  const hist = workouts
    .filter((w) => w.refId === ex.id && w.date <= date && w.sets?.length)
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date < a.date ? -1 : 1));
  const [a, b] = hist;
  if (!a || !b) return null;
  const complete = (w: Workout) => {
    const s = w.sets!;
    if (s.length < 2 || s.some((x) => x.secs != null)) return null;
    return s.every((x) => x.kg === s[0].kg && x.reps >= s[0].reps) ? { kg: s[0].kg, reps: s[0].reps } : null;
  };
  const ca = complete(a), cb = complete(b);
  if (!ca || !cb || ca.kg !== cb.kg || ca.reps < cb.reps) return null;
  if (ca.kg > 0) return { kind: "kg", from: ca.kg, to: Math.round((ca.kg + kgStep(ex.equip)) * 10) / 10 };
  if (ex.load === "bodyweight") return { kind: "reps", from: ca.reps, to: ca.reps + 1 };
  return null;
}

export const applyHint = (sets: WorkSet[], h: Hint): WorkSet[] =>
  sets.map((s) => (h.kind === "kg" ? { ...s, kg: h.to } : { ...s, reps: h.to }));

export type CardioVals = { minutes: number; speedKmh?: number; inclinePct?: number; optionCode?: string };
export type Draft =
  | { kind: "lift"; item: RoutineItem; ex: Exercise; sets: WorkSet[]; rest: number; last?: Workout; hint: Hint | null }
  | { kind: "cardio"; item: RoutineItem; a: Activity; vals: CardioVals; last?: Workout };

const NOTHING_SAID: ParsedWorkout = { name: "", sets: null, reps: null, weight_kg: null, minutes: null, distance_km: null, speed_kmh: null };

/** What an item logs today: your last session of it (exact sets), else the logger's defaults. */
export function draftFor(item: RoutineItem, workouts: Workout[], date: string): Draft | null {
  if (item.kind === "lift") {
    const ex = getExercise(item.refId);
    if (!ex) return null;
    const last = lastTime(workouts, ex.id, date);
    const sets = last?.sets?.length ? last.sets.map((s) => ({ ...s })) : liftValues(ex, NOTHING_SAID).sets;
    return { kind: "lift", item, ex, sets, rest: last?.restSec ?? DEFAULT_REST, last, hint: overloadHint(ex, workouts, date) };
  }
  const a = getActivity(item.refId);
  if (!a) return null;
  const last = lastTime(workouts, a.id, date);
  const { note: _note, ...vals } = cardioValues(a, NOTHING_SAID, last);
  void _note;
  return { kind: "cardio", item, a, vals, last };
}

/** The workout to store for a draft: burn computed for this person, snapshotted like every log (D05). */
export function draftWorkout(d: Draft, p: Person, date: string, routineId: string): Omit<Workout, "id" | "createdAt"> {
  if (d.kind === "lift") {
    const est = exerciseBurn(d.ex, d.sets, d.rest, false, p);
    return {
      date, kind: "lift", refId: d.ex.id, name: d.ex.name, sets: d.sets.map((s) => ({ ...s })), restSec: d.rest, intense: false,
      minutes: est.minutes, met: est.met, kcal: est.kcal, ...(est.burn ? { burn: est.burn } : {}), routineId,
    };
  }
  const est = cardioBurn(d.a, d.vals, p);
  return { date, kind: "cardio", refId: d.a.id, name: d.a.name, ...d.vals, met: est.met, kcal: est.kcal, routineId };
}

export function draftBurn(d: Draft, p: Person) {
  if (d.kind === "lift") {
    const est = exerciseBurn(d.ex, d.sets, d.rest, false, p);
    return { kcal: est.kcal, minutes: est.minutes };
  }
  return { kcal: cardioBurn(d.a, d.vals, p).kcal, minutes: d.vals.minutes };
}

/** "Chest · Shoulders · Triceps · Cardio" */
export function routineGroups(items: RoutineItem[]) {
  const out = new Set<string>();
  for (const it of items) {
    if (it.kind === "cardio") out.add("Cardio");
    else {
      const ex = getExercise(it.refId);
      if (ex) out.add(GROUP_LABEL[ex.group]);
    }
  }
  return [...out];
}

export const itemName = (it: RoutineItem) => (it.kind === "lift" ? getExercise(it.refId)?.name : getActivity(it.refId)?.name) ?? it.refId;

/** Last day this routine was logged (any of its exercises), or null. */
export function lastDone(r: Routine, workouts: Workout[]): string | null {
  let best: string | null = null;
  for (const w of workouts) if (w.routineId === r.id && (!best || w.date > best)) best = w.date;
  return best;
}

/** Items that are the same exercise list as a day's session, in the order they were logged. */
export function itemsFromSession(day: Workout[]): RoutineItem[] {
  const seen = new Set<string>();
  const out: RoutineItem[] = [];
  for (const w of [...day].sort((a, b) => a.createdAt - b.createdAt)) {
    if (seen.has(w.refId)) continue;
    seen.add(w.refId);
    out.push({ kind: w.kind, refId: w.refId });
  }
  return out;
}

/** "3 × 10 · 60 kg", "10 · 10 · 8 · 60 kg", "3 × 30 s", "20 min · 5.5 km/h" */
export function draftSummary(d: Draft) {
  if (d.kind === "cardio") return [`${Math.round(d.vals.minutes)} min`, d.vals.speedKmh ? `${d.vals.speedKmh} km/h` : null].filter(Boolean).join(" · ");
  const s = d.sets;
  if (!s.length) return "";
  if (s[0].secs != null) return `${s.length} × ${s[0].secs} s`;
  const sameReps = s.every((x) => x.reps === s[0].reps);
  const sameKg = s.every((x) => x.kg === s[0].kg);
  const reps = sameReps ? `${s.length} × ${s[0].reps}` : s.map((x) => x.reps).join(" · ");
  const bw = d.ex.load === "bodyweight" || d.ex.load === "assisted";
  if (!sameKg) return s.map((x) => `${x.kg}×${x.reps}`).join(" · ");
  if (!s[0].kg && bw) return `${reps} reps`;
  return `${reps} · ${s[0].kg} kg${d.ex.rep?.perSide ? " each" : ""}`;
}
