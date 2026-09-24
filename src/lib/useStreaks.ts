"use client";

import { useMemo } from "react";
import { dayKey } from "./dates";
import { useStore } from "./store";
import { computeStreaks } from "./streaks";

/** kcal per day + streak state for the current goal (history is judged against today's goal). */
export function useStreaks() {
  const entries = useStore((s) => s.entries);
  const goal = useStore((s) => s.goals.kcal);
  const today = dayKey();
  return useMemo(() => {
    const kcalByDay = new Map<string, number>();
    for (const e of entries) kcalByDay.set(e.date, (kcalByDay.get(e.date) ?? 0) + e.kcal);
    return { kcalByDay, today, goal, ...computeStreaks(kcalByDay, goal, today) };
  }, [entries, goal, today]);
}
