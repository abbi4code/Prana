// Energy: resting burn (BMR) and how the daily goal is built from it (D45). PURE: node-runnable, relative imports.
//
// BMR = Mifflin–St Jeor (1990): 10 × kg + 6.25 × cm − 5 × age + 5 (men) / −161 (women). A systematic review of the
// common equations (Frankenfield et al., J Am Diet Assoc 2005) found it lands within 10 % of measured resting burn
// for more people than any other, but individual errors remain and some age / ethnic groups were barely studied
// (we found no solid validation in Indian adults), so the app always shows it as "~" and calls it an estimate.
//
// Daily goal = BMR × activity factor (maintenance) + aim (lose −500, gain +300), rounded to 10 kcal.
import { addDays } from "./dates.ts";
import type { Profile, WeightLog } from "./types";

export function mifflin(p: Pick<Profile, "sex" | "age" | "heightCm">, kg: number) {
  return 10 * kg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161);
}

export const AIM_KCAL: Record<Profile["aim"], number> = { lose: -500, maintain: 0, gain: 300 };

export type Energy = {
  kg: number;
  /** resting burn, kcal/day */
  bmr: number;
  /** daily life on top of resting (maintenance − BMR) */
  activity: number;
  /** maintenance = BMR × activity factor */
  tdee: number;
  aim: number;
  /** suggested daily goal (rounded to 10) */
  goal: number;
};

export function energy(p: Profile, kg = p.weightKg): Energy {
  const bmr = mifflin(p, kg);
  const tdee = bmr * p.activity;
  const aim = AIM_KCAL[p.aim];
  return { kg, bmr: Math.round(bmr), activity: Math.round(tdee - bmr), tdee: Math.round(tdee), aim, goal: Math.round((tdee + aim) / 10) * 10 };
}

/**
 * Body weight to use today: the 7-day average of weigh-ins ending at the latest one (the same smoothing as the
 * Progress chart, so a salty dinner doesn't move your BMR), else the weight typed in the goal calculator.
 */
export function currentWeight(weights: WeightLog[], profile: Pick<Profile, "weightKg"> | null): { kg: number; from: "weigh-ins" | "profile"; date: string | null } | null {
  if (weights.length) {
    const last = weights.reduce((a, b) => (b.date > a.date ? b : a));
    const from = addDays(last.date, -6);
    const win = weights.filter((w) => w.date >= from && w.date <= last.date);
    return { kg: Math.round((win.reduce((t, w) => t + w.kg, 0) / win.length) * 10) / 10, from: "weigh-ins", date: last.date };
  }
  return profile ? { kg: profile.weightKg, from: "profile", date: null } : null;
}

/** A goal refresh is worth suggesting when today's weight moves the suggested goal by at least this much. */
export const NUDGE_KCAL = 50;
