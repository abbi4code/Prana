import { getFood, getUnit } from "./foods";
import { portion } from "./nutrition";
import type { SavedMeal, ThaliItem } from "./types";

/** Items with their catalog food + unit + nutrition; items whose food no longer exists are dropped. */
export function resolveItems(items: ThaliItem[]) {
  return items.flatMap((item) => {
    const food = getFood(item.foodId);
    if (!food) return [];
    const unit = getUnit(food, item.unitId);
    return [{ item, food, unit, n: portion(food, unit, item.qty) }];
  });
}

export function thaliTotals(items: ThaliItem[]) {
  return resolveItems(items).reduce(
    (t, { n }) => ({ kcal: t.kcal + n.kcal, p: t.p + (n.p ?? 0), c: t.c + (n.c ?? 0), f: t.f + (n.f ?? 0) }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

export const newThaliId = () => `thali-${crypto.randomUUID()}`;

export const mealKcal = (m: SavedMeal) => thaliTotals(m.items).kcal;
