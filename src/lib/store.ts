"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getFood, getUnit, setCustomFoods } from "./foods";
import { DEFAULT_GOALS, portion } from "./nutrition";
import type { Entry, Food, Goals, LogSource, Meal, Profile, SavedMeal, ThaliItem, WeightLog } from "./types";

/**
 * Local changes not yet pushed to Supabase (decision D14).
 * Every mutation below records what it touched; lib/sync.ts pushes and clears these.
 */
export type SyncQueue = {
  userId: string | null; // account the local data belongs to; null = guest data
  lastPulledAt: string | null; // server updated_at high-water mark
  dirtyEntries: string[];
  deletedEntries: string[];
  dirtyWeights: string[]; // dates
  deletedWeights: string[]; // dates
  dirtyWater: string[]; // dates
  dirtyFoods: string[]; // custom food ids
  deletedFoods: string[];
  dirtyMeals: string[]; // saved meal ids
  deletedMeals: string[];
  goalsDirty: boolean;
};

export const EMPTY_QUEUE: SyncQueue = {
  userId: null, lastPulledAt: null, dirtyEntries: [], deletedEntries: [],
  dirtyWeights: [], deletedWeights: [], dirtyWater: [], dirtyFoods: [], deletedFoods: [], dirtyMeals: [], deletedMeals: [], goalsDirty: false,
};

type Data = {
  entries: Entry[];
  goals: Goals;
  profile: Profile | null;
  weights: WeightLog[];
  water: Record<string, number>;
  /** user-created foods (same shape as catalog foods, conf "user") */
  customFoods: Food[];
  savedMeals: SavedMeal[];
  sync: SyncQueue;
  /** chose "use without account" on the login screen */
  guest: boolean;
};

type State = Data & {
  hydrated: boolean;
  addEntry: (foodId: string, unitId: string, qty: number, meal: Meal, date: string) => void;
  /** log several confirmed items at once (natural-language flow); returns the new entry ids */
  addEntries: (items: { foodId: string; unitId: string; qty: number }[], meal: Meal, date: string, meta: { source: LogSource; rawInput?: string }) => string[];
  updateEntry: (id: string, patch: { unitId: string; qty: number; meal: Meal }) => void;
  removeEntry: (id: string) => void;
  /** undo a delete: put the same entry (same id) back */
  restoreEntry: (e: Entry) => void;
  copyMeal: (fromDate: string, toDate: string, meal: Meal) => void;
  setGoals: (g: Goals) => void;
  setProfile: (p: Profile) => void;
  logWeight: (date: string, kg: number) => void;
  removeWeight: (date: string) => void;
  addWater: (date: string, delta: number) => void;
  addCustomFood: (food: Food) => void;
  removeCustomFood: (id: string) => void;
  saveMeal: (m: SavedMeal) => void;
  deleteSavedMeal: (id: string) => void;
  /** log every item of a saved meal; returns the new entry ids */
  logSavedMeal: (id: string, meal: Meal, date: string) => string[];
  setGuest: (guest: boolean) => void;
  /** wipe everything on this device (sign-out); server data is untouched */
  resetLocal: () => void;
};

const INITIAL: Data = {
  entries: [], goals: DEFAULT_GOALS, profile: null, weights: [], water: {}, customFoods: [], savedMeals: [], sync: EMPTY_QUEUE, guest: false,
};

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const add = (list: string[], ...items: string[]) => [...new Set([...list, ...items])];
const drop = (list: string[], item: string) => list.filter((x) => x !== item);

