// One research-format food (data/*.json, data/foods-research.json, a research candidate) → the app's Food
// (lib/types.ts). PURE and node-runnable: used by scripts/build-foods.mjs (the built-in catalog) and by the server
// research agent (D54 shared foods), so both paths shape foods the same way.
import type { Category, Food, FoodUnit, UnitKind } from "../types.ts";

/** A research row as the data files store it (per 100 g values already verified). */
export type SourceFood = {
  id: string; name: string; name_hi?: string | null; category: string; diet: string; form?: string;
  per_100g: { kcal: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null; fiber_g?: number | null; alcohol_g?: number | null };
  units: { unit: string; label: string; grams: number }[]; default_unit: string;
  source: { id: string }; confidence: string; notes?: string | null;
};

// D07: every unit maps onto one canonical kind; the friendly text stays in `label`.
export const KIND: Record<string, UnitKind> = {
  katori: "katori",
  bowl: "bowl", small_bowl: "bowl", soup_bowl: "bowl", curry_bowl: "bowl",
  plate: "plate", portion: "plate",
  glass: "glass", tall_glass: "glass", can: "glass", shaker: "glass",
  // D53 pours and packs (peg, quarter, pint, bottle_650, can_500…) stay countable pieces: "2 pegs", "1 bottle"
  scoop: "scoop",
  cup: "cup", tea_cup: "cup", cutting: "cup",
  tbsp: "tbsp", tablespoon: "tbsp",
  tsp: "tsp", teaspoon: "tsp",
  handful: "handful",
  pack: "pack",
};
// INDB recipe-yield units, dropped when the food already has a corrected standard one.
const YIELD_UNITS: Record<string, string> = { curry_bowl: "bowl", soup_bowl: "bowl", tall_glass: "glass", tea_cup: "cup" };

const round = (n: number | null | undefined, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

export type Shaped = { food: Food; unitsDropped: number };

/** Throws on a row the app can't use (no kcal, a unit without grams). `aliases` = the final search names. */
export function toAppFood(f: SourceFood, aliases: string[]): Shaped {
  const p = f.per_100g;
  if (p.kcal == null) throw new Error(`${f.id}: kcal is null`);
  const unitIds = new Set(f.units.map((u) => u.unit));
  const units: FoodUnit[] = [];
  let unitsDropped = 0;
  for (const u of f.units) {
    const replacement = YIELD_UNITS[u.unit];
    if (replacement && unitIds.has(replacement)) {
      unitsDropped++;
      continue;
    }
    if (!u.grams || u.grams <= 0) throw new Error(`${f.id}/${u.unit}: bad grams`);
    units.push({ id: u.unit, kind: KIND[u.unit] ?? "piece", label: u.label.replace(/ = \d+ kcal$/, ""), g: round(u.grams)! });
  }
  units.push({ id: "g", kind: "g", label: "grams", g: 1 });

  const du = units.some((u) => u.id === f.default_unit) ? f.default_unit : units[0].id;
  // INDB counts full frying oil; only rows whose kcal is actually inflated get the "high estimate" badge.
  const fried = /DEEP-FRIED/.test(f.notes ?? "") && p.kcal >= 400;
  // raw grains/dals/flours: easy to confuse with the cooked dish in search
  // (IFCT files boiled eggs under "raw" too, hence the name check)
  const uncooked = f.form === "raw" && ["rice", "roti_bread", "dal", "egg", "breakfast"].includes(f.category) && !/boiled|cooked/i.test(f.name);

  const food: Food = {
    id: f.id,
    name: f.name,
    hi: f.name_hi || null,
    aliases,
    cat: f.category as Category,
    diet: f.diet as Food["diet"],
    kcal: round(p.kcal)!,
    p: round(p.protein_g),
    c: round(p.carbs_g),
    f: round(p.fat_g),
    fib: round(p.fiber_g),
    ...(p.alcohol_g != null ? { alc: round(p.alcohol_g, 2) } : {}), // D53: ethanol g / 100 ml, 7 kcal each
    units,
    du,
    conf: f.confidence as Food["conf"],
    src: f.source.id,
    fried,
    uncooked,
    note: f.confidence === "low" ? (f.notes ?? "").split(". ")[0].slice(0, 160) : null,
  };
  return { food, unitsDropped };
}
