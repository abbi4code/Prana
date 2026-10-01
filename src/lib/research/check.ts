// The research checker's rules for ONE food (data.md "Adding foods at scale", D52 fried, D53 alcohol, D54 research).
// PURE and node-runnable (relative imports, no aliases): used by scripts/check-research.mjs (browser-Claude batches,
// on the laptop) and by the server's research agent (src/server/foods). Numbers are never taken from the research
// file: every value comes from `sourced()`, which the caller implements (INDB.xlsx, IFCT CSV, USDA files or API,
// other foods) and which throws when a reference doesn't resolve.

export type SourceRef = { id: string; ref?: string | number; url?: string; image_url?: string; row_name?: string; table?: string };
export type Ingredient = { name?: string; grams: number; source: SourceRef };
export type Frying = {
  fat_ref?: string; fat_pct?: number | null; fat_basis?: string; fat_source?: { url?: string; table?: string };
  moisture_pct?: number; moisture_source?: { url?: string; table?: string } | string;
};
export type ResearchFood = {
  id: string; name: string; name_hi?: string | null; category: string; diet: string; form: string;
  aliases?: string[]; per_100g?: { kcal?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null; fiber_g?: number | null; alcohol_g?: number | null } | null;
  units: { unit: string; label: string; grams: number; basis?: string }[]; default_unit: string;
  source: SourceRef; recipe?: { ingredients: Ingredient[]; cooked_weight_g?: number; cooked_weight_basis?: string; frying?: Frying };
  frying?: Frying;
  drink?: { abv_pct?: number | null; abv_source?: { url?: string; text?: string }; stated_nutrition?: { per?: string; url?: string; kcal?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null } };
  confidence: string; notes?: string; image_prompt?: string;
};
/** Per 100 g (drinks: per 100 ml) as read from a source. */
/** kcal per g the source itself used for its energy value (USDA SR Legacy "Calories From Proximates", e.g. corn 2.44 / 3.57 / 8.37). */
export type CalorieFactors = { p: number; c: number; f: number };
export type SourceRow = { name?: string; kcal: number | null; p: number | null; c: number | null; f: number | null; fib: number | null; alc?: number | null; fdcId?: number; factors?: CalorieFactors | null };
export type Truth = { name?: string; kcal: number; p: number | null; c: number | null; f: number | null; fib: number | null; alc?: number | null; fdcId?: number; factors?: CalorieFactors | null };

export const CATEGORIES = new Set(["breakfast", "roti_bread", "rice", "dal", "sabzi", "paneer", "egg", "non_veg", "snack", "sweet", "dairy", "fruit", "beverage", "condiment", "nuts", "soup", "supplement", "cereal", "alcohol"]);
export const DIETS = new Set(["vegan", "veg", "egg", "non_veg"]);
export const FORMS = new Set(["cooked", "raw", "beverage", "packaged"]);
/** Calorie apps and aggregators are never a source (D03). */
export const FORBIDDEN = /healthifyme|fatsecret|myfitnesspal|nutritionix|calorieking|cronometer|edamam|wikipedia|nutritionvalue|eatthismuch|carbmanager|fitbit/i;
// published uptake for Indian deep-fried foods: 22.5–27.4 % fat by weight (doi:10.1007/s13197-024-05989-z). Well above
// that, the INDB row is counting the frying oil left in the pan (Q4): held back instead of shipping a 700 kcal/100 g bhel.
export const FRIED_FAT_MAX = 35;
export const UNIT_KCAL_MAX = 1200;

/**
 * D52 measurements: total fat (% of DRY weight) of Indian fried foods by frying cycle 1 / 16 / 32.
 * Jain, Passi & Selvamurthy, J Food Sci Technol 2024;61:2185–95, doi:10.1007/s13197-024-05989-z (PMC11465016),
 * groundnut oil. Per-food values read from the paper's table; they reproduce the abstract's stated means across the six
 * foods (1st cycle 22.5 %, 32nd 27.4 %). Research files name the cell ("Poori, 180 °C, 32nd cycle") or fat_ref
 * "JPS2024:poori:180:32"; the value always comes from here.
 */