function build(foodId: string, unitId: string, qty: number, meal: Meal, date: string, source: LogSource = "manual", rawInput?: string): Entry | null {
  const food = getFood(foodId);
  if (!food) return null;
  const unit = getUnit(food, unitId);
  return {
    id: uid(), date, meal, foodId, name: food.name, unitId: unit.id,
    unitLabel: unit.label, qty, ...portion(food, unit, qty), createdAt: Date.now(),
    source, ...(rawInput ? { rawInput: rawInput.slice(0, 500) } : {}),
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      hydrated: false,

      addEntry: (foodId, unitId, qty, meal, date) =>
        set((s) => {
          const e = build(foodId, unitId, qty, meal, date);
          return e ? { entries: [...s.entries, e], sync: { ...s.sync, dirtyEntries: add(s.sync.dirtyEntries, e.id) } } : s;
        }),
      addEntries: (items, meal, date, meta) => {
        const made = items.map((it) => build(it.foodId, it.unitId, it.qty, meal, date, meta.source, meta.rawInput)).filter(Boolean) as Entry[];
        set((s) => ({
          entries: [...s.entries, ...made],
          sync: { ...s.sync, dirtyEntries: add(s.sync.dirtyEntries, ...made.map((e) => e.id)) },
        }));
        return made.map((e) => e.id);
      },
      updateEntry: (id, patch) =>
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== id) return e;
            const next = build(e.foodId, patch.unitId, patch.qty, patch.meal, e.date, e.source, e.rawInput);
            return next ? { ...next, id: e.id, createdAt: e.createdAt } : e;
          }),
          sync: { ...s.sync, dirtyEntries: add(s.sync.dirtyEntries, id) },
        })),
      removeEntry: (id) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.id !== id),
          sync: { ...s.sync, dirtyEntries: drop(s.sync.dirtyEntries, id), deletedEntries: add(s.sync.deletedEntries, id) },
        })),
      restoreEntry: (e) =>
        set((s) => ({
          entries: [...s.entries.filter((x) => x.id !== e.id), e],
          sync: { ...s.sync, dirtyEntries: add(s.sync.dirtyEntries, e.id), deletedEntries: drop(s.sync.deletedEntries, e.id) },
        })),
      copyMeal: (fromDate, toDate, meal) =>
        set((s) => {
          const copies = s.entries
            .filter((e) => e.date === fromDate && e.meal === meal)
            .map((e) => ({ ...e, id: uid(), date: toDate, createdAt: Date.now() }));
          return {
            entries: [...s.entries, ...copies],
            sync: { ...s.sync, dirtyEntries: add(s.sync.dirtyEntries, ...copies.map((c) => c.id)) },
          };
        }),
      setGoals: (goals) => set((s) => ({ goals, sync: { ...s.sync, goalsDirty: true } })),
      setProfile: (profile) => set((s) => ({ profile, sync: { ...s.sync, goalsDirty: true } })),
      logWeight: (date, kg) =>
        set((s) => ({
          weights: [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date)),
          sync: { ...s.sync, dirtyWeights: add(s.sync.dirtyWeights, date), deletedWeights: drop(s.sync.deletedWeights, date) },
        })),
      removeWeight: (date) =>
        set((s) => ({
          weights: s.weights.filter((w) => w.date !== date),
          sync: { ...s.sync, dirtyWeights: drop(s.sync.dirtyWeights, date), deletedWeights: add(s.sync.deletedWeights, date) },
        })),
      addWater: (date, delta) =>
        set((s) => ({
          water: { ...s.water, [date]: Math.max(0, (s.water[date] ?? 0) + delta) },
          sync: { ...s.sync, dirtyWater: add(s.sync.dirtyWater, date) },
        })),
      addCustomFood: (food) =>
        set((s) => ({
          customFoods: [...s.customFoods.filter((f) => f.id !== food.id), food],
          sync: { ...s.sync, dirtyFoods: add(s.sync.dirtyFoods, food.id) },
        })),
      removeCustomFood: (id) =>
        set((s) => ({
          customFoods: s.customFoods.filter((f) => f.id !== id),
          sync: { ...s.sync, dirtyFoods: drop(s.sync.dirtyFoods, id), deletedFoods: add(s.sync.deletedFoods, id) },
        })),
      saveMeal: (m) =>
        set((s) => ({
          savedMeals: [...s.savedMeals.filter((x) => x.id !== m.id), m],
          sync: { ...s.sync, dirtyMeals: add(s.sync.dirtyMeals, m.id), deletedMeals: drop(s.sync.deletedMeals, m.id) },
        })),
      deleteSavedMeal: (id) =>
        set((s) => ({
          savedMeals: s.savedMeals.filter((x) => x.id !== id),
          sync: { ...s.sync, dirtyMeals: drop(s.sync.dirtyMeals, id), deletedMeals: add(s.sync.deletedMeals, id) },
        })),
      logSavedMeal: (id, meal, date) => {
        const saved = get().savedMeals.find((m) => m.id === id);
        if (!saved) return [];
        const made = saved.items.map((it) => build(it.foodId, it.unitId, it.qty, meal, date)).filter(Boolean) as Entry[];
        set((s) => ({
          entries: [...s.entries, ...made],
          sync: { ...s.sync, dirtyEntries: add(s.sync.dirtyEntries, ...made.map((e) => e.id)) },
        }));
        return made.map((e) => e.id);
      },
      setGuest: (guest) => set({ guest }),
      resetLocal: () => set({ ...INITIAL }),
    }),
    {
      name: "ct-v1",
      version: 1, // new fields fall back to INITIAL via the default shallow merge
      partialize: ({ entries, goals, profile, weights, water, customFoods, savedMeals, sync, guest }) =>
        ({ entries, goals, profile, weights, water, customFoods, savedMeals, sync, guest }),
      // queues persisted before a field existed would lack it
      merge: (persisted, current) => {
        const p = persisted as Partial<State>;
        return { ...current, ...p, sync: { ...EMPTY_QUEUE, ...p.sync } };
      },
      // rehydrated from AppShell after mount, so server HTML and first client render match
      skipHydration: true,
    },
  ),
);

