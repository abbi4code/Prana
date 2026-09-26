"use client";

import { useMemo } from "react";
import { MIN_VISIT_MINUTES } from "./gym/config";
import { counted, finishedVisits } from "./gym/visits";
import { useStore } from "./store";
import { useBadges } from "./useBadges";
import { useRecords } from "./useRecords";
import { useStreaks } from "./useStreaks";
import { useFitnessStreaks } from "./useWorkouts";
import { addDays, dayKey } from "./dates";
import { latestWrappable, wrapWeek, wrappableWeeks, type FoodDot, type WrappedInput, type WrappedWeek } from "./wrapped";

/**
 * Weekly Wrapped from everything on the device (lib/wrapped.ts). Derived: nothing is stored or synced.
 * `weeks` = weeks with data, newest first (the current week only from Sunday evening); `wrap(week)` builds one.
 */
export function useWrapped() {
  const entries = useStore((s) => s.entries);
  const goals = useStore((s) => s.goals);
  const water = useStore((s) => s.water);
  const workouts = useStore((s) => s.workouts);
  const visits = useStore((s) => s.visits);
  const localVisits = useStore((s) => s.localVisits);
  const pendingCheckout = useStore((s) => s.pendingCheckout);
  const food = useStreaks();
  const fit = useFitnessStreaks();
  const records = useRecords();
  const badges = useBadges();

  return useMemo(() => {
    const today = dayKey();
    const latest = latestWrappable(today, new Date().getHours());
    const foodFirst = [...food.kcalByDay.keys()].filter((d) => d <= today).sort()[0] ?? null;
    const fitFirst = [...fit.burnByDay.keys(), ...fit.visitDays].filter((d) => d <= today).sort()[0] ?? null;
    const foodDay = (d: string): FoodDot =>
      food.status.get(d) === "on" ? "on" : (food.kcalByDay.get(d) ?? 0) > 0 ? "logged" : "none";

    const base: Omit<WrappedInput, "weekStart"> = {
      today, entries, goals, water, workouts,
      food: { first: foodFirst, day: foodDay },
      fitness: fit.started
        ? { first: fitFirst, workout: (d) => fit.workout.status.get(d) ?? "miss", prana: (d) => fit.global.status.get(d) ?? "miss" }
        : null,
      prHits: records.recent,
      unlocks: badges.unlocks,
      visits: finishedVisits(visits, localVisits, pendingCheckout).map((v) => ({ start: v.start, end: v.end, counted: counted(v, MIN_VISIT_MINUTES) })),
    };

    // which weeks have anything logged (cheap: day sets, no full wrap)
    const active = new Set<string>([...entries.map((e) => e.date), ...workouts.map((w) => w.date), ...fit.visitDays]);
    const hasData = (w: string) => Array.from({ length: 7 }, (_, i) => addDays(w, i)).some((d) => active.has(d));
    const first = [foodFirst, fitFirst].filter(Boolean).sort()[0] ?? null;
    const weeks = wrappableWeeks(first, latest, hasData);

    const cache = new Map<string, WrappedWeek>();
    const wrap = (weekStart: string) => {
      let w = cache.get(weekStart);
      if (!w) cache.set(weekStart, (w = wrapWeek({ ...base, weekStart })));
      return w;
    };
    return { weeks, latest, wrap };
  }, [entries, goals, water, workouts, visits, localVisits, pendingCheckout, food, fit, records, badges]);
}
