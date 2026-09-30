// Alcohol (D55). PURE, node-runnable. Grams of ethanol come from the drinks already logged (D53: `alc` = g per
// 100 g/ml). Verified numbers from .claude/habits.md ("H4 review").
import type { SourceId } from "./sources.ts";
import type { Sex } from "./tobacco.ts";

/** India (ICMR-NCDIR NNMS 2017–18) and WHO: one standard drink = 10 g of pure alcohol; heavy episode = 60 g+ in one sitting. */
export const STANDARD_DRINK_G = 10;
export const HEAVY_EPISODE_G = 60;
export const KCAL_PER_G = 7;

/** Ethanol grams in a logged portion. */
export const ethanolG = (grams: number, alcPer100: number | null | undefined) => (alcPer100 ? (grams * alcPer100) / 100 : 0);

/**
 * GBD 2020, South Asia (appendix 2, Table S1), standard drinks (10 g) a day: `lowest` = the amount with the lowest
 * health risk (TMREL), `noHarm` = the most you can drink before the net effect turns harmful (NDE).
 */
const SOUTH_ASIA: { from: number; f: [number, number]; m: [number, number] }[] = [
  { from: 15, f: [0.103, 0.171], m: [0.0064, 0.0097] },
  { from: 20, f: [0.148, 0.263], m: [0.0427, 0.0719] },
  { from: 25, f: [0.241, 0.451], m: [0.0943, 0.171] },
  { from: 30, f: [0.362, 0.772], m: [0.277, 0.584] },
  { from: 35, f: [0.416, 0.973], m: [0.367, 0.826] },
  { from: 40, f: [0.525, 1.41], m: [0.498, 1.22] },
  { from: 45, f: [0.569, 1.70], m: [0.584, 1.61] },
  { from: 50, f: [0.623, 2.00], m: [0.647, 2.01] },
  { from: 55, f: [0.679, 2.41], m: [0.695, 2.33] },
  { from: 60, f: [0.678, 2.81], m: [0.711, 2.69] },
  { from: 65, f: [0.685, 3.07], m: [0.718, 3.00] },
  { from: 70, f: [0.681, 3.24], m: [0.741, 3.34] },
  { from: 75, f: [0.718, 3.64], m: [0.765, 3.65] },
  { from: 80, f: [0.726, 3.81], m: [0.811, 4.05] },
];
/** Grams a day for this age and sex (South Asia). */
export function southAsiaLimits(age: number, sex: Sex): { lowestG: number; noHarmG: number; band: string; src: SourceId } | null {
  if (!(age >= 15)) return null;
  const row = [...SOUTH_ASIA].reverse().find((r) => age >= r.from)!;
  const [lowest, noHarm] = sex === "female" ? row.f : row.m;
  const next = SOUTH_ASIA.find((r) => r.from > row.from);
  return { lowestG: lowest * STANDARD_DRINK_G, noHarmG: noHarm * STANDARD_DRINK_G, band: next ? `${row.from}–${next.from - 1}` : `${row.from}+`, src: "gbd2022" };
}

/** Life expectancy at 40 vs drinking up to 100 g a week (Wood 2018, 19 high-income countries, US death rates). */
export function lifeYearsAt40(gPerWeek: number): { text: string; band: string; src: SourceId } | null {
  if (gPerWeek <= 100) return null;
  if (gPerWeek <= 200) return { text: "about 6 months shorter", band: "100–200 g a week", src: "wood2018" };
  if (gPerWeek <= 350) return { text: "about 1–2 years shorter", band: "200–350 g a week", src: "wood2018" };
  return { text: "about 4–5 years shorter", band: "over 350 g a week", src: "wood2018" };
}

export type DrinkBand = "light" | "moderate" | "heavy";
/** Bagnardi 2015 bands, average grams a day: light ≤ 12.5, moderate ≤ 50, heavy > 50. */
export const drinkBand = (gPerDay: number): DrinkBand | null => (gPerDay <= 0 ? null : gPerDay <= 12.5 ? "light" : gPerDay <= 50 ? "moderate" : "heavy");