export async function hydrateStore() {
  await useStore.persist.rehydrate();
  useStore.setState({ hydrated: true });
}

// keep the catalog's view of custom foods current (search, getFood)
useStore.subscribe((s, prev) => {
  if (s.customFoods !== prev.customFoods) setCustomFoods(s.customFoods);
});

/** Changes waiting to be pushed. */
export const pendingCount = (q: SyncQueue) =>
  q.dirtyEntries.length + q.deletedEntries.length + q.dirtyWeights.length + q.deletedWeights.length + q.dirtyWater.length +
  q.dirtyFoods.length + q.deletedFoods.length + q.dirtyMeals.length + q.deletedMeals.length + (q.goalsDirty ? 1 : 0);

export type Toast = { id: number; text: string; action?: { label: string; run: () => void } };

/** UI-only state, not persisted. */
type UI = {
  date: string | null;
  toast: Toast | null;
  /** entries added in this session, highlighted once when they appear on Today */
  fresh: string[];
  markFresh: (id: string) => void;
  clearFresh: (id: string) => void;
  showToast: (text: string, action?: Toast["action"]) => void;
  dismissToast: () => void;
  sheet: null | { mode: "add"; meal: Meal } | { mode: "edit"; entryId: string } | { mode: "thali"; slot: Meal; thaliId?: string; prefill?: ThaliItem[] };
  setDate: (d: string) => void;
  openAdd: (meal: Meal) => void;
  openEdit: (entryId: string) => void;
  openThali: (opts: { slot: Meal; thaliId?: string; prefill?: ThaliItem[] }) => void;
  close: () => void;
};

export const useUI = create<UI>((set) => ({
  date: null,
  toast: null,
  fresh: [],
  markFresh: (id) => set((s) => ({ fresh: [...s.fresh, id] })),
  clearFresh: (id) => set((s) => ({ fresh: s.fresh.filter((x) => x !== id) })),
  showToast: (text, action) => set({ toast: { id: Date.now(), text, action } }),
  dismissToast: () => set({ toast: null }),
  sheet: null,
  setDate: (date) => set({ date }),
  openAdd: (meal) => set({ sheet: { mode: "add", meal } }),
  openEdit: (entryId) => set({ sheet: { mode: "edit", entryId } }),
  openThali: (opts) => set({ sheet: { mode: "thali", ...opts } }),
  close: () => set({ sheet: null }),
}));
