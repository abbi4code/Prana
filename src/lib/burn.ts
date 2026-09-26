// Calorie-burn estimate (decision D27, .claude/workouts.md "Calculation choices").
// Pure functions, no alias imports, so they can be tested in isolation with Node.
//
//   gross kcal/min = MET × 3.5 mL O2/kg/min × kg × 5 kcal per L O2 / 1000   (Compendium 2024 conversion)
//   net   kcal/min = gross − your own resting burn (Mifflin–St Jeor, the same equation as the food goal)
//
// Only the net part is counted: resting burn is already inside the daily food goal.
// Walking/running with a known speed use the ACSM metabolic equations instead of a fixed MET.
// Realistic accuracy is about ±25 % (checked against published measurements), so the UI shows "~".

import { mifflin } from "./energy.ts";
import type { Activity, Exercise, Profile, RepGroup, WorkSet } from "./types";

const O2_PER_MET = 3.5; // mL/kg/min
const KCAL_PER_L_O2 = 5;

/** Seconds per rep: ACSM 2009 moderate tempo, 1–2 s up + 1–2 s down → midpoint. */
export const REP_SECONDS = 3;
/** Default rest between sets: midpoint of ACSM 2009's hypertrophy range (60–120 s). */
export const DEFAULT_REST = 90;
export const REST_CHOICES = [60, 90, 120, 180];

export type Person = { kg: number; restKcalPerMin: number; personal: boolean };

/** Body weight for the day + resting burn. Without a full profile, resting = 1 MET. */
export function person(kg: number, profile: Pick<Profile, "sex" | "age" | "heightCm"> | null): Person {
  if (profile && profile.age > 0 && profile.heightCm > 0) {
    return { kg, restKcalPerMin: mifflin(profile, kg) / 1440, personal: true };
  }
  return { kg, restKcalPerMin: grossPerMin(1, kg), personal: false };
}

export const grossPerMin = (met: number, kg: number) => (met * O2_PER_MET * kg * KCAL_PER_L_O2) / 1000;

const netKcal = (met: number, minutes: number, p: Person) => Math.max(0, (grossPerMin(met, p.kg) - p.restKcalPerMin) * minutes);

/** Time a lifting block takes: every set's work (reps × tempo, or hold time) plus the rest after it. */
export function liftMinutes(sets: WorkSet[], restSec: number) {
  const secs = sets.reduce((t, s) => t + (s.secs ?? s.reps * REP_SECONDS) + restSec, 0);
  return secs / 60;
}

/**
 * `minutes` is the real time the sets take with the rest you chose. Energy is always charged with the standard
 * rest (DEFAULT_REST): rest length doesn't change a session's total energy (Farinatti 2011: 1-min vs 3-min rest,
 * same sets, 88.7 vs 91.1 kcal incl. recovery), so a longer rest must not add calories. Weight lifted isn't in
 * this model yet: the per-set work model (workouts.md "Lifting burn model v2") replaces it once researched.
 */
export function liftBurn(ex: Pick<Exercise, "met" | "metIntense">, sets: WorkSet[], restSec: number, intense: boolean, p: Person) {
  const met = intense ? ex.metIntense.value : ex.met.value;
  const minutes = liftMinutes(sets, restSec);
  const charged = liftMinutes(sets, DEFAULT_REST);
  return { met, minutes: round1(minutes), kcal: Math.round(netKcal(met, charged, p)) };
}

/**
 * Lifting burn v2 (workouts.md "Lifting burn model v2"): measured energy per rep for the movement, which grows with
 * the load: Σ over sets of reps × (a + b × load_kg) + a fixed cost per set. Rest length and pace don't change it.
 * - dumbbells in both hands: the kg entered is per dumbbell, so the load is doubled
 * - bodyweight moves: load = share of body mass (+ kg added); assisted: minus the counterweight
 * Coefficients come from Scott/Knausenberger (per set, incl. recovery) and Reis 2017 (machines), built into
 * src/data/exercises.generated.json by scripts/build-exercises.mjs.
 */
export function repBurn(ex: Pick<Exercise, "rep" | "load">, group: RepGroup, sets: WorkSet[], restSec: number, p: Person) {
  const rep = ex.rep!;
  const load = (s: WorkSet) => {
    if (rep.bw == null) return s.kg * (rep.perSide ? 2 : 1);
    const body = rep.bw * p.kg;
    return Math.max(0, ex.load === "assisted" ? body - s.kg : body + s.kg);
  };
  let kcal = 0;
  for (const s of sets) kcal += s.reps * (group.a + group.b * load(s)) + group.set;
  return { met: 0, minutes: round1(liftMinutes(sets, restSec)), kcal: Math.round(kcal) };
}

/** ACSM walking / running equations → MET equivalent (VO2 ÷ 3.5). speed in km/h, incline in %. */
export function acsmMet(model: "walk" | "run", speedKmh: number, inclinePct: number) {
  const s = (speedKmh * 1000) / 60; // m/min
  const g = inclinePct / 100;
  const vo2 = model === "walk" ? 3.5 + 0.1 * s + 1.8 * s * g : 3.5 + 0.2 * s + 0.9 * s * g;
  return vo2 / O2_PER_MET;
}

export function cardioBurn(
  a: Pick<Activity, "model" | "options">,
  v: { minutes: number; speedKmh?: number; inclinePct?: number; optionCode?: string },
  p: Person,
) {
  const met =
    a.model === "met"
      ? (a.options.find((o) => o.code === v.optionCode) ?? a.options[0]).value
      : acsmMet(a.model, v.speedKmh ?? 5, v.inclinePct ?? 0);
  return { met: round1(met), minutes: v.minutes, kcal: Math.round(netKcal(met, v.minutes, p)) };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
