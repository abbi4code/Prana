import "server-only";
import { z } from "zod";
import catalog from "@/data/foods.generated.json";
import { CATEGORY_LABEL } from "@/lib/foods";
import type { Category, Food } from "@/lib/types";

// The gate every shared food passes before it goes live (D54): exactly the shape the app uses (lib/types.ts Food),
// plus the checker's rules (lib/research/check.ts): macros add up within 15 % (with the source's own factors when it
// gave them, else 4 / 4 / 9; else they must be null) and no
// unit over 1,200 kcal (a recipe yield, not a portion).

const UNIT_KINDS = ["g", "katori", "bowl", "plate", "piece", "glass", "cup", "tbsp", "tsp", "handful", "pack", "scoop"] as const;
const num = z.number().finite().min(0);

export const FoodSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),
    name: z.string().trim().min(2).max(80),
    hi: z.string().max(80).nullable(),
    aliases: z.array(z.string().trim().min(1).max(60)).max(40),
    cat: z.enum(Object.keys(CATEGORY_LABEL) as [Category, ...Category[]]),
    diet: z.enum(["vegan", "veg", "egg", "non_veg"]),
    kcal: z.number().finite().positive().max(900),
    p: num.nullable(),
    c: num.nullable(),
    f: num.nullable(),
    fib: num.nullable(),
    alc: num.nullable().optional(),
    ef: z.object({ p: z.number().min(1).max(5), c: z.number().min(1).max(5), f: z.number().min(5).max(10) }).strict().nullable().optional(),
    units: z.array(z.object({ id: z.string().min(1).max(40), kind: z.enum(UNIT_KINDS), label: z.string().min(1).max(60), g: z.number().positive().max(2000) })).min(1).max(12),
    du: z.string().min(1),
    conf: z.enum(["high", "medium", "low"]),
    src: z.string().min(1).max(40),
    fried: z.boolean(),
    uncooked: z.boolean(),
    note: z.string().max(200).nullable(),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (!f.units.some((u) => u.id === f.du)) ctx.addIssue({ code: "custom", message: "default unit isn't one of the units" });
    if (new Set(f.units.map((u) => u.id)).size !== f.units.length) ctx.addIssue({ code: "custom", message: "duplicate unit ids" });
    const macros = [f.p, f.c, f.f];
    if (macros.some((m) => m == null) && macros.some((m) => m != null)) ctx.addIssue({ code: "custom", message: "macros must be all known or all null" });
    if (f.p != null && f.c != null && f.f != null) {
      const fx = f.ef ?? { p: 4, c: 4, f: 9 }; // the source's own factors when it gave them (same rule as the checker)
      const fromMacros = fx.p * f.p + fx.c * f.c + fx.f * f.f + 7 * (f.alc ?? 0);
      if (Math.abs(fromMacros - f.kcal) > f.kcal * 0.15) ctx.addIssue({ code: "custom", message: `macros give ${Math.round(fromMacros)} kcal, not ${f.kcal}` });
    }
    for (const u of f.units)
      if ((f.kcal * u.g) / 100 > 1200) ctx.addIssue({ code: "custom", message: `unit ${u.id} is ${Math.round((f.kcal * u.g) / 100)} kcal (a recipe yield?)` });
  });

const CATALOG_IDS = new Set((catalog as Food[]).map((f) => f.id));
/** Ids in the built-in catalog can't be shared foods: the catalog would win on every device. */
export const inCatalog = (id: string) => CATALOG_IDS.has(id);

/** Why a food can't go live, in short sentences for the review card; [] = fine. */
export function foodProblems(data: unknown, id: string): string[] {
  if (inCatalog(id)) return [`“${id}” is already in the built-in catalog`];
  const r = FoodSchema.safeParse(data);
  if (r.success) return r.data.id === id ? [] : ["the food's id doesn't match the candidate"];
  return r.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).slice(0, 5);
}
