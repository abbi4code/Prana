"use client";

import { useMemo } from "react";
import { evaluate, type Facts, type SpecialId } from "./badges";
import { addDays, dayKey, parseDay } from "./dates";
import { MIN_VISIT_MINUTES } from "./gym/config";
import { counted, finishedVisits } from "./gym/visits";
import { brzycki, E1RM_MAX_REPS } from "./records";
import { useStore } from "./store";
import { useRecords } from "./useRecords";
import { useStreaks } from "./useStreaks";
import { useFitnessStreaks, weightOn } from "./useWorkouts";

const sorted = (list: Iterable<string>) => [...list].sort();

/** Badges from everything on the device (lib/badges.ts). Derived: nothing is stored or synced. */
export function useBadges() {
  const entries = useStore((s) => s.entries);
  const goals = useStore((s) => s.goals);
  const water = useStore((s) => s.water);
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  const workouts = useStore((s) => s.workouts);
  const savedMeals = useStore((s) => s.savedMeals);
  const routines = useStore((s) => s.routines);
  const visits = useStore((s) => s.visits);
  const localVisits = useStore((s) => s.localVisits);
  const pendingCheckout = useStore((s) => s.pendingCheckout);
  const food = useStreaks();
  const fit = useFitnessStreaks();
  const records = useRecords();

  return useMemo(() => {
    const today = dayKey();
    const past = (d: string) => d <= today;

    const protein = new Map<string, number>();
    for (const e of entries) protein.set(e.date, (protein.get(e.date) ?? 0) + (e.p ?? 0));
    const foodDays = sorted([...food.kcalByDay].filter(([d, k]) => k > 0 && past(d)).map(([d]) => d));
    const onTargetDays = sorted([...food.status].filter(([, s]) => s === "on").map(([d]) => d));
    const proteinDays = goals.p > 0 ? sorted([...protein].filter(([d, p]) => p >= goals.p && past(d)).map(([d]) => d)) : [];
    const waterDays = sorted(Object.entries(water).filter(([d, g]) => g >= 8 && past(d)).map(([d]) => d));
    const weighDays = sorted(weights.map((w) => w.date).filter(past));
    const workoutDays = sorted([...fit.workout.status].filter(([, j]) => j === "hit").map(([d]) => d));
    // one entry per session that set a PR
    const prSessions = sorted(new Map(records.recent.map((h) => [h.workoutId, h.date])).values());
    const routineSessions = sorted(new Map(workouts.filter((w) => w.routineId).map((w) => [`${w.routineId}|${w.date}`, w.date])).values());
    const visitDays = sorted(finishedVisits(visits, localVisits, pendingCheckout).filter((v) => counted(v, MIN_VISIT_MINUTES)).map((v) => dayKey(new Date(v.start))));

    // ── one-off badges ──
    const sp: Partial<Record<SpecialId, string>> = {};
    const minOf = (list: string[]) => (list.length ? list.reduce((a, b) => (b < a ? b : a)) : undefined);
    sp["first-food"] = foodDays[0];
    const workoutDates = sorted(new Set(workouts.map((w) => w.date).filter(past)));
    sp["first-workout"] = workoutDates[0];
    sp.thali = minOf(savedMeals.map((m) => dayKey(new Date(m.createdAt))));
    sp["routine-made"] = minOf(routines.map((r) => dayKey(new Date(r.createdAt))));
    // logged at the time (same day) before 7 am
    sp["early-bird"] = minOf(workouts.filter((w) => { const t = new Date(w.createdAt); return t.getHours() < 7 && dayKey(t) === w.date; }).map((w) => w.date));
    const trained = new Set(workoutDates);
    const saturday = workoutDates.find((d) => parseDay(d).getDay() === 6 && trained.has(addDays(d, 1)));
    if (saturday) sp.weekend = addDays(saturday, 1);
    const active = sorted(new Set([...foodDays, ...workoutDates]));
    for (let i = 1; i < active.length; i++)
      if ((parseDay(active[i]).getTime() - parseDay(active[i - 1]).getTime()) / 86_400_000 >= 8) { sp.comeback = active[i]; break; }
    for (const d of onTargetDays) {
      if (parseDay(d).getDay() !== 0) continue; // a Sunday closing a Monday-first week
      if (Array.from({ length: 7 }, (_, k) => addDays(d, -k)).every((x) => food.status.get(x) === "on")) { sp["perfect-week"] = d; break; }
    }
    for (const w of [...workouts].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      if (w.refId !== "barbell-bench-press" && w.refId !== "dumbbell-bench-press") continue;
      const kg = weightOn(weights, profile, w.date);
      if (!kg) continue;
      const perHand = w.refId === "dumbbell-bench-press" ? 2 : 1; // dumbbell kg is per hand
      const best = Math.max(0, ...(w.sets ?? []).filter((s) => s.reps >= 1 && s.reps <= E1RM_MAX_REPS && s.kg > 0).map((s) => brzycki(s.kg * perHand, s.reps)));
      if (best >= kg) { sp["bw-bench"] = w.date; break; }
    }
    for (const k of Object.keys(sp) as SpecialId[]) if (!sp[k] || !past(sp[k]!)) delete sp[k];

    const facts: Facts = {
      foodBest: food.bestDates, workoutBest: fit.workout.bestDates, pranaBest: fit.started ? fit.global.bestDates : [],
      foodDays, onTargetDays, proteinDays, waterDays, weighDays, workoutDays, prSessions, routineSessions, visits: visitDays,
      specials: sp,
    };
    return evaluate(facts);
  }, [entries, goals.p, water, weights, profile, workouts, savedMeals, routines, visits, localVisits, pendingCheckout, food, fit, records]);
}
