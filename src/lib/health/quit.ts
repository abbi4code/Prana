// Quitting and cutting down (D55). PURE, node-runnable. Verified numbers from .claude/habits.md ("H3 review").
import type { SourceId } from "./sources.ts";

/**
 * Milestones after the last cigarette. Only the steps with a traceable measured source (the popular
 * "20 minutes / 2–12 weeks / 1–9 months" steps have none for their timing, so they're left out).
 */
export const MILESTONES: { days: number; title: string; text: string; src: SourceId }[] = [
  { days: 0.5, title: "12 hours", text: "Carbon monoxide in your blood is back to a non-smoker's level", src: "kambam1986" },
  { days: 90, title: "A few months", text: "Lung function improves by about 5 % (people without COPD)", src: "sg1990" },
  { days: 365, title: "1 year", text: "Your extra risk of heart disease roughly halves", src: "sg1990" },
  { days: 5 * 365, title: "5–15 years", text: "Stroke risk falls to that of a non-smoker (5 years in some studies, 15 in others)", src: "sg1990" },
  { days: 10 * 365, title: "10 years", text: "Lung-cancer risk is 30–50 % of a continuing smoker's", src: "sg1990" },
  { days: 15 * 365, title: "15 years", text: "Heart-disease risk is like someone who never smoked", src: "sg1990" },
];

/** Heart & stroke (CVD) risk of heavy smokers who quit, vs continuing (Duncan 2019, Framingham, HR 95 % CI). */
export const CVD_AFTER_QUIT: { upTo: number; label: string; hr: number; lo: number; hi: number }[] = [
  { upTo: 5, label: "under 5 years", hr: 0.61, lo: 0.49, hi: 0.76 },
  { upTo: 10, label: "5–10 years", hr: 0.61, lo: 0.49, hi: 0.77 },
  { upTo: 15, label: "10–15 years", hr: 0.54, lo: 0.42, hi: 0.70 },
  { upTo: 25, label: "15–25 years", hr: 0.55, lo: 0.45, hi: 0.68 },
  { upTo: Infinity, label: "25+ years", hr: 0.45, lo: 0.35, hi: 0.58 },
];

/** Lung cancer of heavy smokers who quit, vs continuing (Tindle 2018, Framingham, HR 95 % CI). */
export const LUNG_AFTER_QUIT: { upTo: number; label: string; hr: number; lo: number; hi: number }[] = [
  { upTo: 5, label: "under 5 years", hr: 0.61, lo: 0.40, hi: 0.93 },
  { upTo: 10, label: "5–9 years", hr: 0.59, lo: 0.39, hi: 0.89 },
  { upTo: 15, label: "10–14 years", hr: 0.39, lo: 0.23, hi: 0.67 },
  { upTo: 25, label: "15–24 years", hr: 0.29, lo: 0.18, hi: 0.48 },
  { upTo: Infinity, label: "25+ years", hr: 0.19, lo: 0.10, hi: 0.37 },
];

export const afterQuit = (table: typeof CVD_AFTER_QUIT, years: number) => table.find((r) => years < r.upTo)!;

/** Mouth & throat cancer vs continuing smokers, by years since quitting (Possenti 2026: f = −0.0724 × years). */
export const oralAfterQuit = (years: number) => Math.exp(-0.0724 * Math.max(0, years));

/** Years of life gained by stopping at about 30 / 40 / 50 / 60, men born 1900–1930 (Doll 2004): at 60 "at least 3". */
export const YEARS_GAINED_BY_QUIT_AGE: { age: number; years: number }[] = [
  { age: 30, years: 10 },
  { age: 40, years: 9 },
  { age: 50, years: 6 },
  { age: 60, years: 3 },
];
/** The published age at or above yours (conservative: quitting at 35 → the "by 40" figure); none past 64. */
export function yearsGained(age: number) {
  if (age > 64) return null;
  return YEARS_GAINED_BY_QUIT_AGE.find((r) => age <= r.age) ?? YEARS_GAINED_BY_QUIT_AGE[YEARS_GAINED_BY_QUIT_AGE.length - 1];
}

/** Average weight change of untreated quitters, kg (Aubin 2012). ~1 kg a month for the first 3 months. */
export const WEIGHT_AFTER_QUIT: { months: number; kg: number }[] = [
  { months: 1, kg: 1.1 },
  { months: 2, kg: 2.3 },
  { months: 3, kg: 2.9 },
  { months: 6, kg: 4.2 },
  { months: 12, kg: 4.7 },
];

/** Minutes of life expectancy won back: cigarettes not smoked × minutes each (Jackson 2025 worked example). */
export const minutesRegained = (perDayBefore: number, daysQuit: number, minutesEach: number) =>
  Math.max(0, perDayBefore) * Math.max(0, daysQuit) * minutesEach;

/** Cutting down by half or more (not quitting), vs continuing heavy smokers. */
export const CUTTING_DOWN = {
  lungCancer: { hr: 0.73, lo: 0.54, hi: 0.98, quitHr: 0.50, src: "godtfredsen2005" as SourceId, note: "Heavy smokers who cut by half or more vs those who didn't." },
  heart: { note: "Three cohorts: people who halved their smoking had about the same heart risk as before (0.92–1.06); people who quit had about half (0.43–0.67).", src: "hackshaw2018" as SourceId },
};
