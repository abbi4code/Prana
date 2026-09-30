// Tobacco → risk, per disease (D55). PURE, node-runnable. Every number is from the verified research in
// .claude/habits.md ("H1 review", "H1 part 2 review", "H2 review"); nothing here is estimated by us except the
// interpolation rules written next to each model (the papers' own model forms).
import type { SourceId } from "./sources.ts";

export type Sex = "male" | "female";

/** A relative risk vs never users (rr 1 = same as a non-smoker). lo / hi = the published 95 % CI (99 % for Jha 2008). */
export type Risk = {
  rr: number;
  lo?: number;
  hi?: number;
  /** the daily amount is above what the study modelled: this is the top of its range, the real risk may be higher */
  capped?: boolean;
  /** how the paper measured it */
  measure: "risk" | "odds" | "death rate";
};

export type Group = "heart" | "lungs" | "cancer" | "body";

export type DiseaseModel = {
  id: string;
  name: string;
  group: Group;
  src: SourceId;
  /** only for this sex (breast cancer, erectile dysfunction) */
  only?: Sex;
  /** true: the number moves with the daily amount; false: current smoker vs never, any amount */
  dose: boolean;
  /** risk at `perDay` smokes a day (> 0) for this sex; null = no estimate */
  at: (perDay: number, sex: Sex) => Risk | null;
  /** one line of fine print: population, caveat */
  note: string;
};

// ── helpers ──

type Pt = { x: number; rr: number; lo?: number; hi?: number };

/**
 * Log-linear between published points (Hackshaw 2018 modelled ln RR linear in consumption between 1 and ~20 a day).
 * Below the first point the first point's value (never-smokers were left out of the fit, so 0 → 1 a day is a jump,
 * not a line); above the last point the last value, flagged `capped`.
 */
function logLinear(points: Pt[], x: number, measure: Risk["measure"]): Risk {
  if (x <= points[0].x) return { ...pick(points[0]), measure };
  const last = points[points.length - 1];
  if (x >= last.x) return { ...pick(last), measure, capped: x > last.x };
  const i = points.findIndex((p) => p.x >= x);
  const a = points[i - 1], b = points[i];
  const t = (x - a.x) / (b.x - a.x);
  const lerp = (u?: number, v?: number) => (u && v ? Math.exp(Math.log(u) + t * (Math.log(v) - Math.log(u))) : undefined);
  return { rr: lerp(a.rr, b.rr)!, lo: lerp(a.lo, b.lo), hi: lerp(a.hi, b.hi), measure };
}
const pick = (p: Pt) => ({ rr: p.rr, lo: p.lo, hi: p.hi });

/** Bands by cigarettes a day: [upper limit inclusive, value]; the last band is open-ended. */
function band(bands: [number, Omit<Risk, "measure">][], x: number, measure: Risk["measure"]): Risk {
  for (const [max, r] of bands) if (x <= max) return { ...r, measure };
  return { ...bands[bands.length - 1][1], measure };
}

/** Restricted cubic spline with 3 knots (Harrell), as printed in the Mario Negri papers' Supplementary Box 2. */
function rcs3(x: number, t1: number, t2: number, [k1, k2, k3]: [number, number, number]) {
  const p = (v: number) => Math.max(v, 0) ** 3;
  const x2 = (p(x - k1) - ((k3 - k1) / (k3 - k2)) * p(x - k2) + ((k2 - k1) / (k3 - k2)) * p(x - k3)) / (k3 - k1) ** 2;
  return Math.exp(t1 * x + t2 * x2);
}

/** Spline curves are only shown up to 40 a day (the papers' data thin out beyond it). */
const CURVE_MAX = 40;

// ── curves from the dose-response meta-analyses (Supplementary Box 2 equations, checked to reproduce the printed values) ──

