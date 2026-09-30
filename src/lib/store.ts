"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { batchedStorage } from "./localSave";
import { getFood, getUnit, setCustomFoods } from "./foods";
import { DEFAULT_GOALS, portion } from "./nutrition";
import { dayKey } from "./dates";
import { activeVisit } from "./gym/visits";
import type { BpReading, Entry, Fitness, Food, Goals, Gym, GymVisit, HabitDay, HealthInfo, LocalVisit, LogSource, Meal, Measurement, Profile, Routine, RoutineItem, SavedMeal, ThaliItem, TobaccoKind, WeightLog, Workout } from "./types";

/**
 * Local changes not yet pushed to Supabase (decision D14).
 * Every mutation below records what it touched; lib/sync/engine.ts pushes and clears these.
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
  dirtyWorkouts: string[];
  deletedWorkouts: string[];
  dirtyGyms: string[];
  deletedGyms: string[];
  dirtyRoutines: string[];
  deletedRoutines: string[];
  dirtyMeasurements: string[];
  deletedMeasurements: string[];
  dirtyBp: string[];
  deletedBp: string[];
  dirtyHabits: string[];
  deletedHabits: string[];
  /** goals, profile, fitness or health changed (all live in user_goals) */
  goalsDirty: boolean;
};

export const EMPTY_QUEUE: SyncQueue = {
  userId: null, lastPulledAt: null, dirtyEntries: [], deletedEntries: [],
  dirtyWeights: [], deletedWeights: [], dirtyWater: [], dirtyFoods: [], deletedFoods: [], dirtyMeals: [], deletedMeals: [], dirtyWorkouts: [], deletedWorkouts: [], dirtyGyms: [], deletedGyms: [], dirtyRoutines: [], deletedRoutines: [], dirtyMeasurements: [], deletedMeasurements: [], dirtyBp: [], deletedBp: [], dirtyHabits: [], deletedHabits: [], goalsDirty: false,
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
  /** logged exercises + cardio (D27) */
  workouts: Workout[];
  fitness: Fitness;
  /** saved workouts ("Chest day"), logged in one tap or as a checklist */
  routines: Routine[];
  /** body measurements, one per day (D39); progress photos live only on the device (lib/photos.ts) */
  measurements: Measurement[];
  /** Health tab (D55): blood-pressure readings and tobacco days (one each per day, synced), health answers + Habits settings */
  bp: BpReading[];
  habitDays: HabitDay[];
  health: HealthInfo;
  /** gym check-in (D30): the user's gym (synced), server visits (read-only copy), visits saved only on this device */
  gyms: Gym[];
  visits: GymVisit[];
  localVisits: LocalVisit[];
  /** "Done" tapped while offline on a server visit; sent when back online */
  pendingCheckout: { visitId: string; endedAt: number } | null;
  /** app-level location consent for check-in verification (layer 1; the browser permission is layer 2).
   *  null = never asked, false = off, true = on. Synced with the goals (user_goals). */
  locationConsent: boolean | null;
  locationConsentAt: number | null;
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
  addWorkout: (w: Omit<Workout, "id" | "createdAt">) => string;
  /** log several at once (a routine's "Log all"); returns the new ids in order */
  addWorkouts: (list: Omit<Workout, "id" | "createdAt">[]) => string[];
  updateWorkout: (id: string, patch: Omit<Workout, "id" | "createdAt" | "date">) => void;
  removeWorkout: (id: string) => void;
  /** undo a delete: put the same workout (same id) back */
  restoreWorkout: (w: Workout) => void;
  setFitness: (f: Fitness) => void;
  /** create or update (also undoes a delete: same id) */
  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: string) => void;
  /** add or replace a day's measurements (same date = same entry) */
  saveMeasurement: (m: Measurement) => void;
  deleteMeasurement: (id: string) => void;
  /** add or replace a day's blood-pressure reading (same date = same entry) */
  saveBp: (r: BpReading) => void;
  deleteBp: (id: string) => void;
  /** +1 / −1 on a tobacco kind for a day (never below 0) */
  addTobacco: (date: string, kind: TobaccoKind, delta: number) => void;
  /** merge answers / Habits settings (synced with the goals) */
  setHealth: (patch: Partial<HealthInfo>) => void;
  /** create the gym, or edit it in place (same gym: fix the pin, rename, radius) */
  saveGym: (g: Gym) => void;
  /** moved to a different gym: `next` becomes the gym, the old one is retired (soft delete) so past visits keep pointing at it */
  switchGym: (next: Gym) => void;
  /** no gym any more; past visits stay */
  removeGym: (id: string) => void;
  /** server answer from a gym API call */
  putVisit: (v: GymVisit) => void;
  startLocalVisit: (gymId: string | null) => LocalVisit;
  endLocalVisit: (id: string, endedAt: number) => void;
  /** uploaded: the server copy replaces it */
  dropLocalVisit: (id: string) => void;
  setPendingCheckout: (p: { visitId: string; endedAt: number } | null) => void;
  setLocationConsent: (on: boolean) => void;
  setGuest: (guest: boolean) => void;
  /** wipe everything on this device (sign-out); server data is untouched */
  resetLocal: () => void;
};

