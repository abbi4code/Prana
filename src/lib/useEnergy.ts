"use client";

import { useMemo } from "react";
import { NUDGE_KCAL, currentWeight, energy } from "./energy";
import { suggestGoals } from "./nutrition";
import { useStore } from "./store";

/**
 * Resting burn and the goal breakdown for the saved profile at today's weight (D45).
 * `basis` = what the current goal was built from (the weight typed when "Use this" was pressed); `now` = the same
 * profile at the 7-day average of weigh-ins. A refresh is suggested only when the goal came from the calculator
 * (a goal you typed yourself is left alone) and today's weight moves the suggestion by NUDGE_KCAL or more.
 */
export function useEnergy() {
  const profile = useStore((s) => s.profile);
  const weights = useStore((s) => s.weights);
  const goals = useStore((s) => s.goals);
  return useMemo(() => {
    if (!profile || !(profile.age > 0 && profile.heightCm > 0)) return null;
    const weight = currentWeight(weights, profile)!;
    const now = energy(profile, weight.kg);
    const basis = energy(profile);
    const suggestion = suggestGoals({ ...profile, weightKg: weight.kg });
    const fromCalculator = goals.kcal === basis.goal;
    const refresh = weight.from === "weigh-ins" && fromCalculator && Math.abs(suggestion.kcal - goals.kcal) >= NUDGE_KCAL;
    return { profile, weight, now, basis, suggestion, goal: goals.kcal, fromCalculator, refresh };
  }, [profile, weights, goals.kcal]);
}
