import "server-only";
import catalogJson from "@/data/foods.generated.json";
import refsJson from "@/data/food-refs.generated.json";
import { acceptedRow, checkFood, type ResearchFood, type SourceRef, type SourceRow } from "@/lib/research/check";
import { toAppFood } from "@/lib/research/shape";
import type { Food } from "@/lib/types";
import { foodProblems } from "./schema";
import { sourcedRef } from "./sources";

// One researched food (the agent's answer, in the research-batch format) → a candidate the owner can approve, or the
// reasons it can't be one. Same rules as the laptop checker (src/lib/research/check.ts), same shaping as the catalog
// build (src/lib/research/shape.ts), then the approve-time gate (schema.ts). Numbers only ever come from the sources.

const catalog = catalogJson as Food[];

/** INDB / IFCT rows and USDA foods already in the catalog. Shared USDA style rows (beer) and labels can repeat. */
const USED_REFS = new Set(
  Object.values(refsJson as Record<string, string>)
    .filter((r) => /^(INDB|IFCT2017):./.test(r) || /^USDA:fdcId \d+$/.test(r)),
);

/** "171284", "FDC ID 171284", "fdcId 171284" → "fdcId 171284" (the catalog's form), so a repeat is caught. */
function normalizeRef(src: SourceRef) {
  if (src.id === "USDA" && !/^search:/i.test(String(src.ref ?? ""))) {
    const n = String(src.ref ?? "").match(/\d{4,}/)?.[0];
    if (n) src.ref = `fdcId ${n}`;
  }
}

export type Verified =
  | { ok: true; food: Food; source: SourceRef & { row_name?: string }; warnings: string[] }
  | { ok: false; problems: string[]; warnings: string[] };

/**
 * `shared` = live shared foods, `pendingIds` = ids of candidates waiting for review (a new food can't take either),
 * `requestName` = what the user typed: added as a search name when nobody owns it yet.
 */
export async function verifyResearchFood(input: ResearchFood, opts: { shared: Food[]; pendingIds: Set<string>; requestName?: string }): Promise<Verified> {
  const food = structuredClone(input);
  normalizeRef(food.source);
  for (const ing of food.recipe?.ingredients ?? []) normalizeRef(ing.source);

  const all = [...catalog, ...opts.shared];
  const byId = new Map(all.map((f) => [f.id, f]));
  const nameOwner = new Map<string, string>();
  for (const f of all) for (const n of [f.name, ...f.aliases]) nameOwner.set(n.toLowerCase().trim(), f.id);

  const sourced = async (src: SourceRef): Promise<SourceRow> => {
    if (src.id === "FOOD") {
      const f = byId.get(String(src.ref));
      if (!f) throw new Error(`FOOD ${src.ref} isn't in the catalog`);
      return { name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, fib: f.fib };
    }
    return sourcedRef(src);
  };

  const r = await checkFood(food, {
    sourced,
    takenIds: new Set([...byId.keys(), ...opts.pendingIds]),
    seenIds: new Set(),
    usedRefs: USED_REFS,
    nameOwner,
  });
  if (r.error || r.status === "REJECT") return { ok: false, problems: [...r.problems, ...(r.error ? [r.error] : [])], warnings: r.warnings };

  // search names: the research's own + what the user typed, minus any another food already answers to
  const free = (a: string) => a && (!nameOwner.has(a) || nameOwner.get(a) === food.id);
  const aliases = [...new Set([...(food.aliases ?? []), opts.requestName ?? ""].map((a) => a.toLowerCase().trim()))]
    .filter((a) => free(a) && a !== food.name.toLowerCase().trim());

  const row = acceptedRow(food, r, { research: "agent", aliases });
  let shaped: Food;
  try {
    shaped = toAppFood(row as Parameters<typeof toAppFood>[0], aliases).food;
  } catch (e) {
    return { ok: false, problems: [e instanceof Error ? e.message : String(e)], warnings: r.warnings };
  }
  const gate = foodProblems(shaped, shaped.id);
  if (gate.length) return { ok: false, problems: gate, warnings: r.warnings };
  const warnings = [...r.warnings];
  // data.md "Food data traps": INDB divides by RAW ingredient weight (no cooking loss or water gain)
  if (food.source.id === "INDB")
    warnings.push("INDB per 100 g is on raw ingredient weight: dishes that cook down (kulfi, rabdi, halwa, khoa sweets) read low, rice dishes read high. Check the portion kcal makes sense");
  return { ok: true, food: shaped, source: { ...row.source, ...(food.source.row_name ? { row_name: food.source.row_name } : {}) }, warnings };
}
