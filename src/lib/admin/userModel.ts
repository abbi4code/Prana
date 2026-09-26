// One member's data for the admin panel (D51), turned into the app's own shapes so the same rules apply as on their
// phone: streaks (lib/streaks.ts), PRs (lib/records.ts), day status (D24). History is judged against the current goal,
// exactly like the member's own Progress screen.
import { dayKey } from "../dates";
import { MIN_VISIT_MINUTES } from "../gym/config";
import { computeRecords, type Records } from "../records";
import { computeStreaks, globalDay, runStreak, workoutDay, type RunResult, type StreakResult } from "../streaks";
import { mergeDocs, rowToEntry, rowToFitness, rowToGym, rowToVisit } from "../sync/rows";
import type { Entry, Fitness, Food, Goals, Gym, GymVisit, Measurement, Routine, SavedMeal, Workout } from "../types";
import { refInfo } from "../useRecords";
import { isRestDay } from "../useWorkouts";
import type { AdminUserBundle } from "./types";

/** The app's default goal (DEFAULT_GOALS in lib/nutrition.ts) for members who never saved one. */
const DEFAULT_GOALS: Goals = { kcal: 2000, p: 90, c: 250, f: 65 };
const DEFAULT_FITNESS: Fitness = { burnGoal: null, restDays: [0] };

export type Visit = GymVisit & { minutes: number | null; counted: boolean; day: string };

export type UserModel = {
  today: string;
  entries: Entry[];
  workouts: Workout[];
  weights: { date: string; kg: number }[];
  water: Map<string, number>;
  goals: Goals;
  customGoal: boolean;
  fitness: Fitness;
  kcalByDay: Map<string, number>;
  burnByDay: Map<string, number>;
  visits: Visit[];
  visitDays: Set<string>;
  gyms: (Gym & { retired: boolean })[];
  customFoods: Food[];
  meals: SavedMeal[];
  routines: Routine[];
  measurements: Measurement[];
  food: StreakResult;
  workout: (RunResult & { status: Map<string, "hit" | "miss" | "rest"> }) | null;
  global: RunResult | null;
  records: Records;
  /** every day with anything on it, newest first */
  activeDays: string[];
  firstDay: string | null;
};

export function buildUserModel(b: AdminUserBundle): UserModel {
  const today = dayKey();
  const entries = b.logs.map(rowToEntry).sort((a, z) => a.createdAt - z.createdAt);
  const workouts = mergeDocs<Workout>([], b.workouts, new Set()).sort((a, z) => (a.date === z.date ? a.createdAt - z.createdAt : a.date < z.date ? -1 : 1));
  const weights = b.weights.map((w) => ({ date: w.measured_on, kg: Number(w.kg) })).sort((a, z) => a.date.localeCompare(z.date));
  const water = new Map(b.water.filter((w) => w.glasses > 0).map((w) => [w.logged_on, w.glasses]));
  const goals = b.goals ? { kcal: b.goals.daily_kcal, p: b.goals.protein_g, c: b.goals.carbs_g, f: b.goals.fat_g } : DEFAULT_GOALS;
  const fitness = rowToFitness(b.goals?.fitness ?? null, DEFAULT_FITNESS);

  const kcalByDay = new Map<string, number>();
  for (const e of entries) kcalByDay.set(e.date, (kcalByDay.get(e.date) ?? 0) + e.kcal);
  const burnByDay = new Map<string, number>();
  for (const w of workouts) burnByDay.set(w.date, (burnByDay.get(w.date) ?? 0) + w.kcal);

  // visits: the local day they started, and whether they count (20+ min, D30)
  const visits: Visit[] = b.visits.map((r) => {
    const v = rowToVisit(r);
    const minutes = v.endedAt ? Math.round((Date.parse(v.endedAt) - Date.parse(v.startedAt)) / 60000) : null;
    return { ...v, minutes, counted: minutes != null && minutes >= MIN_VISIT_MINUTES, day: dayKey(new Date(v.startedAt)) };
  });
  const visitDays = new Set(visits.filter((v) => v.counted).map((v) => v.day));

  const food = computeStreaks(kcalByDay, goals.kcal, today);
  const firstFit = [...burnByDay.keys(), ...visitDays].filter((d) => d <= today).sort()[0] ?? null;
  let workout: UserModel["workout"] = null;
  let global: RunResult | null = null;
  if (firstFit) {
    const judge = (d: string) => workoutDay(burnByDay.has(d), burnByDay.get(d) ?? 0, fitness.burnGoal, isRestDay(fitness.restDays, d), visitDays.has(d));
    const status = new Map<string, "hit" | "miss" | "rest">();
    workout = { ...runStreak(firstFit, today, (d) => { const j = judge(d); status.set(d, j); return j; }), status };
    global = runStreak(firstFit, today, (d) => globalDay(food.status.get(d) ?? "none", judge(d)));
  }

  const days = new Set<string>([...kcalByDay.keys(), ...burnByDay.keys(), ...visits.map((v) => v.day), ...water.keys(), ...weights.map((w) => w.date)]);
  const activeDays = [...days].filter((d) => d <= today).sort().reverse();

  return {
    today, entries, workouts, weights, water, goals, customGoal: !!b.goals, fitness, kcalByDay, burnByDay, visits, visitDays,
    gyms: b.gyms.map((r) => ({ ...rowToGym(r), retired: !!r.deleted_at })).sort((a, z) => z.createdAt - a.createdAt),
    customFoods: mergeDocs<Food>([], b.customFoods, new Set()),
    meals: mergeDocs<SavedMeal>([], b.meals, new Set()),
    routines: mergeDocs<Routine>([], b.routines, new Set()),
    measurements: mergeDocs<Measurement>([], b.measurements, new Set()).sort((a, z) => a.date.localeCompare(z.date)),
    food, workout, global,
    records: computeRecords(workouts, refInfo),
    activeDays,
    firstDay: activeDays.at(-1) ?? null,
  };
}
