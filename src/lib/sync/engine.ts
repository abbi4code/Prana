"use client";

import { useAuth } from "../auth";
import { getSupabase } from "../supabase";
import { useStore, type SyncQueue } from "../store";
import {
  entryToRow, maxUpdated, mergeDocs, mergeEntries, mergeFoods, mergeWater, mergeWeights,
  type FoodRow, type LogRow, type MealRow, type WaterRow, type WeightRow,
} from "./rows";

const PAGE = 1000; // PostgREST max rows per request

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Debounced sync after local edits. */
export function scheduleSync(ms = 1500) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, ms);
}

/** Push local changes, then pull server changes. Safe to call often; runs one at a time. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = run().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncNow();
    }
  });
  return running;
}

async function run() {
  const supabase = getSupabase();
  const { user, status } = useAuth.getState();
  if (!supabase || !user || status !== "signedIn") return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    useAuth.setState({ sync: "offline" });
    return;
  }
  useAuth.setState({ sync: "syncing", syncError: null });

  try {
    await push(user.id);
    await pull();
    useAuth.setState({ sync: "idle", lastSyncedAt: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    useAuth.setState({ sync: navigator.onLine ? "error" : "offline", syncError: message });
  }
}

const check = <T extends { error: { message: string } | null }>(res: T) => {
  if (res.error) throw new Error(res.error.message);
  return res;
};

async function push(userId: string) {
  const supabase = getSupabase()!;
  const s = useStore.getState();
  const q = s.sync; // snapshot: edits made while pushing stay queued for the next run
  const now = new Date().toISOString();

  const entries = s.entries.filter((e) => q.dirtyEntries.includes(e.id));
  if (entries.length) check(await supabase.from("food_logs").upsert(entries.map((e) => entryToRow(e, userId))));
  if (q.deletedEntries.length)
    check(await supabase.from("food_logs").update({ deleted_at: now }).in("id", q.deletedEntries));

  const weights = s.weights.filter((w) => q.dirtyWeights.includes(w.date));
  if (weights.length)
    check(await supabase.from("weights").upsert(weights.map((w) => ({ user_id: userId, measured_on: w.date, kg: w.kg, deleted_at: null }))));
  if (q.deletedWeights.length)
    check(await supabase.from("weights").update({ deleted_at: now }).in("measured_on", q.deletedWeights));

  if (q.dirtyWater.length)
    check(await supabase.from("water").upsert(q.dirtyWater.map((d) => ({ user_id: userId, logged_on: d, glasses: s.water[d] ?? 0 }))));

  // user-created foods (whole food stored as jsonb)
  const foods = s.customFoods.filter((f) => q.dirtyFoods.includes(f.id));
  if (foods.length) check(await supabase.from("custom_foods").upsert(foods.map((f) => ({ id: f.id, user_id: userId, data: f, deleted_at: null }))));
  if (q.deletedFoods.length)
    check(await supabase.from("custom_foods").update({ deleted_at: now }).in("id", q.deletedFoods));

  const meals = s.savedMeals.filter((m) => q.dirtyMeals.includes(m.id));
  if (meals.length) check(await supabase.from("saved_meals").upsert(meals.map((m) => ({ id: m.id, user_id: userId, data: m, deleted_at: null }))));
  if (q.deletedMeals.length)
    check(await supabase.from("saved_meals").update({ deleted_at: now }).in("id", q.deletedMeals));

  if (q.goalsDirty)
    check(await supabase.from("user_goals").upsert({
      user_id: userId, daily_kcal: s.goals.kcal, protein_g: s.goals.p, carbs_g: s.goals.c, fat_g: s.goals.f, profile: s.profile,
    }));

  // clear only what this run pushed
  const minus = (list: string[], pushed: string[]) => list.filter((x) => !pushed.includes(x));
  useStore.setState((cur) => ({
    sync: {
      ...cur.sync,
      dirtyEntries: minus(cur.sync.dirtyEntries, entries.map((e) => e.id)),
      deletedEntries: minus(cur.sync.deletedEntries, q.deletedEntries),
      dirtyWeights: minus(cur.sync.dirtyWeights, weights.map((w) => w.date)),
      deletedWeights: minus(cur.sync.deletedWeights, q.deletedWeights),
      dirtyWater: minus(cur.sync.dirtyWater, q.dirtyWater),
      dirtyFoods: minus(cur.sync.dirtyFoods, foods.map((f) => f.id)),
      deletedFoods: minus(cur.sync.deletedFoods, q.deletedFoods),
      dirtyMeals: minus(cur.sync.dirtyMeals, meals.map((m) => m.id)),
      deletedMeals: minus(cur.sync.deletedMeals, q.deletedMeals),
      // if goals changed again mid-push, keep the flag
      goalsDirty: cur.goals === s.goals && cur.profile === s.profile ? false : cur.sync.goalsDirty,
    },
  }));
}

async function fetchSince<T>(table: string, since: string | null): Promise<T[]> {
  const supabase = getSupabase()!;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select("*").order("updated_at").range(from, from + PAGE - 1);
    if (since) q = q.gt("updated_at", since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

async function pull() {
  const supabase = getSupabase()!;
  const since = useStore.getState().sync.lastPulledAt;
  const [logs, weights, water, foods, meals, goalsRes] = await Promise.all([
    fetchSince<LogRow>("food_logs", since),
    fetchSince<WeightRow>("weights", since),
    fetchSince<WaterRow>("water", since),
    fetchSince<FoodRow>("custom_foods", since),
    fetchSince<MealRow>("saved_meals", since),
    supabase.from("user_goals").select("*").maybeSingle(),
  ]);
  if (goalsRes.error) throw new Error(goalsRes.error.message);
  const g = goalsRes.data;

  useStore.setState((s) => {
    const q: SyncQueue = s.sync;
    const next: Partial<typeof s> = {
      entries: mergeEntries(s.entries, logs, new Set([...q.dirtyEntries, ...q.deletedEntries])),
      weights: mergeWeights(s.weights, weights, new Set([...q.dirtyWeights, ...q.deletedWeights])),
      water: mergeWater(s.water, water, new Set(q.dirtyWater)),
      customFoods: mergeFoods(s.customFoods, foods, new Set([...q.dirtyFoods, ...q.deletedFoods])),
      savedMeals: mergeDocs(s.savedMeals, meals, new Set([...q.dirtyMeals, ...q.deletedMeals])),
      sync: { ...q, lastPulledAt: maxUpdated(q.lastPulledAt, logs, weights, water, foods, meals) },
    };
    if (g && !q.goalsDirty) {
      next.goals = { kcal: g.daily_kcal, p: g.protein_g, c: g.carbs_g, f: g.fat_g };
      next.profile = g.profile ?? s.profile;
    }
    return next;
  });
}
