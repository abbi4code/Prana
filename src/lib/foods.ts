import data from "@/data/foods.generated.json";
import type { Category, Food, FoodUnit } from "./types";

export const FOODS = data as Food[];
const BY_ID = new Map(FOODS.map((f) => [f.id, f]));

export const getFood = (id: string) => BY_ID.get(id);
export const getUnit = (food: Food, unitId: string): FoodUnit =>
  food.units.find((u) => u.id === unitId) ?? food.units[0];

/** Shown before the user has any history. */
export const STARTER_IDS = [
  "chapati-roti", "boiled-rice", "moong-dal-tadka", "rajma", "aloo-gobi", "veg-poha",
  "idli", "egg-boiled", "curd-rice", "hot-tea", "banana", "milk-cow",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  breakfast: "Breakfast", roti_bread: "Roti & breads", rice: "Rice", dal: "Dal", sabzi: "Sabzi",
  paneer: "Paneer", egg: "Egg", non_veg: "Non-veg", snack: "Snacks", sweet: "Mithai",
  dairy: "Dairy", fruit: "Fruit", beverage: "Drinks", condiment: "Chutney & extras", nuts: "Nuts", soup: "Soup",
};

// letters (any script, incl. Devanagari matras), digits; everything else becomes a space
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();

type Indexed = { food: Food; name: string; alt: string[]; compact: string; cat: string };
const INDEX: Indexed[] = FOODS.map((food) => {
  const name = norm(food.name);
  const alt = [...food.aliases.map(norm), food.hi ?? "", norm(food.id)].filter(Boolean);
  return { food, name, alt, compact: [name, ...alt].join(" ").replace(/ /g, ""), cat: norm(CATEGORY_LABEL[food.cat]) };
});

function scoreToken(it: Indexed, t: string): number {
  if (it.name.startsWith(t)) return 100;
  if (it.name.split(" ").some((w) => w.startsWith(t))) return 80;
  if (it.alt.some((a) => a.startsWith(t) || a.split(" ").some((w) => w.startsWith(t)))) return 65;
  if (it.name.includes(t)) return 50;
  if (it.compact.includes(t)) return 35;
  return 0;
}

/** Hinglish-friendly search over names, aliases, Hindi names and ids. Every token must match. */
export function searchFoods(query: string, limit = 40): Food[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(" ");
  const joined = q.replace(/ /g, "");
  const scored: { food: Food; s: number }[] = [];
  for (const it of INDEX) {
    let s = 0;
    for (const t of tokens) {
      const ts = scoreToken(it, t);
      if (!ts) { s = 0; break; }
      s += ts + (it.cat.startsWith(t) ? 25 : 0); // "dal" should surface dals before dal paratha
    }
    if (!s && tokens.length > 1 && it.compact.includes(joined)) s = 40; // "palakpaneer" ↔ "palak paneer"
    if (s) scored.push({ food: it.food, s: s - it.name.length * 0.1 - (it.food.uncooked ? 30 : 0) });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.food);
}

