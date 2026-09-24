"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getFood, getUnit } from "./foods";
import { DEFAULT_GOALS, portion } from "./nutrition";
import type { Entry, Goals, Meal, Profile, WeightLog } from "./types";

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
  goalsDirty: boolean;
};

export const EMPTY_QUEUE: SyncQueue = {
  userId: null, lastPulledAt: null, dirtyEntries: [], deletedEntries: [],
  dirtyWeights: [], deletedWeights: [], dirtyWater: [], goalsDirty: false,
};

type Data = {
  entries: Entry[];
  goals: Goals;
  profile: Profile | null;
  weights: WeightLog[];
  water: Record<string, number>;
  sync: SyncQueue;
  /** chose "use without account" on the login screen */
  guest: boolean;
};

type State = Data & {
  hydrated: boolean;
  addEntry: (foodId: string, unitId: string, qty: number, meal: Meal, date: string) => void;
  updateEntry: (id: string, patch: { unitId: string; qty: number; meal: Meal }) => void;
  removeEntry: (id: string) => void;
  copyMeal: (fromDate: string, toDate: string, meal: Meal) => void;
  setGoals: (g: Goals) => void;
  setProfile: (p: Profile) => void;
  logWeight: (date: string, kg: number) => void;
  removeWeight: (date: string) => void;
  addWater: (date: string, delta: number) => void;
  setGuest: (guest: boolean) => void;
  /** wipe everything on this device (sign-out); server data is untouched */
  resetLocal: () => void;
};

const INITIAL: Data = {
  entries: [], goals: DEFAULT_GOALS, profile: null, weights: [], water: {}, sync: EMPTY_QUEUE, guest: false,
};

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const add = (list: string[], ...items: string[]) => [...new Set([...list, ...items])];
const drop = (list: string[], item: string) => list.filter((x) => x !== item);

function build(foodId: string, unitId: string, qty: number, meal: Meal, date: string): Entry | null {
  const food = getFood(foodId);
  if (!food) return null;
  const unit = getUnit(food, unitId);
  return {
    id: uid(), date, meal, foodId, name: food.name, unitId: unit.id,
    unitLabel: unit.label, qty, ...portion(food, unit, qty), createdAt: Date.now(),
  };
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...INITIAL,
      hydrated: false,

      addEntry: (foodId, unitId, qty, meal, date) =>
        set((s) => {
          const e = build(foodId, unitId, qty, meal, date);
          return e ? { entries: [...s.entries, e], sync: { ...s.sync, dirtyEntries: add(s.sync.dirtyEntries, e.id) } } : s;
        }),
      updateEntry: (id, patch) =>
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== id) return e;
            const next = build(e.foodId, patch.unitId, patch.qty, patch.meal, e.date);
            return next ? { ...next, id: e.id, createdAt: e.createdAt } : e;
          }),
          sync: { ...s.sync, dirtyEntries: add(s.sync.dirtyEntries, id) },
        })),
      removeEntry: (id) =>
        set((s) => ({
          entries: s.entries.filter((e) => e.id !== id),
          sync: { ...s.sync, dirtyEntries: drop(s.sync.dirtyEntries, id), deletedEntries: add(s.sync.deletedEntries, id) },
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
      setGuest: (guest) => set({ guest }),
      resetLocal: () => set({ ...INITIAL }),
    }),
    {
      name: "ct-v1",
      version: 1, // new fields fall back to INITIAL via the default shallow merge
      partialize: ({ entries, goals, profile, weights, water, sync, guest }) => ({ entries, goals, profile, weights, water, sync, guest }),
      // rehydrated from AppShell after mount, so server HTML and first client render match
      skipHydration: true,
    },
  ),
);

export async function hydrateStore() {
  await useStore.persist.rehydrate();
  useStore.setState({ hydrated: true });
}

/** Changes waiting to be pushed. */
export const pendingCount = (q: SyncQueue) =>
  q.dirtyEntries.length + q.deletedEntries.length + q.dirtyWeights.length + q.deletedWeights.length + q.dirtyWater.length + (q.goalsDirty ? 1 : 0);

/** UI-only state, not persisted. */
type UI = {
  date: string | null;
  sheet: null | { mode: "add"; meal: Meal } | { mode: "edit"; entryId: string };
  setDate: (d: string) => void;
  openAdd: (meal: Meal) => void;
  openEdit: (entryId: string) => void;
  close: () => void;
};

export const useUI = create<UI>((set) => ({
  date: null,
  sheet: null,
  setDate: (date) => set({ date }),
  openAdd: (meal) => set({ sheet: { mode: "add", meal } }),
  openEdit: (entryId) => set({ sheet: { mode: "edit", entryId } }),
  close: () => set({ sheet: null }),
}));
