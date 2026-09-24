// Ranking knobs shared by the app (lib/foods.ts) and scripts/eval-parse.mts, so the eval matches
// foods exactly like production. Pure: types-only import.
import type { Food } from "../types";

/** Everyday staples: shown before the user has history, and they win ties in search/matching. */
export const STARTER_IDS = [
  "chapati-roti", "boiled-rice", "moong-dal-tadka", "rajma", "aloo-gobi", "veg-poha",
  "idli", "egg-boiled", "dahi", "chai", "banana", "jeera-rice", "white-bread",
];
const STARTER = new Set(STARTER_IDS);

/** Small tie-breakers (never enough to hide a real ambiguity): own foods > staples > veg. */
export const matchBoost = (f: Food) =>
  (f.conf === "user" ? 0.03 : STARTER.has(f.id) ? 0.02 : 0) + (f.diet === "veg" || f.diet === "vegan" ? 0.01 : 0);
