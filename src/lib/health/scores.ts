// Body report scores (D55). PURE, node-runnable. Verified in .claude/habits.md ("H5 review").
import type { SourceId } from "./sources.ts";
import type { Sex } from "./tobacco.ts";

// ── BMI and waist for Indians ──

/** WHO 2004 Asian action points (public-health risk): < 18.5 underweight, 18.5–23 acceptable, 23–27.5 increased, ≥ 27.5 high. */
export function asianBmi(bmi: number): { label: string; tone: "leaf" | "turmeric" | "saffron" | "chilli" | "sky"; src: SourceId } {
  if (bmi < 18.5) return { label: "Underweight", tone: "sky", src: "who2004" };
  if (bmi < 23) return { label: "Healthy range for Asians", tone: "leaf", src: "who2004" };
  if (bmi < 27.5) return { label: "Increased risk", tone: "turmeric", src: "who2004" };
  return { label: "High risk", tone: "saffron", src: "who2004" };
}

/** Indian consensus waist action level (2009, restated 2025): men ≥ 90 cm, women ≥ 80 cm. */
export const WAIST_LIMIT = { male: 90, female: 80, src: "misra2025" as SourceId };
/** Waist-to-height above 0.5 counts as excess (Indian obesity definition 2025, citing Gibson & Ashwell). */
export const WHTR_LIMIT = 0.5;

/**
 * Indian obesity definition 2025 (Misra et al.). Stage 1: BMI > 23 with no symptoms or obesity-related disease.
 * Stage 2: BMI > 23 + excess waist or waist-to-height + symptoms or disease. We only know "disease" from the answers
 * (diabetes, high BP), so stage 2 can be shown but symptoms are not asked.
 */
export function indianObesity(bmi: number, excessWaist: boolean | null, disease: boolean): "none" | "stage1" | "stage2" | "unclear" {
  if (!(bmi > 23)) return "none";
  if (disease && excessWaist) return "stage2";
  if (disease && excessWaist === null) return "unclear";
  if (!disease) return "stage1";
  return "unclear"; // disease with a normal waist fits neither stage (edge case in the paper)
}

// ── WHO 2019 CVD risk chart, non-laboratory, South Asia ──

export type WhoGrid = Record<"men" | "women", Record<"nonsmoker" | "smoker", Record<string, Record<string, number[]>>>>;
const AGE_BANDS = ["40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74"];
const SBP_BANDS = ["<120", "120-139", "140-159", "160-179", ">=180"];

/**
 * 10-year risk (%) of a fatal or non-fatal heart attack or stroke from the printed chart: sex → smoker → age band →
 * systolic BP band → BMI band. Ages 40–74 only (null otherwise). Screening / education, not a diagnosis.
 */
export function whoCvdRisk(grid: WhoGrid, i: { sex: Sex; age: number; smoker: boolean; sys: number; bmi: number }): { pct: number; ageBand: string; sbpBand: string; bmiBand: string } | null {
  if (!(i.age >= 40 && i.age < 75) || !(i.sys > 0) || !(i.bmi > 0)) return null;
  const ageBand = AGE_BANDS[Math.min(6, Math.floor((i.age - 40) / 5))];
  const sbpIdx = i.sys < 120 ? 0 : i.sys < 140 ? 1 : i.sys < 160 ? 2 : i.sys < 180 ? 3 : 4;
  const bmiIdx = i.bmi < 20 ? 0 : i.bmi < 25 ? 1 : i.bmi < 30 ? 2 : i.bmi < 35 ? 3 : 4;
  const row = grid[i.sex === "male" ? "men" : "women"][i.smoker ? "smoker" : "nonsmoker"][ageBand]?.[SBP_BANDS[sbpIdx]];
  if (!row) return null;
  return { pct: row[bmiIdx], ageBand, sbpBand: SBP_BANDS[sbpIdx].replace(">=", "≥"), bmiBand: ["<20", "20–24", "25–29", "30–34", "≥35"][bmiIdx] };
}
/** WHO chart colours: < 5 green, 5–10 yellow, 10–20 orange, 20–30 red, ≥ 30 dark red. */
export const whoBand = (pct: number) =>
  pct < 5 ? { label: "under 5 %", tone: "leaf" as const } : pct < 10 ? { label: "5–10 %", tone: "turmeric" as const } : pct < 20 ? { label: "10–20 %", tone: "saffron" as const } : pct < 30 ? { label: "20–30 %", tone: "chilli" as const } : { label: "30 % or more", tone: "chilli" as const };

// ── INTERHEART non-laboratory risk score (0–48) ──