/** Possenti 2026: oral cavity + pharynx. 5 → 1.78, 10 → 2.88, 20 → 4.80. */
export function oralCurve(x: number) {
  const f =
    x < 10 ? 0.117997 * x - 0.000121424 * x ** 3
    : x < 31 ? 0.0000578211 * x ** 3 - 0.00537736 * x ** 2 + 0.171771 * x - 0.179245
    : 0.00507255 * x + 1.5433;
  return Math.exp(f);
}
/** Rota 2024: stomach. 5 → 1.22, 10 → 1.45, 20 → 1.69. */
export function stomachCurve(x: number) {
  const f =
    x < 10.5 ? -0.0000463714 * x ** 3 + 0.041631 * x
    : x < 30 ? 0.0000249692 * x ** 3 - 0.00224723 * x ** 2 + 0.0652269 * x - 0.0825856
    : -0.0021899 * x + 0.591583;
  return Math.exp(f);
}
/** Lugo 2018: pancreas. 5 → 1.31, 10 → 1.64, 20 → 2.06, 30 → 2.15. */
export const pancreasCurve = (x: number) => rcs3(x, 0.0558513, -0.05321974, [0, 10, 29.5]);
/** Liu 2019: kidney. 5 → 1.18, 10 → 1.36, 20 → 1.61. */
export const kidneyCurve = (x: number) => rcs3(x, 0.03375772, -0.02600142, [0, 11.5, 30.5]);

const curve = (fn: (x: number) => number) => (x: number): Risk => ({ rr: fn(Math.min(x, CURVE_MAX)), measure: "risk", capped: x > CURVE_MAX });

// ── the disease list (smoked tobacco: cigarettes + bidis a day) ──

