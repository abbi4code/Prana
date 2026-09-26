"use client";

import { useMemo } from "react";
import { getActivity, getExercise } from "./exercises";
import { computeRecords, type RefInfo } from "./records";
import { useStore } from "./store";
import type { Workout } from "./types";

/** What each log is (lift load / cardio model), from the catalog. Unknown ids (removed exercises) are skipped. */
export function refInfo(w: Pick<Workout, "kind" | "refId">): RefInfo | null {
  if (w.kind === "lift") {
    const ex = getExercise(w.refId);
    return ex ? { kind: "lift", load: ex.load } : null;
  }
  const a = getActivity(w.refId);
  return a ? { kind: "cardio", model: a.model } : null;
}

/** Days a PR was set (week strip trophies). */
export function usePrDays() {
  const { recent } = useRecords();
  return useMemo(() => new Set(recent.map((h) => h.date)), [recent]);
}

/** Personal records for everything logged (derived; lib/records.ts). */
export function useRecords() {
  const workouts = useStore((s) => s.workouts);
  return useMemo(() => computeRecords(workouts, refInfo), [workouts]);
}