export type InterheartInput = {
  sex: Sex;
  age: number;
  /** "never" | "former" (last smoked > 12 months ago) | current smokes a day */
  smoking: "never" | "former" | number;
  secondHand?: boolean;
  diabetes?: boolean;
  highBp?: boolean;
  parentHeart?: boolean;
  /** waist ÷ hip */
  whr?: number | null;
  stress?: boolean;
  lowMood?: boolean;
  saltyDaily?: boolean;
  friedOften?: boolean;
  fruitDaily?: boolean;
  vegDaily?: boolean;
  meatTwiceDaily?: boolean;
  /** leisure mainly sedentary or mild exercise */
  sedentary?: boolean;
};
export type InterheartItem = { id: string; label: string; points: number; changeable: boolean };

/** Points per item (Joseph 2018 supplement Table 1 = McGorrian 2011 non-lab score). Unknown answers count 0 and are listed as missing. */
export function interheartPoints(i: InterheartInput): { total: number; items: InterheartItem[] } {
  const items: InterheartItem[] = [];
  const add = (id: string, label: string, points: number, changeable: boolean) => points && items.push({ id, label, points, changeable });
  add("age", i.sex === "male" ? "Man 55 or older" : "Woman 65 or older", (i.sex === "male" ? i.age >= 55 : i.age >= 65) ? 2 : 0, false);
  if (i.smoking === "former") add("smoking", "Former smoker", 2, false);
  else if (typeof i.smoking === "number" && i.smoking > 0) {
    const n = i.smoking;
    add("smoking", `Smoking ${Math.round(n)} a day`, n <= 5 ? 2 : n <= 10 ? 4 : n <= 15 ? 6 : n <= 20 ? 7 : 11, true);
  }
  add("secondHand", "Second-hand smoke, 1 h+ a week", i.secondHand ? 2 : 0, true);
  add("diabetes", "Diabetes", i.diabetes ? 6 : 0, false);
  add("highBp", "High blood pressure", i.highBp ? 5 : 0, true);
  add("parentHeart", "A parent had a heart attack", i.parentHeart ? 4 : 0, false);
  if (i.whr != null) add("whr", `Waist ÷ hip ${i.whr.toFixed(2)}`, i.whr < 0.873 ? 0 : i.whr < 0.964 ? 2 : 4, true);
  add("stress", "Stress at work or home, often", i.stress ? 3 : 0, true);
  add("lowMood", "Felt low for 2+ weeks this year", i.lowMood ? 3 : 0, true);
  add("salty", "Salty food or snacks daily", i.saltyDaily ? 1 : 0, true);
  add("fried", "Fried or fast food 3+ times a week", i.friedOften ? 1 : 0, true);
  if (i.fruitDaily === false) add("fruit", "Fruit less than once a day", 1, true);
  if (i.vegDaily === false) add("veg", "Vegetables less than once a day", 1, true);
  add("meat", "Meat twice a day or more", i.meatTwiceDaily ? 2 : 0, true);
  add("sedentary", "Little or light exercise", i.sedentary ? 2 : 0, true);
  return { total: items.reduce((t, x) => t + x.points, 0), items };
}

/**
 * Points → 7-year risk (%) of heart attack, stroke or heart failure, South Asia (PURE, Joseph 2018):
 * PI = −1.45 + 0.2875 × (points / 2); risk = 1 / (1 + e^−(−3.03 + 0.75 × PI)). 0 → 1.6 %, 16 → 8.4 %.
 */
export function interheartRisk(points: number) {
  const pi = -1.45 + 0.2875 * (points / 2);
  return 100 / (1 + Math.exp(-(-3.03 + 0.75 * pi)));
}

// ── Indian Diabetes Risk Score (IDRS) ──

export type IdrsInput = { sex: Sex; age: number; waistCm: number | null; activity?: "vigorous" | "moderate" | "mild" | "none"; parentsDiabetes?: 0 | 1 | 2 };
/** Mohan 2005 (activity in the 4-level form of ICMR-INDIAB): < 30 low, 30–50 moderate, ≥ 60 high. null until age, waist, activity and family history are known. */
export function idrs(i: IdrsInput): { score: number; band: "low" | "moderate" | "high"; parts: { label: string; points: number }[] } | null {
  if (!(i.age > 0) || i.waistCm == null || !i.activity || i.parentsDiabetes == null) return null;
  const age = i.age < 35 ? 0 : i.age < 50 ? 20 : 30;
  const w = i.waistCm, [a, b] = i.sex === "male" ? [90, 100] : [80, 90];
  const waist = w < a ? 0 : w < b ? 10 : 20;
  const act = { vigorous: 0, moderate: 10, mild: 20, none: 30 }[i.activity];
  const fam = i.parentsDiabetes * 10;
  const score = age + waist + act + fam;
  return {
    score,
    band: score >= 60 ? "high" : score >= 30 ? "moderate" : "low",
    parts: [{ label: "Age", points: age }, { label: "Waist", points: waist }, { label: "Activity", points: act }, { label: "Family history", points: fam }],
  };
}