/** Sunday off until the user picks their own rest days. */
export const DEFAULT_FITNESS: Fitness = { burnGoal: null, restDays: [0] };

const INITIAL: Data = {
  entries: [], goals: DEFAULT_GOALS, profile: null, weights: [], water: {}, customFoods: [], savedMeals: [],
  workouts: [], fitness: DEFAULT_FITNESS, routines: [], measurements: [], bp: [], habitDays: [], health: {}, gyms: [], visits: [], localVisits: [], pendingCheckout: null,
  locationConsent: null, locationConsentAt: null, sync: EMPTY_QUEUE, guest: false,
};

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
/** RFC 4122 v4 (the server checks offline visit ids are uuids); randomUUID is missing on plain-http LAN testing. */
const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16));
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
          // also undoes a delete (same id): drop it from the delete queue, or the next push deletes it again
          sync: { ...s.sync, dirtyFoods: add(s.sync.dirtyFoods, food.id), deletedFoods: drop(s.sync.deletedFoods, food.id) },
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
      addWorkout: (w) => {
        // logged during a gym visit today → linked to it (the visit never adds calories, D30)
        const s0 = get();
        const active = w.date === dayKey() ? activeVisit(s0.visits, s0.localVisits, s0.pendingCheckout?.visitId ?? null) : null;
        const made: Workout = { ...w, id: uid(), createdAt: Date.now(), ...(active && !w.visitId ? { visitId: active.id } : {}) };
        set((s) => ({ workouts: [...s.workouts, made], sync: { ...s.sync, dirtyWorkouts: add(s.sync.dirtyWorkouts, made.id) } }));
        return made.id;
      },
      addWorkouts: (list) => {
        const s0 = get();
        const active = activeVisit(s0.visits, s0.localVisits, s0.pendingCheckout?.visitId ?? null);
        const now = Date.now();
        // createdAt + i keeps the routine's order in the session list
        const made: Workout[] = list.map((w, i) => ({
          ...w, id: uid(), createdAt: now + i, ...(active && w.date === dayKey() && !w.visitId ? { visitId: active.id } : {}),
        }));
        set((s) => ({ workouts: [...s.workouts, ...made], sync: { ...s.sync, dirtyWorkouts: add(s.sync.dirtyWorkouts, ...made.map((w) => w.id)) } }));
        return made.map((w) => w.id);
      },
      updateWorkout: (id, patch) =>
        set((s) => ({
          // links (gym visit, routine) aren't part of an edit: keep them
          workouts: s.workouts.map((w) =>
            w.id === id ? { id, createdAt: w.createdAt, date: w.date, ...(w.visitId ? { visitId: w.visitId } : {}), ...(w.routineId ? { routineId: w.routineId } : {}), ...patch } : w,
          ),
          sync: { ...s.sync, dirtyWorkouts: add(s.sync.dirtyWorkouts, id) },
        })),
      removeWorkout: (id) =>
        set((s) => ({
          workouts: s.workouts.filter((w) => w.id !== id),
          sync: { ...s.sync, dirtyWorkouts: drop(s.sync.dirtyWorkouts, id), deletedWorkouts: add(s.sync.deletedWorkouts, id) },
        })),
      restoreWorkout: (w) =>
        set((s) => ({
          workouts: [...s.workouts.filter((x) => x.id !== w.id), w],
          sync: { ...s.sync, dirtyWorkouts: add(s.sync.dirtyWorkouts, w.id), deletedWorkouts: drop(s.sync.deletedWorkouts, w.id) },
        })),
      setFitness: (fitness) => set((s) => ({ fitness, sync: { ...s.sync, goalsDirty: true } })),
      saveRoutine: (r) =>
        set((s) => ({
          routines: [...s.routines.filter((x) => x.id !== r.id), r],
          sync: { ...s.sync, dirtyRoutines: add(s.sync.dirtyRoutines, r.id), deletedRoutines: drop(s.sync.deletedRoutines, r.id) },
        })),
      deleteRoutine: (id) =>
        set((s) => ({
          routines: s.routines.filter((x) => x.id !== id),
          sync: { ...s.sync, dirtyRoutines: drop(s.sync.dirtyRoutines, id), deletedRoutines: add(s.sync.deletedRoutines, id) },
        })),
      saveMeasurement: (m) =>
        set((s) => {
          // one entry per day: a second save the same day updates it (keeps its id, so sync stays clean)
          const same = s.measurements.find((x) => x.date === m.date && x.id !== m.id);
          const item = same ? { ...m, id: same.id } : m;
          return {
            measurements: [...s.measurements.filter((x) => x.id !== item.id), item].sort((a, b) => a.date.localeCompare(b.date)),
            sync: { ...s.sync, dirtyMeasurements: add(s.sync.dirtyMeasurements, item.id), deletedMeasurements: drop(s.sync.deletedMeasurements, item.id) },
          };
        }),
      deleteMeasurement: (id) =>
        set((s) => ({
          measurements: s.measurements.filter((x) => x.id !== id),
          sync: { ...s.sync, dirtyMeasurements: drop(s.sync.dirtyMeasurements, id), deletedMeasurements: add(s.sync.deletedMeasurements, id) },
        })),
      saveBp: (r) =>
        set((s) => {
          const same = s.bp.find((x) => x.date === r.date && x.id !== r.id);
          const item = same ? { ...r, id: same.id, createdAt: same.createdAt } : r;
          return {
            bp: [...s.bp.filter((x) => x.id !== item.id), item].sort((a, b) => a.date.localeCompare(b.date)),
            sync: { ...s.sync, dirtyBp: add(s.sync.dirtyBp, item.id), deletedBp: drop(s.sync.deletedBp, item.id) },
          };
        }),
      deleteBp: (id) =>
        set((s) => ({
          bp: s.bp.filter((x) => x.id !== id),
          sync: { ...s.sync, dirtyBp: drop(s.sync.dirtyBp, id), deletedBp: add(s.sync.deletedBp, id) },
        })),
      addTobacco: (date, kind, delta) =>
        set((s) => {
          const day = s.habitDays.find((d) => d.date === date);
          const n = Math.max(0, Math.min(200, (day?.counts[kind] ?? 0) + delta));
          const item: HabitDay = day
            ? { ...day, counts: { ...day.counts, [kind]: n } }
            : { id: `habit-${uid()}`, date, counts: { [kind]: n }, createdAt: Date.now() };
          return {
            habitDays: [...s.habitDays.filter((d) => d.id !== item.id), item].sort((a, b) => a.date.localeCompare(b.date)),
            sync: { ...s.sync, dirtyHabits: add(s.sync.dirtyHabits, item.id), deletedHabits: drop(s.sync.deletedHabits, item.id) },
          };
        }),
      setHealth: (patch) => set((s) => ({ health: { ...s.health, ...patch }, sync: { ...s.sync, goalsDirty: true } })),
      saveGym: (g) =>
        set((s) => ({
          gyms: [...s.gyms.filter((x) => x.id !== g.id), g],
          sync: { ...s.sync, dirtyGyms: add(s.sync.dirtyGyms, g.id), deletedGyms: drop(s.sync.deletedGyms, g.id) },
        })),
      switchGym: (next) =>
        set((s) => {
          const old = s.gyms.filter((x) => x.id !== next.id).map((x) => x.id);
          return {
            gyms: [next],
            sync: {
              ...s.sync,
              dirtyGyms: add(s.sync.dirtyGyms.filter((id) => !old.includes(id)), next.id),
              deletedGyms: add(drop(s.sync.deletedGyms, next.id), ...old),
            },
          };
        }),
      removeGym: (id) =>
        set((s) => ({
          gyms: s.gyms.filter((x) => x.id !== id),
          sync: { ...s.sync, dirtyGyms: drop(s.sync.dirtyGyms, id), deletedGyms: add(s.sync.deletedGyms, id) },
        })),
      putVisit: (v) => set((s) => ({ visits: [...s.visits.filter((x) => x.id !== v.id), v] })),
      startLocalVisit: (gymId) => {
        const v: LocalVisit = { id: uuid(), gymId, startedAt: Date.now(), endedAt: null };
        set((s) => ({ localVisits: [...s.localVisits, v] }));
        return v;
      },
      endLocalVisit: (id, endedAt) => set((s) => ({ localVisits: s.localVisits.map((v) => (v.id === id ? { ...v, endedAt } : v)) })),
      dropLocalVisit: (id) => set((s) => ({ localVisits: s.localVisits.filter((v) => v.id !== id) })),
      setPendingCheckout: (pendingCheckout) => set({ pendingCheckout }),
      setLocationConsent: (on) => set((s) => ({ locationConsent: on, locationConsentAt: Date.now(), sync: { ...s.sync, goalsDirty: true } })),
      setGuest: (guest) => set({ guest }),
      resetLocal: () => set({ ...INITIAL }),
    }),
    {
      name: "ct-v1",
      version: 1, // new fields fall back to INITIAL via the default shallow merge
      // batched writes that survive a full localStorage (lib/localSave.ts)
      storage: typeof window === "undefined" ? undefined : batchedStorage(),
      partialize: ({ entries, goals, profile, weights, water, customFoods, savedMeals, workouts, fitness, routines, measurements, bp, habitDays, health, gyms, visits, localVisits, pendingCheckout, locationConsent, locationConsentAt, sync, guest }) =>
        ({ entries, goals, profile, weights, water, customFoods, savedMeals, workouts, fitness, routines, measurements, bp, habitDays, health, gyms, visits, localVisits, pendingCheckout, locationConsent, locationConsentAt, sync, guest }),
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
  q.dirtyFoods.length + q.deletedFoods.length + q.dirtyMeals.length + q.deletedMeals.length +
  q.dirtyWorkouts.length + q.deletedWorkouts.length + q.dirtyGyms.length + q.deletedGyms.length +
  q.dirtyRoutines.length + q.deletedRoutines.length + q.dirtyMeasurements.length + q.deletedMeasurements.length +
  q.dirtyBp.length + q.deletedBp.length + q.dirtyHabits.length + q.deletedHabits.length + (q.goalsDirty ? 1 : 0);

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
  sheet: null | { mode: "add"; meal: Meal; /** open on this food's detail (e.g. "Log it" on a food news card) */ foodId?: string } | { mode: "edit"; entryId: string } | { mode: "thali"; slot: Meal; thaliId?: string; prefill?: ThaliItem[] };
  /** workout sheet (D27): pick an exercise/activity, or edit a logged one */
  gym: null | { mode: "pick"; tab: "strength" | "cardio" } | { mode: "edit"; workoutId: string };
  setDate: (d: string) => void;
  openAdd: (meal: Meal, foodId?: string) => void;
  openEdit: (entryId: string) => void;
  openThali: (opts: { slot: Meal; thaliId?: string; prefill?: ThaliItem[] }) => void;
  close: () => void;
  openGym: (tab?: "strength" | "cardio") => void;
  editWorkout: (workoutId: string) => void;
  closeGym: () => void;
  /** server clock − device clock, ms (from gym API replies), so the visit timer is right on a wrong phone clock */
  clockSkew: number;
  /** nearby banner (D30 phase 4): set by the on-phone check when you're within your gym's radius */
  nearby: { gymId: string; name: string; distanceM: number } | null;
  /** the banner's "Check in": the Gym card starts the normal check-in flow when it sees this */
  autoCheckIn: boolean;
  /** ask the app shell to navigate (for actions started outside a page, e.g. a toast button) */
  navTo: string | null;
  /** open the end-time fixer for this auto-closed visit */
  fixVisitId: string | null;
  /** "Add anything" sheet (D29): one search for food + workouts, opened from the Today bar or / and ⌘K */
  quick: boolean;
  openQuick: () => void;
  closeQuick: () => void;
  /** routine sheet: run one (checklist + Log all), or build/edit one (prefill = "Save as routine" from a session) */
  routine: null | { mode: "run"; id: string } | { mode: "edit"; id?: string; prefill?: RoutineItem[]; starter?: string };
  runRoutine: (id: string) => void;
  editRoutine: (opts: { id?: string; prefill?: RoutineItem[]; starter?: string }) => void;
  closeRoutine: () => void;
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
  openAdd: (meal, foodId) => set({ sheet: { mode: "add", meal, ...(foodId ? { foodId } : {}) } }),
  openEdit: (entryId) => set({ sheet: { mode: "edit", entryId } }),
  openThali: (opts) => set({ sheet: { mode: "thali", ...opts } }),
  close: () => set({ sheet: null }),
  gym: null,
  openGym: (tab = "strength") => set({ gym: { mode: "pick", tab } }),
  editWorkout: (workoutId) => set({ gym: { mode: "edit", workoutId } }),
  closeGym: () => set({ gym: null }),
  clockSkew: 0,
  nearby: null,
  autoCheckIn: false,
  navTo: null,
  fixVisitId: null,
  quick: false,
  openQuick: () => set({ quick: true }),
  closeQuick: () => set({ quick: false }),
  routine: null,
  runRoutine: (id) => set({ routine: { mode: "run", id } }),
  editRoutine: (opts) => set({ routine: { mode: "edit", ...opts } }),
  closeRoutine: () => set({ routine: null }),
}));
