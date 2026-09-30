// Row mapping + merge rules between the local store and Supabase tables.
// Pure functions (no imports with side effects) so they can be tested in isolation.
import type { BpReading, Entry, Fitness, Food, Gym, GymVisit, HabitDay, HealthInfo, Measurement, Routine, SavedMeal, WeightLog, Workout } from "../types";
import { readGymPlace } from "../gym/places.ts";

export type LogRow = {
  id: string;
  user_id?: string;
  logged_on: string;
  meal: Entry["meal"];
  food_id: string;
  name: string;
  unit_id: string;
  unit_label: string;
  qty: number;
  grams: number;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
  updated_at?: string;
  deleted_at: string | null;
  source?: string | null;
  raw_input?: string | null;
};
export type WeightRow = { user_id?: string; measured_on: string; kg: number; updated_at?: string; deleted_at: string | null };
export type WaterRow = { user_id?: string; logged_on: string; glasses: number; updated_at?: string };
export type FoodRow = { id: string; user_id?: string; data: Food; updated_at?: string; deleted_at: string | null };
export type MealRow = { id: string; user_id?: string; data: SavedMeal; updated_at?: string; deleted_at: string | null };
export type WorkoutRow = { id: string; user_id?: string; data: Workout; updated_at?: string; deleted_at: string | null };
export type RoutineRow = { id: string; user_id?: string; data: Routine; updated_at?: string; deleted_at: string | null };
export type MeasurementRow = { id: string; user_id?: string; data: Measurement; updated_at?: string; deleted_at: string | null };
export type BpRow = { id: string; user_id?: string; data: BpReading; updated_at?: string; deleted_at: string | null };
export type HabitRow = { id: string; user_id?: string; data: HabitDay; updated_at?: string; deleted_at: string | null };

const num = (v: unknown) => (v == null ? null : Number(v));

export const entryToRow = (e: Entry, userId: string): LogRow => ({
  id: e.id, user_id: userId, logged_on: e.date, meal: e.meal, food_id: e.foodId, name: e.name,
  unit_id: e.unitId, unit_label: e.unitLabel, qty: e.qty, grams: e.grams, kcal: e.kcal,
  protein_g: e.p, carbs_g: e.c, fat_g: e.f, created_at: new Date(e.createdAt).toISOString(), deleted_at: null,
  source: e.source ?? null, raw_input: e.rawInput ?? null,
});

export const rowToEntry = (r: LogRow): Entry => ({
  id: r.id, date: r.logged_on, meal: r.meal, foodId: r.food_id, name: r.name, unitId: r.unit_id,
  unitLabel: r.unit_label, qty: Number(r.qty), grams: Number(r.grams), kcal: Number(r.kcal),
  p: num(r.protein_g), c: num(r.carbs_g), f: num(r.fat_g), createdAt: Date.parse(r.created_at),
  ...(r.source ? { source: r.source as Entry["source"] } : {}),
  ...(r.raw_input ? { rawInput: r.raw_input } : {}),
});

/**
 * Server rows win, except for items with unpushed local changes (`skip`):
 * those keep the local version and will overwrite the server on the next push.
 */
export function mergeEntries(local: Entry[], rows: LogRow[], skip: Set<string>): Entry[] {
  const byId = new Map(local.map((e) => [e.id, e]));
  for (const r of rows) {
    if (skip.has(r.id)) continue;
    if (r.deleted_at) byId.delete(r.id);
    else byId.set(r.id, rowToEntry(r));
  }
  return [...byId.values()];
}