export const SMOKING: DiseaseModel[] = [
  {
    id: "heart-attack", name: "Heart attack & heart disease", group: "heart", src: "hackshaw2018", dose: true,
    note: "Even 1 a day carries a large share of the risk of 20: cutting down helps the heart far less than quitting. Modelled from 1 to 20 a day.",
    at: (x, sex) => logLinear(sex === "male"
      ? [{ x: 1, rr: 1.48, lo: 1.30, hi: 1.69 }, { x: 5, rr: 1.58, lo: 1.39, hi: 1.80 }, { x: 20, rr: 2.04, lo: 1.86, hi: 2.24 }]
      : [{ x: 1, rr: 1.57, lo: 1.29, hi: 1.91 }, { x: 5, rr: 1.76, lo: 1.46, hi: 2.13 }, { x: 20, rr: 2.84, lo: 2.21, hi: 3.64 }], x, "risk"),
  },
  {
    id: "stroke", name: "Stroke", group: "heart", src: "hackshaw2018", dose: true,
    note: "Modelled from 1 to 20 a day. Both clot and bleeding strokes rise in smokers.",
    at: (x, sex) => logLinear(sex === "male"
      ? [{ x: 1, rr: 1.25, lo: 1.13, hi: 1.38 }, { x: 5, rr: 1.30, lo: 1.18, hi: 1.43 }, { x: 20, rr: 1.64, lo: 1.48, hi: 1.82 }]
      : [{ x: 1, rr: 1.31, lo: 1.13, hi: 1.52 }, { x: 5, rr: 1.44, lo: 1.22, hi: 1.70 }, { x: 20, rr: 2.16, lo: 1.69, hi: 2.75 }], x, "risk"),
  },
  {
    id: "heart-failure", name: "Heart failure", group: "heart", src: "banks2019", dose: true,
    note: "Hospital admission or death; adults 45+ in Australia.",
    at: (x) => band([[14, { rr: 1.70, lo: 1.36, hi: 2.12 }], [24, { rr: 2.51, lo: 2.06, hi: 3.04 }], [Infinity, { rr: 3.91, lo: 3.17, hi: 4.83 }]], x, "risk"),
  },
  {
    id: "leg-arteries", name: "Blocked leg arteries", group: "heart", src: "banks2019", dose: true,
    note: "Peripheral artery disease: pain on walking, and the main cause of amputations in smokers. Adults 45+ in Australia.",
    at: (x) => band([[14, { rr: 3.49, lo: 2.81, hi: 4.34 }], [24, { rr: 5.89, lo: 4.94, hi: 7.02 }], [Infinity, { rr: 7.26, lo: 5.95, hi: 8.88 }]], x, "risk"),
  },
  {
    id: "lung-cancer", name: "Lung cancer", group: "lungs", src: "doll2004", dose: true,
    note: "Death rates vs lifelong non-smokers in 50 years of British male doctors (no confidence interval printed). Rises roughly in step with the amount, so cutting down helps here.",
    at: (x) => band([[14, { rr: 7.7 }], [24, { rr: 13.7 }], [Infinity, { rr: 24.5 }]], x, "death rate"),
  },
  {
    id: "copd", name: "COPD (lasting lung damage)", group: "lungs", src: "doll2004", dose: true,
    note: "Death rates vs lifelong non-smokers, British male doctors. In India cooking smoke also causes COPD.",
    at: (x) => band([[14, { rr: 9.5 }], [24, { rr: 12.8 }], [Infinity, { rr: 23.7 }]], x, "death rate"),
  },
  {
    id: "tb", name: "Dying of TB", group: "lungs", src: "jha2008", dose: false,
    note: "Indian data, ages 30–69, any amount of bidis or cigarettes (99 % range). TB is treatable: smoking makes it more likely to turn serious.",
    at: (_x, sex) => (sex === "male" ? { rr: 2.3, lo: 2.1, hi: 2.6, measure: "death rate" } : { rr: 3.0, lo: 2.4, hi: 3.9, measure: "death rate" }),
  },
  {
    id: "mouth-cancer", name: "Mouth & throat cancer", group: "cancer", src: "possenti2026", dose: true,
    note: "Worldwide curve incl. 17 Indian studies; in Asian studies the rise was smaller (2.3× for current smokers vs 3.6× overall).",
    at: curve(oralCurve),
  },
  {
    id: "stomach-cancer", name: "Stomach cancer", group: "cancer", src: "rota2024", dose: true,
    note: "Worldwide curve incl. 12 Indian studies; levels off above ~20 a day.",
    at: curve(stomachCurve),
  },
  {
    id: "pancreas-cancer", name: "Pancreas cancer", group: "cancer", src: "lugo2018", dose: true,
    note: "Worldwide curve; even a few a day raise it.",
    at: curve(pancreasCurve),
  },
  {
    id: "kidney-cancer", name: "Kidney cancer", group: "cancer", src: "liu2019", dose: true,
    note: "Worldwide curve.",
    at: curve(kidneyCurve),
  },
  {
    id: "breast-cancer", name: "Breast cancer", group: "cancer", src: "scala2023", only: "female", dose: true,
    note: "A small rise: about +12 % at 20 a day.",
    at: (x) => ({ rr: Math.exp(0.005774 * Math.min(x, CURVE_MAX)), measure: "risk", capped: x > CURVE_MAX }),
  },
  {
    id: "diabetes", name: "Type 2 diabetes", group: "body", src: "pan2015", dose: true,
    note: "88 studies; bands are roughly under 10, 10–19 and 20+ a day. Risk rises for a few years right after quitting (often weight gain), then falls.",
    at: (x) => band([[9, { rr: 1.21, lo: 1.10, hi: 1.33 }], [19, { rr: 1.34, lo: 1.27, hi: 1.41 }], [Infinity, { rr: 1.57, lo: 1.47, hi: 1.66 }]], x, "risk"),
  },
  {
    id: "dementia", name: "Dementia", group: "body", src: "zhong2015", dose: false,
    note: "Current smokers vs never, 17 studies. People who had quit showed no extra risk.",
    at: () => ({ rr: 1.30, lo: 1.18, hi: 1.45, measure: "risk" }),
  },
  {
    id: "gums", name: "Gum disease (teeth loosen)", group: "body", src: "leite2018", dose: false,
    note: "Smokers vs non-smokers, 14 prospective studies. People who quit came back to a non-smoker's risk.",
    at: () => ({ rr: 1.85, lo: 1.5, hi: 2.2, measure: "risk" }),
  },
  {
    id: "hip-fracture", name: "Hip fracture", group: "body", src: "kanis2005", dose: false,
    note: "Current smokers, 10 cohorts (mostly older adults).",
    at: () => ({ rr: 1.84, lo: 1.52, hi: 2.22, measure: "risk" }),
  },
  {
    id: "erection", name: "Erection problems", group: "body", src: "cao2014", only: "male", dose: true,
    note: "The odds rise about 14 % for every extra 10 a day (1.14 per 10, range 1.09–1.18); the study didn't report a figure vs non-smokers.",
    at: (x) => ({ rr: 1.14 ** (Math.min(x, CURVE_MAX) / 10), measure: "odds", capped: x > CURVE_MAX }),
  },
];

// ── whole-life numbers ──