export const JPS2024: Record<string, [number, number, number]> = {
  "french fries:160": [24.28, 25.26, 26.72], "french fries:180": [21.4, 22.61, 26.28], "poori:180": [20.78, 22.56, 25.12],
  "potato chips:180": [24.03, 29.56, 32.57], "bread pakora:180": [19.25, 20.88, 24.68], "mathri:160": [25.28, 27.38, 28.83],
};
export const JPS_URL = "https://doi.org/10.1007/s13197-024-05989-z";

export const r2 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 100) / 100);
const near = (a: number | null | undefined, b: number | null | undefined, tol = 0.02) =>
  a == null || b == null ? a == b : Math.abs(a - b) <= Math.max(0.15, Math.abs(b) * tol);

export function sameName(a: string, b: string) {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return n(a) === n(b) || n(a).includes(n(b)) || n(b).includes(n(a));
}

export function measuredFat(fr: Frying): { value: number; cell: string } | null {
  const key = fr.fat_ref ?? fr.fat_source?.table ?? "";
  const t = key.toLowerCase();
  const food = Object.keys(JPS2024).map((k) => k.split(":")[0]).find((n) => t.includes(n));
  if (!food || !/jps2024|jain|pmc11465016|s13197-024-05989/i.test(`${key} ${fr.fat_source?.url ?? ""}`)) return null;
  const temp = t.match(/(160|180)/)?.[1] ?? Object.keys(JPS2024).find((k) => k.startsWith(`${food}:`))!.split(":")[1];
  const row = JPS2024[`${food}:${temp}`];
  const cycle = t.match(/\b(1|16|32)(st|th|nd)?\b.*cycle|cycle\D*(1|16|32)\b|:(1|16|32)$/);
  const n = cycle && (cycle[1] ?? cycle[3] ?? cycle[4]);
  if (!row || !n) return null;
  return { value: row[({ 1: 0, 16: 1, 32: 2 } as Record<string, number>)[n]], cell: `${food}, ${temp} °C, cycle ${n}` };
}

export type CheckContext = {
  /** per-100 g values of one reference; throws when it doesn't resolve */
  sourced: (src: SourceRef) => Promise<SourceRow>;
  /** ids already in the catalog (a new food can't reuse them) */
  takenIds: Set<string>;
  /** ids accepted earlier in this run (added to on success) */
  seenIds: Set<string>;
  /** "SOURCE:ref" rows already in the catalog */
  usedRefs: Set<string>;
  /** search name (lower case) → food id that owns it */
  nameOwner: Map<string, string>;
  /** the catalog id this food replaces (D52 rebuilds), if any */
  heir?: string;
};

export type CheckResult = {
  /** REJECT when any problem (or `error`) */
  status: "ACCEPT" | "REJECT";
  problems: string[];
  warnings: string[];
  /** the source's numbers (set unless `error`) */
  truth?: Truth;
  macroOk?: boolean;
  /** a reference that didn't resolve, or a rule that stops the food before its numbers exist */
  error?: string;
};

/**
 * Every rule for one research food, in the order the report prints them. Mutates `food` the way the checker always has
 * (USDA refs → "fdcId N" + url, frying next to the recipe moves into it, study fat filled in) so the accepted row
 * records where each number came from.
 */