export function mergeWeights(local: WeightLog[], rows: WeightRow[], skip: Set<string>): WeightLog[] {
  const byDate = new Map(local.map((w) => [w.date, w]));
  for (const r of rows) {
    if (skip.has(r.measured_on)) continue;
    if (r.deleted_at) byDate.delete(r.measured_on);
    else byDate.set(r.measured_on, { date: r.measured_on, kg: Number(r.kg) });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeWater(local: Record<string, number>, rows: WaterRow[], skip: Set<string>) {
  const out = { ...local };
  for (const r of rows) if (!skip.has(r.logged_on)) out[r.logged_on] = r.glasses;
  return out;
}

/** For jsonb tables (custom_foods, saved_meals): same rules as entries. */
export function mergeDocs<T extends { id: string }>(local: T[], rows: { id: string; data: T; deleted_at: string | null }[], skip: Set<string>): T[] {
  const byId = new Map(local.map((f) => [f.id, f]));
  for (const r of rows) {
    if (skip.has(r.id)) continue;
    if (r.deleted_at) byId.delete(r.id);
    else byId.set(r.id, r.data);
  }
  return [...byId.values()];
}
export const mergeFoods = (local: Food[], rows: FoodRow[], skip: Set<string>) => mergeDocs(local, rows, skip);

/** user_goals.fitness from the server; older rows have none. */
export function rowToFitness(v: unknown, fallback: Fitness): Fitness {
  if (!v || typeof v !== "object") return fallback;
  const f = v as Partial<Fitness>;
  return {
    burnGoal: typeof f.burnGoal === "number" && f.burnGoal > 0 ? f.burnGoal : null,
    restDays: Array.isArray(f.restDays) ? f.restDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : fallback.restDays,
  };
}

/** user_goals.health from the server (D55); older rows have none. Keeps only an object. */
export function rowToHealth(v: unknown, fallback: HealthInfo): HealthInfo {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as HealthInfo) : fallback;
}

/** Latest server timestamp seen, used as the next pull's lower bound. */
export function maxUpdated(current: string | null, ...lists: { updated_at?: string }[][]) {
  let max = current;
  for (const list of lists) for (const r of list) if (r.updated_at && (!max || r.updated_at > max)) max = r.updated_at;
  return max;
}

// ── Gym check-in (D30) ──
export type GymRow = {
  id: string; user_id?: string; name: string; lat: number | null; lng: number | null; radius_m: number;
  place?: unknown; created_at?: string; updated_at?: string; deleted_at: string | null;
};
export const gymToRow = (g: Gym, userId: string): GymRow => ({
  id: g.id, user_id: userId, name: g.name, lat: g.lat, lng: g.lng, radius_m: g.radiusM, place: g.place ?? null,
  created_at: new Date(g.createdAt).toISOString(), deleted_at: null,
});
export const rowToGym = (r: GymRow): Gym => ({
  id: r.id, name: r.name, lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng),
  radiusM: Number(r.radius_m), createdAt: r.created_at ? Date.parse(r.created_at) : 0, place: readGymPlace(r.place),
});
export function mergeGyms(local: Gym[], rows: GymRow[], skip: Set<string>): Gym[] {
  const byId = new Map(local.map((g) => [g.id, g]));
  for (const r of rows) {
    if (skip.has(r.id)) continue;
    if (r.deleted_at) byId.delete(r.id);
    else byId.set(r.id, rowToGym(r));
  }
  return [...byId.values()];
}

/** gym_visits row (server-written; the device only reads it). Also the shape the gym functions return. */
export type VisitRow = {
  id: string; user_id?: string; gym_id: string | null; started_at: string; ended_at: string | null;
  status: GymVisit["status"]; start_verification: GymVisit["startVerification"]; end_verification: GymVisit["endVerification"];
  source: GymVisit["source"]; updated_at?: string; deleted_at?: string | null;
};
export const rowToVisit = (r: VisitRow): GymVisit => ({
  id: r.id, gymId: r.gym_id, startedAt: new Date(r.started_at).toISOString(), endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
  status: r.status, startVerification: r.start_verification, endVerification: r.end_verification, source: r.source,
});
/** Server always wins for visits (the device never edits them). */
export function mergeVisits(local: GymVisit[], rows: VisitRow[]): GymVisit[] {
  const byId = new Map(local.map((v) => [v.id, v]));
  for (const r of rows) {
    if (r.deleted_at) byId.delete(r.id);
    else byId.set(r.id, rowToVisit(r));
  }
  return [...byId.values()];
}
