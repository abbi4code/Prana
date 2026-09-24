// Row mapping + merge rules between the local store and Supabase tables.
// Pure functions (no imports with side effects) so they can be tested in isolation.
import type { Entry, Food, WeightLog } from "../types";

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
};
export type WeightRow = { user_id?: string; measured_on: string; kg: number; updated_at?: string; deleted_at: string | null };
export type WaterRow = { user_id?: string; logged_on: string; glasses: number; updated_at?: string };
export type FoodRow = { id: string; user_id?: string; data: Food; updated_at?: string; deleted_at: string | null };

const num = (v: unknown) => (v == null ? null : Number(v));

export const entryToRow = (e: Entry, userId: string): LogRow => ({
  id: e.id, user_id: userId, logged_on: e.date, meal: e.meal, food_id: e.foodId, name: e.name,
  unit_id: e.unitId, unit_label: e.unitLabel, qty: e.qty, grams: e.grams, kcal: e.kcal,
  protein_g: e.p, carbs_g: e.c, fat_g: e.f, created_at: new Date(e.createdAt).toISOString(), deleted_at: null,
});

export const rowToEntry = (r: LogRow): Entry => ({
  id: r.id, date: r.logged_on, meal: r.meal, foodId: r.food_id, name: r.name, unitId: r.unit_id,
  unitLabel: r.unit_label, qty: Number(r.qty), grams: Number(r.grams), kcal: Number(r.kcal),
  p: num(r.protein_g), c: num(r.carbs_g), f: num(r.fat_g), createdAt: Date.parse(r.created_at),
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

export function mergeFoods(local: Food[], rows: FoodRow[], skip: Set<string>): Food[] {
  const byId = new Map(local.map((f) => [f.id, f]));
  for (const r of rows) {
    if (skip.has(r.id)) continue;
    if (r.deleted_at) byId.delete(r.id);
    else byId.set(r.id, r.data);
  }
  return [...byId.values()];
}

/** Latest server timestamp seen, used as the next pull's lower bound. */
export function maxUpdated(current: string | null, ...lists: { updated_at?: string }[][]) {
  let max = current;
  for (const list of lists) for (const r of list) if (r.updated_at && (!max || r.updated_at > max)) max = r.updated_at;
  return max;
}
