// Parsed unit → one of the food's own units (nl-logging.md step 4). PURE: types-only import, so it's
// testable with node. Grams always come from the food's unit table; nothing is invented.
import type { Food, FoodUnit } from "../types";
import type { ParsedItem } from "./schema";

// standard vessel sizes (D06), used only to convert between vessels the food actually has
const VESSEL_ML: Partial<Record<FoodUnit["kind"], number>> = { katori: 150, bowl: 250, glass: 250, cup: 150 };

export type ResolvedUnit = { unitId: string; qty: number; note?: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function resolveUnit(food: Food, unit: ParsedItem["unit"], qty: ParsedItem["qty"]): ResolvedUnit {
  const byKind = (k: FoodUnit["kind"]) => food.units.find((u) => u.kind === k);
  const grams = byKind("g");
  const fallback = (note?: string): ResolvedUnit => ({ unitId: food.du, qty: qty ?? 1, ...(note ? { note } : {}) });
  const dflt = food.units.find((u) => u.id === food.du);

  if (unit === "g") return grams ? { unitId: grams.id, qty: qty ?? 100 } : fallback();
  if (unit === "ml")
    return grams ? { unitId: grams.id, qty: qty ?? 100, note: "ml counted as grams" } : fallback();
  if (unit === null || unit === "serving") return fallback();

  // said unit → unit kind; "slice" units are pieces, packets count as pieces too
  const kind: FoodUnit["kind"] = unit === "slice" ? "piece" : unit;
  const exact = byKind(kind) ?? (kind === "piece" ? byKind("pack") : undefined);
  if (exact) return { unitId: exact.id, qty: qty ?? 1 };

  // a vessel the food doesn't list (e.g. "bowl" of a food that only has katori): convert by volume
  const saidMl = VESSEL_ML[kind];
  if (saidMl) {
    for (const k of ["katori", "bowl", "glass", "cup"] as const) {
      const u = byKind(k);
      if (u) return { unitId: u.id, qty: round2(((qty ?? 1) * saidMl) / VESSEL_ML[k]!), note: `${unit} converted to ${k}` };
    }
  }
  return fallback(`no “${unit}” size for this food, used ${dflt?.label ?? "a default serving"}`);
}
