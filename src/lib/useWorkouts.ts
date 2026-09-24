"use client";

import { useMemo } from "react";
import { person, type Person } from "./burn";
import { dayKey, parseDay } from "./dates";
import { useStore } from "./store";
import { dayStatus, globalDay, runStreak, workoutDay, type Judged, type RunResult } from "./streaks";
import type { Profile, WeightLog, Workout } from "./types";

/** Body weight on a day: the latest weigh-in on or before it, else the profile's. null = unknown. */
export function weightOn(weights: WeightLog[], profile: Profile | null, date: string): number | null {
  let kg: number | null = null;
  for (const w of weights) if (w.date <= date) kg = w.kg; // weights are sorted by date
  // nothing logged before this day (e.g. first weigh-in was today, workout was yesterday): the nearest later weight is still the best estimate
  return kg ?? profile?.weightKg ?? weights.find((w) => w.date > date)?.kg ?? null;
}

/** Who the burn is estimated for on `date`; null until a body weight is known (we never guess one). */
export function usePerson(date: string): Person | null {
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  return useMemo(() => {
    const kg = weightOn(weights, profile, date);
    return kg ? person(kg, profile) : null;
  }, [weights, profile, date]);
}

export function useDayWorkouts(date: string) {
  const workouts = useStore((s) => s.workouts);
  return useMemo(() => {
    const day = workouts.filter((w) => w.date === date).sort((a, b) => a.createdAt - b.createdAt);
    const kcal = day.reduce((t, w) => t + w.kcal, 0);
    const minutes = day.reduce((t, w) => t + w.minutes, 0);
    const sets = day.reduce((t, w) => t + (w.sets?.length ?? 0), 0);
    return { day, kcal, minutes: Math.round(minutes), sets };
  }, [workouts, date]);
}

/** The latest log of the same exercise on or before `date`, by day then time ("Last time: 50 kg × 8, 8, 8"). */
export function lastTime(workouts: Workout[], refId: string, date: string, excludeId?: string): Workout | undefined {
  let best: Workout | undefined;
  for (const w of workouts) {
    if (w.refId !== refId || w.id === excludeId || w.date > date) continue;
    if (!best || w.date > best.date || (w.date === best.date && w.createdAt > best.createdAt)) best = w;
  }
  return best;
}

export const isRestDay = (restDays: number[], date: string) => restDays.includes(parseDay(date).getDay());

type Run = RunResult & { status: Map<string, Judged> };

/**
 * Workout streak + global "Prana" streak (D27). Both start on the first day a workout was logged.
 * Global = food on target and the workout side done (a planned rest day counts as done).
 */
export function useFitnessStreaks() {
  const entries = useStore((s) => s.entries);
  const workouts = useStore((s) => s.workouts);
  const goal = useStore((s) => s.goals.kcal);
  const fitness = useStore((s) => s.fitness);
  const today = dayKey();
  return useMemo(() => {
    const kcalByDay = new Map<string, number>();
    for (const e of entries) kcalByDay.set(e.date, (kcalByDay.get(e.date) ?? 0) + e.kcal);
    const burnByDay = new Map<string, number>();
    for (const w of workouts) burnByDay.set(w.date, (burnByDay.get(w.date) ?? 0) + w.kcal);
    const first = [...burnByDay.keys()].filter((d) => d <= today).sort()[0] ?? null;

    const judgeWorkout = (d: string) => workoutDay(burnByDay.has(d), burnByDay.get(d) ?? 0, fitness.burnGoal, isRestDay(fitness.restDays, d));
    const tracked = (judge: (d: string) => Judged): Run => {
      const status = new Map<string, Judged>();
      const r = runStreak(first, today, (d) => {
        const j = judge(d);
        status.set(d, j);
        return j;
      });
      return { ...r, status };
    };
    const workout = tracked(judgeWorkout);
    const global = tracked((d) => globalDay(dayStatus(kcalByDay.get(d) ?? 0, goal), judgeWorkout(d)));
    return { today, started: !!first, burnByDay, kcalByDay, workout, global };
  }, [entries, workouts, goal, fitness, today]);
}