export async function checkFood(food: ResearchFood, ctx: CheckContext): Promise<CheckResult> {
  const problems: string[] = [], warnings: string[] = [];
  try {
    // shape
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(food.id ?? "")) problems.push("id not kebab-case");
    if (ctx.takenIds.has(food.id)) problems.push("id already in the catalog");
    if (ctx.seenIds.has(food.id)) problems.push("id repeated in research files");
    if (!CATEGORIES.has(food.category)) problems.push(`category "${food.category}"`);
    if (!DIETS.has(food.diet)) problems.push(`diet "${food.diet}"`);
    if (!FORMS.has(food.form)) problems.push(`form "${food.form}"`);
    if (!food.units?.length || food.units.some((u) => !(u.grams > 0) || !u.unit)) problems.push("bad units");
    if (!food.units?.some((u) => u.unit === food.default_unit)) problems.push("default_unit not in units");
    if (FORBIDDEN.test(JSON.stringify(food))) problems.push("mentions a forbidden source");
    if (ctx.usedRefs.has(`${food.source.id}:${food.source.ref}`)) problems.push(`source row ${food.source.ref} already in the catalog`);
    for (const a of food.aliases ?? []) {
      const owner = ctx.nameOwner.get(a.toLowerCase().trim());
      if (owner && owner !== ctx.heir && owner !== food.id) warnings.push(`alias "${a}" already names ${owner} (dropped)`);
    }

    // numbers from the source
    let truth: Truth;
    if (food.frying && food.recipe && !food.recipe.frying) food.recipe.frying = food.frying; // accepted next to recipe too
    if (/^DEEP-FRIED/i.test(food.notes ?? "") && food.source.id === "INDB")
      throw new Error("INDB deep-fried row counts the whole pan of oil: send it as DERIVED with recipe.frying (D52)");
    if (food.category === "alcohol") {
      // D53: alcohol has its own 7 kcal/g. The brand's ABV sets the alcohol (× 0.789 g/ml, ethanol at 20 °C); carbs,
      // protein and fat come from the brand's stated nutrition (MFR_LABEL) or the USDA row for the style.
      const d = food.drink ?? {};
      let base: SourceRow;
      if (food.source.id === "MFR_LABEL") {
        const sn = d.stated_nutrition;
        if (!sn?.url) throw new Error("MFR_LABEL drink without drink.stated_nutrition (brand nutrition + url)");
        const ml = /100\s*ml/i.test(String(sn.per)) ? 100 : Number(String(sn.per).match(/[\d.]+/)?.[0]);
        if (!(ml > 0)) throw new Error(`stated_nutrition.per "${sn.per}" isn't a volume`);
        const k = 100 / ml, sc = (v: number | null | undefined) => (v == null ? null : v * k);
        base = { kcal: null, p: sc(sn.protein_g), c: sc(sn.carbs_g), f: sc(sn.fat_g), fib: null, alc: null };
        warnings.push(`brand nutrition unverified: check ${sn.url}`);
      } else if (food.source.id === "USDA") {
        base = await ctx.sourced(food.source);
        if (food.source.row_name && base.name && !sameName(base.name, food.source.row_name)) problems.push(`source row is "${base.name}", not "${food.source.row_name}"`);
      } else throw new Error("cocktails / DERIVED drinks aren't supported yet (batch A7)");
      let alc: number;
      if (d.abv_pct != null) {
        if (!(d.abv_pct > 0 && d.abv_pct < 80)) throw new Error(`abv ${d.abv_pct} out of range`);
        if (!d.abv_source?.url) throw new Error("ABV without abv_source.url");
        alc = d.abv_pct * 0.789;
        if (food.per_100g?.alcohol_g != null && Math.abs(food.per_100g.alcohol_g - alc) > 0.05) warnings.push(`alcohol_g ${food.per_100g.alcohol_g} replaced by ABV × 0.789 = ${r2(alc)}`);
      } else if (base.alc != null) {
        alc = base.alc;
        warnings.push(`no brand ABV: alcohol from the USDA row (${base.alc} g / 100 g)`);
      } else throw new Error("no ABV and the source has no alcohol value");
      const t = { name: base.name, p: base.p, c: base.c, f: base.f ?? 0, fib: base.fib, alc };
      truth = { ...t, kcal: 7 * alc + 4 * ((t.p ?? 0) + (t.c ?? 0)) + 9 * (t.f ?? 0) };
      const sn = d.stated_nutrition;
      if (sn?.kcal != null) {
        const ml = /100\s*ml/i.test(String(sn.per)) ? 100 : Number(String(sn.per).match(/[\d.]+/)?.[0]);
        const stated = ml > 0 ? (sn.kcal * 100) / ml : null;
        if (stated != null && Math.abs(stated - truth.kcal) > Math.max(5, truth.kcal * 0.1)) warnings.push(`brand says ${r2(stated)} kcal / 100 ml, computed ${r2(truth.kcal)}`);
      }
      if (d.abv_source?.text && /<\s*\d|less than/i.test(d.abv_source.text)) warnings.push(`ABV is a ceiling ("${d.abv_source.text.slice(0, 40)}…"): alcohol may read a little high`);
    } else if (food.source.id === "DERIVED" && food.recipe?.frying) {
      // D52: fried product = its dough/filling + the fat it actually holds, from a measured study of that kind of food
      const rec = food.recipe, fr = rec.frying!;
      if (!rec.ingredients?.length) throw new Error("fried DERIVED without ingredients");
      const m = measuredFat(fr);
      if (m) {
        if (fr.fat_pct != null && Math.abs(fr.fat_pct - m.value) > 0.05) warnings.push(`fat_pct ${fr.fat_pct} replaced by the study's ${m.value}`);
        Object.assign(fr, { fat_pct: m.value, fat_basis: "dry", fat_source: { url: JPS_URL, table: `Jain, Passi & Selvamurthy 2024: ${m.cell}` } });
      }
      if (!(fr.fat_pct! > 0) || !["dry", "as_eaten"].includes(fr.fat_basis ?? "") || !fr.fat_source?.url) throw new Error("recipe.frying needs fat_pct, fat_basis (dry | as_eaten) and fat_source.url");
      if (!(fr.moisture_pct! >= 0 && fr.moisture_pct! < 90)) throw new Error("recipe.frying needs moisture_pct");
      let p = 0, c = 0, fib = 0;
      for (const ing of rec.ingredients) {
        const v = await ctx.sourced(ing.source);
        p += ((v.p ?? 0) * ing.grams) / 100; c += ((v.c ?? 0) * ing.grams) / 100; fib += ((v.fib ?? 0) * ing.grams) / 100;
        if (ing.source.row_name && v.name && !sameName(v.name, ing.source.row_name)) warnings.push(`ingredient ${ing.source.ref} is "${v.name}", research said "${ing.source.row_name}"`);
      }
      const dry = 100 - fr.moisture_pct!;
      const f = fr.fat_basis === "dry" ? (fr.fat_pct! * dry) / 100 : fr.fat_pct!;
      const rest = dry - f, sum = p + c + fib;
      if (!(rest > 0) || !(sum > 0)) throw new Error("frying numbers leave no room for the dough");
      const t = { p: (p / sum) * rest, c: (c / sum) * rest, fib: (fib / sum) * rest, f };
      truth = { ...t, kcal: 4 * t.p + 4 * t.c + 9 * t.f };
      if (!(typeof fr.moisture_source === "object" && fr.moisture_source?.url)) warnings.push(`moisture ${fr.moisture_pct} % assumed`);
      warnings.push(`fried model: ${r2(f)} g fat / 100 g as eaten (ash ignored, so kcal reads a little high)`);
    } else if (food.source.id === "DERIVED") {
      const rec = food.recipe;
      if (!rec?.ingredients?.length || !(rec.cooked_weight_g! > 0)) throw new Error("DERIVED without a recipe / cooked weight");
      const sum = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
      for (const ing of rec.ingredients) {
        const v = await ctx.sourced(ing.source);
        for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += ((v[k] ?? 0) * ing.grams) / 100;
        if (ing.source.row_name && v.name && !sameName(v.name, ing.source.row_name)) warnings.push(`ingredient ${ing.source.ref} is "${v.name}", research said "${ing.source.row_name}"`);
      }
      const per = (v: number) => (v / rec.cooked_weight_g!) * 100;
      truth = { kcal: per(sum.kcal), p: per(sum.p), c: per(sum.c), f: per(sum.f), fib: per(sum.fib) };
      if (/assum/i.test(rec.cooked_weight_basis ?? "")) warnings.push("cooked weight assumed");
    } else if (food.source.id === "MFR_LABEL") {
      const pv = food.per_100g ?? {};
      if (!(pv.kcal! > 0)) throw new Error("MFR_LABEL without per_100g.kcal (copy it from the label)");
      truth = { kcal: pv.kcal!, p: pv.protein_g ?? null, c: pv.carbs_g ?? null, f: pv.fat_g ?? null, fib: pv.fiber_g ?? null };
      warnings.push(`label values unverified: check against ${food.source.image_url || food.source.url}`);
    } else {
      const row = await ctx.sourced(food.source);
      truth = { ...row, kcal: row.kcal ?? NaN };
      if (truth.fdcId && !/fdcId/.test(String(food.source.ref))) food.source.ref = `fdcId ${truth.fdcId}`;
      if (truth.fdcId) food.source.url = `https://fdc.nal.usda.gov/food-details/${truth.fdcId}/nutrients`;
      if (food.source.row_name && truth.name && !sameName(truth.name, food.source.row_name)) problems.push(`source row is "${truth.name}", not "${food.source.row_name}"`);
    }

    food.per_100g ??= {};
    const claimed = { kcal: food.per_100g.kcal, p: food.per_100g.protein_g, c: food.per_100g.carbs_g, f: food.per_100g.fat_g };
    for (const k of ["kcal", "p", "c", "f"] as const) {
      if (claimed[k] != null && !near(claimed[k], truth[k], food.source.id === "DERIVED" ? 0.05 : 0.02)) warnings.push(`${k}: research ${claimed[k]}, source ${r2(truth[k])} (source used)`);
    }
    // Rebuild the energy from the macros with the factors the source itself used when it gives them (USDA SR Legacy: corn
    // protein 2.44, carbs 3.57, fat 8.37 kcal/g, because its carbs include fibre), else the general 4 / 4 / 9 (+ 7 for alcohol).
    const fx = truth.factors ?? { p: 4, c: 4, f: 9 };
    const macroKcal = fx.p * (truth.p ?? 0) + fx.c * (truth.c ?? 0) + fx.f * (truth.f ?? 0) + 7 * (truth.alc ?? 0);
    const macroOk = truth.p != null && Math.abs(macroKcal - truth.kcal) <= truth.kcal * 0.15;
    const how = truth.factors ? ` with the source's own factors ${fx.p} / ${fx.c} / ${fx.f}` : "";
    if (!macroOk) warnings.push(`macro check fails (${Math.round(macroKcal)} vs ${Math.round(truth.kcal)} kcal${how}): macros set to null`);
    if (truth.f != null && truth.f > FRIED_FAT_MAX && !["condiment", "nuts"].includes(food.category) && !/oil|ghee|butter|nut|seed/i.test(food.name))
      problems.push(`${r2(truth.f)} g fat / 100 g: frying oil counted (Q4), held until the fried-food fix`);
    for (const u of food.units) if ((truth.kcal * u.grams) / 100 > UNIT_KCAL_MAX) problems.push(`unit ${u.unit} = ${Math.round((truth.kcal * u.grams) / 100)} kcal (recipe yield?)`);

    ctx.seenIds.add(food.id);
    return { status: problems.length ? "REJECT" : "ACCEPT", problems, warnings, truth, macroOk };
  } catch (e) {
    return { status: "REJECT", problems, warnings, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The accepted row as data/foods-research.json stores it (numbers from `truth`, never from the research file). */
export function acceptedRow(food: ResearchFood, r: CheckResult, extra: { research: string; units?: ResearchFood["units"]; default_unit?: string; aliases?: string[]; id?: string; replaces?: string }) {
  const truth = r.truth!, ok = r.macroOk!;
  return {
    id: extra.id ?? food.id, ...(extra.replaces ? { replaces: extra.replaces } : {}),
    name: food.name.replace(/\s*\(absorbed-oil model\)/i, ""), name_hi: food.name_hi, category: food.category, diet: food.diet, form: food.form,
    aliases: extra.aliases ?? [],
    per_100g: {
      kcal: r2(truth.kcal), protein_g: ok ? r2(truth.p) : null, carbs_g: ok ? r2(truth.c) : null, fat_g: ok ? r2(truth.f) : null, fiber_g: r2(truth.fib),
      ...(truth.alc != null ? { alcohol_g: r2(truth.alc) } : {}),
      // the source's own kcal-per-gram factors, so later checks (the shared-food gate) rebuild the energy the same way
      ...(ok && truth.factors ? { energy_factors: truth.factors } : {}),
    },
    units: extra.units ?? food.units, default_unit: extra.default_unit ?? food.default_unit,
    source: { id: food.source.id, ref: food.source.ref, url: food.source.url, ...(food.source.image_url ? { image_url: food.source.image_url } : {}) },
    ...(food.recipe ? { recipe: food.recipe } : {}),
    ...(food.drink ? { drink: food.drink } : {}),
    confidence: ok ? food.confidence : "low",
    notes: food.notes ?? "",
    image_prompt: food.image_prompt ?? food.name,
    research: extra.research,
  };
}