/** India, men aged 30–69, death from any medical cause (99 % CIs only in the supplement, not shown). */
export function allCauseIndia(cigs: number, bidis: number, sex: Sex): (Risk & { src: SourceId; label: string }) | null {
  const total = cigs + bidis;
  if (total <= 0) return null;
  if (sex === "female") return { rr: 2.0, lo: 1.8, hi: 2.3, measure: "death rate", src: "jha2008", label: "women who smoke, any amount" };
  const bidiMostly = bidis > cigs;
  const heavy = total >= 8;
  return bidiMostly
    ? { rr: heavy ? 2.2 : 1.3, measure: "death rate", src: "jha2008", label: heavy ? "men, 8+ bidis a day" : "men, 1–7 bidis a day" }
    : { rr: heavy ? 2.9 : 1.8, measure: "death rate", src: "jha2008", label: heavy ? "men, 8+ cigarettes a day" : "men, 1–7 cigarettes a day" };
}

/** Years of life lost vs non-smokers, India (median survival, 99 % CI). */
export const YEARS_LOST_INDIA = { male: { years: 6, lo: 5, hi: 7 }, female: { years: 8, lo: 5, hi: 11 }, src: "jha2008" as SourceId };

/** Minutes of life expectancy per cigarette, population average (Jackson 2025). Cigarettes only, not bidis. */
export const MINUTES_PER_CIGARETTE = { male: 17, female: 22, any: 20, src: "jackson2025" as SourceId };

// ── chewing tobacco (gutka, khaini, zarda, paan with tobacco) ──

export const CHEWING = {
  oral: { rr: 7.46, lo: 5.86, hi: 9.50, src: "gupta2014" as SourceId, note: "Smokeless tobacco and mouth cancer, South Asian case-control studies. No pooled dose curve exists." },
  paanWomen: { rr: 14.56, lo: 7.63, hi: 27.76, src: "guha2014" as SourceId, note: "Paan with tobacco, women in the Indian subcontinent (mouth and throat cancer)." },
  heart: { rr: 2.23, lo: 1.41, hi: 3.52, src: "teo2006" as SourceId, note: "Heart attack, chewing tobacco only." },
  smokeAndChew: { rr: 4.09, lo: 2.98, hi: 5.61, src: "teo2006" as SourceId, note: "Heart attack, smoking and chewing." },
  oesophagus: { rr: 3.65, lo: 1.59, hi: 8.38, src: "pednekar2011" as SourceId, note: "Food-pipe cancer, Mumbai men who chew." },
};

// ── hookah: exposure per session vs one cigarette (inhaled amounts, not disease risk) ──

export const HOOKAH_PER_SESSION = {
  src: "primack2016" as SourceId,
  tarX: 25, coX: 11, nicotineCigs: "2–3",
  note: "Measured per session vs one cigarette: about 25× the tar and 11× the carbon monoxide (mostly from the charcoal), and the nicotine of 2–3 cigarettes. Long-term disease studies of hookah are few and small.",
};

// ── vaping: what's known (NASEM 2018 levels of evidence) ──

export const VAPE_FACTS: { text: string; level: "conclusive" | "substantial" | "moderate" | "none" }[] = [
  { text: "Heart rate goes up right after vaping", level: "substantial" },
  { text: "Nicotine vapes cause dependence", level: "substantial" },
  { text: "Switching completely from cigarettes lowers exposure to toxic substances", level: "conclusive" },
  { text: "Long-term heart disease, lung disease or cancer from vaping", level: "none" },
];

/** Hashibe 2009 (India not included): mouth / throat / voice-box cancer vs neither habit. */
export const TOBACCO_X_ALCOHOL = {
  src: "hashibe2009" as SourceId,
  grid: [
    { tobacco: "none", alcohol: "1–2 drinks a day", or: 1.03 },
    { tobacco: "none", alcohol: "3+ drinks a day", or: 1.91 },
    { tobacco: "1–20 a day", alcohol: "none", or: 2.20 },
    { tobacco: "1–20 a day", alcohol: "3+ drinks a day", or: 9.92 },
    { tobacco: "20+ a day", alcohol: "none", or: 4.15 },
    { tobacco: "20+ a day", alcohol: "3+ drinks a day", or: 14.23 },
  ],
};