type R = { rr: number; lo: number; hi: number };
/** Cancer risk by drinking band vs non-drinkers (Bagnardi 2015, Figure 2). A range that includes 1 = no clear rise. */
export const ALCOHOL_CANCERS: { id: string; name: string; only?: Sex; light: R; moderate: R; heavy: R; asiaLight?: R }[] = [
  { id: "mouth", name: "Mouth & throat cancer", light: { rr: 1.13, lo: 1.00, hi: 1.26 }, moderate: { rr: 1.83, lo: 1.62, hi: 2.07 }, heavy: { rr: 5.13, lo: 4.31, hi: 6.10 }, asiaLight: { rr: 1.33, lo: 1.06, hi: 1.68 } },
  { id: "oesophagus", name: "Food-pipe cancer", light: { rr: 1.26, lo: 1.06, hi: 1.50 }, moderate: { rr: 2.23, lo: 1.87, hi: 2.65 }, heavy: { rr: 4.95, lo: 3.86, hi: 6.34 }, asiaLight: { rr: 1.54, lo: 1.18, hi: 2.00 } },
  { id: "larynx", name: "Voice-box cancer", light: { rr: 0.87, lo: 0.68, hi: 1.11 }, moderate: { rr: 1.44, lo: 1.25, hi: 1.66 }, heavy: { rr: 2.65, lo: 2.19, hi: 3.19 } },
  { id: "liver", name: "Liver cancer", light: { rr: 1.00, lo: 0.85, hi: 1.18 }, moderate: { rr: 1.08, lo: 0.97, hi: 1.20 }, heavy: { rr: 2.07, lo: 1.66, hi: 2.58 } },
  { id: "colorectum", name: "Bowel cancer", light: { rr: 0.99, lo: 0.95, hi: 1.04 }, moderate: { rr: 1.17, lo: 1.11, hi: 1.24 }, heavy: { rr: 1.44, lo: 1.25, hi: 1.65 } },
  { id: "breast", name: "Breast cancer", only: "female", light: { rr: 1.04, lo: 1.01, hi: 1.07 }, moderate: { rr: 1.23, lo: 1.19, hi: 1.28 }, heavy: { rr: 1.61, lo: 1.33, hi: 1.94 } },
];
export const ALCOHOL_CANCER_SRC: SourceId = "bagnardi2015";
export const ASIA_NOTE = "In Asian studies even light drinking raised mouth and food-pipe cancer (1.33× and 1.54×); the authors link it to a gene variant (ALDH2) carried by 28–45 % of people in Asian countries.";

/** Wood 2018, per 100 g a week more, among people who drink (between two intakes, not vs non-drinkers). */
export const PER_100G_WEEK = { stroke: 1.14, heartFailure: 1.09, src: "wood2018" as SourceId };

/** Breast cancer +7.1 % (5.5–8.7) per 10 g a day (Hamajima 2002). */
export const breastPer10g = (gPerDay: number) => 1.071 ** (gPerDay / 10);
/** Irregular heartbeat (AF), men: +8 % per 12 g drink a day (Jiang 2022; the women's curve isn't straight, so no figure for women). */
export const afMen = (gPerDay: number) => 1.08 ** (gPerDay / 12);

/** Blood pressure drop (mmHg, systolic / diastolic) when heavy drinkers cut down by about half (Roerecke 2017, 12 g drinks). */
export function bpPayoff(gPerDay: number): { sys: number; dia: number; src: SourceId } | null {
  if (gPerDay >= 72) return { sys: 5.5, dia: 4.0, src: "roerecke2017" };
  if (gPerDay >= 48) return { sys: 3.0, dia: 1.9, src: "roerecke2017" };
  if (gPerDay >= 36) return { sys: 1.2, dia: 1.1, src: "roerecke2017" };
  return null;
}

/** Liver cirrhosis, women, by 12 g drinks a day (Roerecke 2019; cohorts mostly counted cirrhosis deaths). */
export function cirrhosisWomen(gPerDay: number): { rr: number; lo: number; hi: number; src: SourceId } | null {
  if (gPerDay < 12) return null;
  if (gPerDay < 24) return { rr: 1.64, lo: 1.07, hi: 2.51, src: "roerecke2019" };
  if (gPerDay < 36) return { rr: 4.33, lo: 2.59, hi: 7.25, src: "roerecke2019" };
  if (gPerDay < 60) return { rr: 3.87, lo: 0.80, hi: 18.83, src: "roerecke2019" };
  if (gPerDay < 84) return { rr: 12.44, lo: 6.65, hi: 23.27, src: "roerecke2019" };
  return { rr: 24.58, lo: 14.77, hi: 40.9, src: "roerecke2019" };
}
