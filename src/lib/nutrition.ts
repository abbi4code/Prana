import { energy } from "./energy";
import type { Entry, Food, FoodUnit, Goals, Meal, Profile } from "./types";

export const MEALS: { id: Meal; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snacks", label: "Chai & Snacks" },
  { id: "dinner", label: "Dinner" },
];

export function mealForNow(d = new Date()): Meal {
  const h = d.getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 19) return "snacks";
  return "dinner";
}

export function portion(food: Food, unit: FoodUnit, qty: number) {
  const grams = unit.g * qty;
  const k = grams / 100;
  const m = (v: number | null) => (v == null ? null : Math.round(v * k * 10) / 10);
  return { grams: Math.round(grams), kcal: Math.round(food.kcal * k), p: m(food.p), c: m(food.c), f: m(food.f) };
}

export function totals(entries: Entry[]) {
  return entries.reduce(
    (t, e) => ({ kcal: t.kcal + e.kcal, p: t.p + (e.p ?? 0), c: t.c + (e.c ?? 0), f: t.f + (e.f ?? 0) }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

export const DEFAULT_GOALS: Goals = { kcal: 2000, p: 90, c: 250, f: 65 };

/** Mifflin–St Jeor BMR × activity, adjusted for the aim (lib/energy.ts). Protein 1.6 g/kg, fat 25% of kcal, rest carbs. */
export function suggestGoals(p: Profile): Goals {
  const kcal = energy(p).goal;
  const protein = Math.round(p.weightKg * 1.6);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, p: protein, c: carbs, f: fat };
}

/** Sensible step and quick-pick amounts per unit kind. */
export function qtyOptions(kind: FoodUnit["kind"]) {
  if (kind === "g") return { step: 10, min: 10, picks: [50, 100, 150, 200] };
  if (kind === "tsp" || kind === "tbsp" || kind === "scoop") return { step: 1, min: 1, picks: [1, 2, 3] };
  if (kind === "piece" || kind === "pack") return { step: 1, min: 0.5, picks: [1, 2, 3, 4] };
  return { step: 0.5, min: 0.25, picks: [0.5, 1, 1.5, 2] };
}

export const fmtQty = (q: number) => {
  const whole = Math.floor(q);
  const frac = q - whole;
  const f = frac === 0.5 ? "½" : frac === 0.25 ? "¼" : frac === 0.75 ? "¾" : frac ? frac.toFixed(1).slice(1) : "";
  return whole ? `${whole}${f}` : f || "0";
};
