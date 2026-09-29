// Checks browser-Claude food research (data/research/batch-*.json, prompt in .claude/data.md "Adding foods at scale")
// against the real sources, and writes the foods that pass to data/foods-research.json (read by build-foods.mjs).
// Numbers are never taken from the research file: every accepted value is re-read from the source by its reference
//   INDB:     INDB.xlsx by food_code          IFCT2017: @ifct2017/compositions CSV (jsDelivr) by code, kJ ÷ 4.184
//   USDA:     FoodData Central API by fdcId   DERIVED:  recomputed from its sourced ingredients and cooked weight
//   MFR_LABEL: can't be fetched: kept as given, marked for a manual check against the label image
//   Deep-fried foods (D52): DERIVED with recipe.frying: dough/filling from sources + measured fat and moisture of the
//   fried product (fat as eaten = fat on dry basis × (1 − moisture)); INDB deep-fried rows (full pan oil) are refused.
//   USDA refs may be "fdcId 123" or "search: <exact FDC description>" (browser Claude can't always reach the FDC API).
// Run: node --env-file-if-exists=.env scripts/check-research.mjs /path/to/INDB.xlsx [--write]
//   USDA_API_KEY (free, api.data.gov) raises the FDC limit; DEMO_KEY is used otherwise (30 requests/hour).

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";

const [xlsxPath, ...flags] = process.argv.slice(2);
if (!xlsxPath) throw new Error("usage: node scripts/check-research.mjs /path/to/INDB.xlsx [--write]");
const WRITE = flags.includes("--write");
const FDC_KEY = process.env.USDA_API_KEY || "DEMO_KEY";
const OUT = "data/foods-research.json";

// ── what the catalog already has ──
const catalog = ["data/foods.json", "data/foods-extra.json"].flatMap((f) => JSON.parse(readFileSync(f, "utf8")).foods);
const built = JSON.parse(readFileSync("src/data/foods.generated.json", "utf8"));
const usedRefs = new Set(catalog.map((f) => `${f.source.id}:${f.source.ref}`));
const takenIds = new Set(catalog.map((f) => f.id));
const nameOwner = new Map(); // search name → food id (to catch aliases that would make search ambiguous)
for (const f of built) for (const n of [f.name, ...f.aliases]) nameOwner.set(n.toLowerCase().trim(), f.id);

// ── sources ──
XLSX.set_fs({ readFileSync });
const indb = new Map(XLSX.utils.sheet_to_json(XLSX.readFile(xlsxPath).Sheets["Nutrient Data"]).map((r) => [r.food_code, r]));

const ifct = new Map();
{
  const csv = await (await fetch("https://cdn.jsdelivr.net/npm/@ifct2017/compositions/index.csv")).text();
  const rows = parseCsv(csv);
  const head = rows[0].map((h) => h.split(";").pop().trim());
  const col = (k) => head.indexOf(k);
  for (const r of rows.slice(1)) {
    const num = (k) => (r[col(k)] === "" || r[col(k)] == null ? null : Number(r[col(k)]));
    ifct.set(r[col("code")], { name: r[col("name")], kJ: num("enerc"), p: num("protcnt"), c: num("choavldf"), f: num("fatce"), fib: num("fibtg") });
  }
}

// USDA answers are kept on disk (provenance, and DEMO_KEY allows ~10 requests an hour): data/research/fdc-cache.json
const FDC_FILE = "data/research/fdc-cache.json";
const fdcDisk = existsSync(FDC_FILE) ? JSON.parse(readFileSync(FDC_FILE, "utf8")) : { foods: {}, search: {} };
const saveFdc = () => writeFileSync(FDC_FILE, JSON.stringify(fdcDisk, null, 1) + "\n");
const fdcCache = new Map(Object.entries(fdcDisk.foods).map(([k, v]) => [Number(k), v]));

// USDA's own CSV downloads (FNDDS survey foods, SR Legacy), read locally when given: no key, no rate limit.
//   FDC_DIRS="/path/FoodData_Central_survey_food_csv_2024-10-31:/path/FoodData_Central_sr_legacy_food_csv_2018-04"
//   (fdc.nal.usda.gov/download-datasets). The API stays the fallback.
const normDesc = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const local = { byId: new Map(), byDesc: new Map() };
for (const dir of (process.env.FDC_DIRS ?? "").split(":").filter(Boolean)) {
  const read = (f) => { const [h, ...rows] = parseCsv(readFileSync(`${dir}/${f}`, "utf8")); return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]]))); };
  const nbr = new Map(read("nutrient.csv").map((n) => [n.id, String(n.nutrient_nbr).split(".")[0]]));
  const kind = /survey/i.test(dir) ? "Survey (FNDDS)" : /sr_legacy/i.test(dir) ? "SR Legacy" : "FDC download";
  for (const f of read("food.csv")) {
    local.byId.set(Number(f.fdc_id), { name: f.description, dataType: kind, kcal: null, p: null, c: null, f: null, fib: null, alc: null, portions: [] });
    local.byDesc.set(normDesc(f.description), Number(f.fdc_id));
  }
  // food_nutrient.csv is large (tens of MB): read it line by line and keep only the five nutrients used here
  const key = { 208: "kcal", 203: "p", 205: "c", 204: "f", 291: "fib", 221: "alc" };
  const wanted = new Map([...nbr].filter(([, n]) => key[n]).map(([id, n]) => [id, key[n]]));
  const lines = readFileSync(`${dir}/food_nutrient.csv`, "utf8").split("\n");
  const cols = lines[0].replace(/"/g, "").split(",");
  const iFdc = cols.indexOf("fdc_id"), iNut = cols.indexOf("nutrient_id"), iAmt = cols.indexOf("amount");
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split('","');
    if (c.length < 4) continue;
    const nid = c[iNut].replace(/"/g, "");
    const k = wanted.get(nid) ?? key[nid]; // SR Legacy files use nutrient ids (1008); FNDDS files use the short numbers (208)
    if (!k) continue;
    const v = local.byId.get(Number(c[iFdc].replace(/"/g, "")));
    if (v) v[k] = Number(c[iAmt].replace(/"/g, ""));
  }
  for (const r of existsSync(`${dir}/food_portion.csv`) ? read("food_portion.csv") : []) {
    const v = local.byId.get(Number(r.fdc_id));
    if (v) v.portions.push(`${r.portion_description || r.modifier || `${r.amount} unit`} = ${r.gram_weight} g`);
  }
}
if (local.byId.size) console.log(`USDA: ${local.byId.size} foods read from local downloads`);

async function usda(fdcId) {
  if (fdcCache.has(fdcId)) return fdcCache.get(fdcId);
  if (local.byId.has(fdcId)) return local.byId.get(fdcId);
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${FDC_KEY}`);
  if (!res.ok) throw new Error(`FDC ${fdcId}: HTTP ${res.status}`);
  const d = await res.json();
  const by = (...nums) => {
    for (const n of nums) {
      const x = d.foodNutrients?.find((fn) => String(fn.nutrient?.number) === n);
      if (x && x.amount != null) return x.amount;
    }
    return null;
  };
  const v = { name: d.description, dataType: d.dataType, kcal: by("208", "958", "957"), p: by("203"), c: by("205"), f: by("204"), fib: by("291"), alc: by("221"),
    portions: (d.foodPortions ?? []).map((p) => `${p.portionDescription || `${p.amount ?? ""} ${p.measureUnit?.name ?? ""} ${p.modifier ?? ""}`.trim()} = ${p.gramWeight} g`) };
  fdcCache.set(fdcId, v);
  fdcDisk.foods[fdcId] = { ...v, fetched: new Date().toISOString().slice(0, 10) };
  saveFdc();
  return v;
}

/** "search: <description>" → the fdcId whose description matches exactly (FNDDS, SR Legacy, Foundation). */
const searchCache = new Map(Object.entries(fdcDisk.search));
async function fdcSearch(desc) {
  if (searchCache.has(desc)) return searchCache.get(desc);
  if (local.byDesc.has(normDesc(desc))) return local.byDesc.get(normDesc(desc));
  if (local.byId.size) {
    const words = normDesc(desc).split(" ").filter((w) => w.length > 3);
    const close = [...local.byId.entries()].map(([id, v]) => ({ id, name: v.name, n: words.filter((w) => normDesc(v.name).includes(w)).length }))
      .sort((a, b) => b.n - a.n).slice(0, 3);
    throw new Error(`USDA "${desc}" not found exactly in the downloads; closest: ${close.map((c) => `"${c.name}" (${c.id})`).join(", ")}`);
  }
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${FDC_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: desc, dataType: ["Survey (FNDDS)", "SR Legacy", "Foundation"], pageSize: 25 }),
  });
  if (!res.ok) throw new Error(`FDC search "${desc}": HTTP ${res.status}`);
  const hits = (await res.json()).foods ?? [];
  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const hit = hits.find((f) => norm(f.description) === norm(desc));
  if (!hit) throw new Error(`USDA "${desc}" not found exactly; closest: ${hits.slice(0, 3).map((f) => `"${f.description}" (${f.fdcId})`).join(", ")}`);
  searchCache.set(desc, hit.fdcId);
  fdcDisk.search[desc] = hit.fdcId;
  saveFdc();
  return hit.fdcId;
}

/**
 * D52 measurements: total fat (% of DRY weight) of Indian fried foods by frying cycle 1 / 16 / 32.
 * Jain, Passi & Selvamurthy, J Food Sci Technol 2024;61:2185–95, doi:10.1007/s13197-024-05989-z (PMC11465016),
 * groundnut oil. Per-food values read from the paper's table; they reproduce the abstract's stated means across the six
 * foods (1st cycle 22.5 %, 32nd 27.4 %). Research files name the cell ("Poori, 180 °C, 32nd cycle") or fat_ref
 * "JPS2024:poori:180:32"; the value always comes from here.
 */
const JPS2024 = {
  "french fries:160": [24.28, 25.26, 26.72], "french fries:180": [21.4, 22.61, 26.28], "poori:180": [20.78, 22.56, 25.12],
  "potato chips:180": [24.03, 29.56, 32.57], "bread pakora:180": [19.25, 20.88, 24.68], "mathri:160": [25.28, 27.38, 28.83],
};
const JPS_URL = "https://doi.org/10.1007/s13197-024-05989-z";
function measuredFat(fr) {
  const key = fr.fat_ref ?? fr.fat_source?.table ?? "";
  const t = key.toLowerCase();
  const food = Object.keys(JPS2024).map((k) => k.split(":")[0]).find((n) => t.includes(n));
  if (!food || !/jps2024|jain|pmc11465016|s13197-024-05989/i.test(`${key} ${fr.fat_source?.url ?? ""}`)) return null;
  const temp = t.match(/(160|180)/)?.[1] ?? Object.keys(JPS2024).find((k) => k.startsWith(`${food}:`)).split(":")[1];
  const row = JPS2024[`${food}:${temp}`];
  const cycle = t.match(/\b(1|16|32)(st|th|nd)?\b.*cycle|cycle\D*(1|16|32)\b|:(1|16|32)$/);
  const n = cycle && (cycle[1] ?? cycle[3] ?? cycle[4]);
  if (!row || !n) return null;
  return { value: row[{ 1: 0, 16: 1, 32: 2 }[n]], cell: `${food}, ${temp} °C, cycle ${n}` };
}

/** Research foods computed earlier in this run (combos may use them: source.id "FOOD"). */
const computed = new Map();

/** Per-100 g values of one sourced item, or throws. Pure fats have no energy in IFCT: derived as 9 kcal/g fat (data.md). */
async function sourced(src) {
  if (src.id === "INDB") {
    const r = indb.get(src.ref);
    if (!r) throw new Error(`INDB code ${src.ref} not found`);
    return { name: r.food_name, kcal: r.energy_kcal, p: r.protein_g, c: r.carb_g, f: r.fat_g, fib: r.fibre_g,
      serving: r.servings_unit ? { unit: r.servings_unit, g: (r.unit_serving_energy_kcal / r.energy_kcal) * 100 } : null };
  }
  if (src.id === "IFCT2017") {
    const r = ifct.get(src.ref);
    if (!r) throw new Error(`IFCT code ${src.ref} not found`);
    const kcal = r.kJ ? r.kJ / 4.184 : r.f != null && r.f > 90 ? r.f * 9 : null; // IFCT pure fats carry no energy: 9 kcal/g fat
    if (kcal == null) throw new Error(`IFCT ${src.ref} (${r.name}) has no energy value`);
    // a few IFCT rows contradict themselves (N001 chicken leg: 384 kcal from kJ, 192 from its own protein + fat)
    const fromMacros = 4 * (r.p ?? 0) + 4 * (r.c ?? 0) + 9 * (r.f ?? 0);
    if (r.kJ && Math.abs(kcal - fromMacros) > Math.max(40, kcal * 0.2)) // organic acids (lemon: 37 vs 8) stay under this
      throw new Error(`IFCT ${src.ref} (${r.name}) is inconsistent: ${Math.round(kcal)} kcal from energy vs ${Math.round(fromMacros)} from its macros; use another row`);
    return { name: r.name, kcal, p: r.p, c: r.c, f: r.f, fib: r.fib };
  }
  if (src.id === "USDA") {
    const id = /^search:/i.test(String(src.ref)) ? await fdcSearch(String(src.ref).replace(/^search:\s*/i, "")) : Number(String(src.ref).match(/\d{4,}/)?.[0]);
    if (!id) throw new Error(`USDA ref "${src.ref}" has no fdcId`);
    const v = await usda(id);
    if (v.kcal == null) throw new Error(`USDA ${id} has no energy value`);
    return { ...v, fdcId: id };
  }
  if (src.id === "FOOD") {
    // another research food (computed earlier in this run) or a catalog food, by id
    const r = computed.get(src.ref);
    if (r) return r;
    const f = built.find((x) => x.id === src.ref);
    if (f) return { name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, fib: f.fib };
    throw new Error(`FOOD ${src.ref} not found (or rejected, so its combos can't be built)`);
  }
  throw new Error(`can't read source "${src.id}"`);
}

// D52 rebuilds that replace an inflated INDB deep-fried row: they take over its id (search, old logs and edits keep
// working; old logs keep their snapshot kcal) and its aliases. Reviewed by hand, one line per replacement.
const REPLACES = { "bhatura-fried": "bhatura", "aloo-samosa-fried": "samosa", "khasta-kachori-fried": "kachori" };

// ── rules ──
const CATEGORIES = new Set(["breakfast", "roti_bread", "rice", "dal", "sabzi", "paneer", "egg", "non_veg", "snack", "sweet", "dairy", "fruit", "beverage", "condiment", "nuts", "soup", "supplement", "cereal", "alcohol"]);
const DIETS = new Set(["vegan", "veg", "egg", "non_veg"]);
const FORMS = new Set(["cooked", "raw", "beverage", "packaged"]);
const FORBIDDEN = /healthifyme|fatsecret|myfitnesspal|nutritionix|calorieking|cronometer|edamam|wikipedia|nutritionvalue|eatthismuch|carbmanager|fitbit/i;
// published uptake for Indian deep-fried foods: 22.5–27.4 % fat by weight (doi:10.1007/s13197-024-05989-z). Well above
// that, the INDB row is counting the frying oil left in the pan (Q4): held back instead of shipping a 700 kcal/100 g bhel.
const FRIED_FAT_MAX = 35;
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const near = (a, b, tol = 0.02) => a == null || b == null ? a == b : Math.abs(a - b) <= Math.max(0.15, Math.abs(b) * tol);

const DIR = process.env.RESEARCH_DIR || "data/research";
const files = readdirSync(DIR).filter((f) => /^batch-[\w-]+\.json$/.test(f)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const accepted = [], report = [], aliasAdds = {};
const seenIds = new Set();

for (const file of files) {
  const batch = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8"));
  for (const food of batch.foods) {
    const problems = [], warnings = [];
    const tag = `${file} ${food.id}`;
    try {
      // shape
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(food.id ?? "")) problems.push("id not kebab-case");
      if (takenIds.has(food.id)) problems.push("id already in the catalog");
      if (seenIds.has(food.id)) problems.push("id repeated in research files");
      if (!CATEGORIES.has(food.category)) problems.push(`category "${food.category}"`);
      if (!DIETS.has(food.diet)) problems.push(`diet "${food.diet}"`);
      if (!FORMS.has(food.form)) problems.push(`form "${food.form}"`);
      if (!food.units?.length || food.units.some((u) => !(u.grams > 0) || !u.unit)) problems.push("bad units");
      if (!food.units?.some((u) => u.unit === food.default_unit)) problems.push("default_unit not in units");
      if (FORBIDDEN.test(JSON.stringify(food))) problems.push("mentions a forbidden source");
      if (usedRefs.has(`${food.source.id}:${food.source.ref}`)) problems.push(`source row ${food.source.ref} already in the catalog`);
      const heir = REPLACES[food.id];
      for (const a of food.aliases ?? []) {
        const owner = nameOwner.get(a.toLowerCase().trim());
        if (owner && owner !== heir && owner !== food.id) warnings.push(`alias "${a}" already names ${owner} (dropped)`);
      }

      // numbers from the source
      let truth;
      if (food.frying && food.recipe && !food.recipe.frying) food.recipe.frying = food.frying; // accepted next to recipe too
      if (/^DEEP-FRIED/i.test(food.notes ?? "") && food.source.id === "INDB")
        throw new Error("INDB deep-fried row counts the whole pan of oil: send it as DERIVED with recipe.frying (D52)");
      if (food.category === "alcohol") {
        // D53: alcohol has its own 7 kcal/g. The brand's ABV sets the alcohol (× 0.789 g/ml, ethanol at 20 °C); carbs,
        // protein and fat come from the brand's stated nutrition (MFR_LABEL) or the USDA row for the style.
        const d = food.drink ?? {};
        let base;
        if (food.source.id === "MFR_LABEL") {
          const sn = d.stated_nutrition;
          if (!sn?.url) throw new Error("MFR_LABEL drink without drink.stated_nutrition (brand nutrition + url)");
          const ml = /100\s*ml/i.test(String(sn.per)) ? 100 : Number(String(sn.per).match(/[\d.]+/)?.[0]);
          if (!(ml > 0)) throw new Error(`stated_nutrition.per "${sn.per}" isn't a volume`);
          const k = 100 / ml, sc = (v) => (v == null ? null : v * k);
          base = { p: sc(sn.protein_g), c: sc(sn.carbs_g), f: sc(sn.fat_g), fib: null, alc: null };
          warnings.push(`brand nutrition unverified: check ${sn.url}`);
        } else if (food.source.id === "USDA") {
          base = await sourced(food.source);
          if (food.source.row_name && base.name && !sameName(base.name, food.source.row_name)) problems.push(`source row is "${base.name}", not "${food.source.row_name}"`);
        } else throw new Error("cocktails / DERIVED drinks aren't supported yet (batch A7)");
        let alc;
        if (d.abv_pct != null) {
          if (!(d.abv_pct > 0 && d.abv_pct < 80)) throw new Error(`abv ${d.abv_pct} out of range`);
          if (!d.abv_source?.url) throw new Error("ABV without abv_source.url");
          alc = d.abv_pct * 0.789;
          if (food.per_100g?.alcohol_g != null && Math.abs(food.per_100g.alcohol_g - alc) > 0.05) warnings.push(`alcohol_g ${food.per_100g.alcohol_g} replaced by ABV × 0.789 = ${r2(alc)}`);
        } else if (base.alc != null) {
          alc = base.alc;
          warnings.push(`no brand ABV: alcohol from the USDA row (${base.alc} g / 100 g)`);
        } else throw new Error("no ABV and the source has no alcohol value");
        truth = { name: base.name, p: base.p, c: base.c, f: base.f ?? 0, fib: base.fib, alc };
        truth.kcal = 7 * alc + 4 * ((truth.p ?? 0) + (truth.c ?? 0)) + 9 * (truth.f ?? 0);
        const sn = d.stated_nutrition;
        if (sn?.kcal != null) {
          const ml = /100\s*ml/i.test(String(sn.per)) ? 100 : Number(String(sn.per).match(/[\d.]+/)?.[0]);
          const stated = ml > 0 ? (sn.kcal * 100) / ml : null;
          if (stated != null && Math.abs(stated - truth.kcal) > Math.max(5, truth.kcal * 0.1)) warnings.push(`brand says ${r2(stated)} kcal / 100 ml, computed ${r2(truth.kcal)}`);
        }
        if (d.abv_source?.text && /<\s*\d|less than/i.test(d.abv_source.text)) warnings.push(`ABV is a ceiling ("${d.abv_source.text.slice(0, 40)}…"): alcohol may read a little high`);
      } else if (food.source.id === "DERIVED" && food.recipe?.frying) {
        // D52: fried product = its dough/filling + the fat it actually holds, from a measured study of that kind of food
        const rec = food.recipe, fr = rec.frying;
        if (!rec.ingredients?.length) throw new Error("fried DERIVED without ingredients");
        const m = measuredFat(fr);
        if (m) {
          if (fr.fat_pct != null && Math.abs(fr.fat_pct - m.value) > 0.05) warnings.push(`fat_pct ${fr.fat_pct} replaced by the study's ${m.value}`);
          Object.assign(fr, { fat_pct: m.value, fat_basis: "dry", fat_source: { url: JPS_URL, table: `Jain, Passi & Selvamurthy 2024: ${m.cell}` } });
        }
        if (!(fr.fat_pct > 0) || !["dry", "as_eaten"].includes(fr.fat_basis) || !fr.fat_source?.url) throw new Error("recipe.frying needs fat_pct, fat_basis (dry | as_eaten) and fat_source.url");
        if (!(fr.moisture_pct >= 0 && fr.moisture_pct < 90)) throw new Error("recipe.frying needs moisture_pct");
        let p = 0, c = 0, fib = 0;
        for (const ing of rec.ingredients) {
          const v = await sourced(ing.source);
          p += ((v.p ?? 0) * ing.grams) / 100; c += ((v.c ?? 0) * ing.grams) / 100; fib += ((v.fib ?? 0) * ing.grams) / 100;
          if (ing.source.row_name && v.name && !sameName(v.name, ing.source.row_name)) warnings.push(`ingredient ${ing.source.ref} is "${v.name}", research said "${ing.source.row_name}"`);
        }
        const dry = 100 - fr.moisture_pct;
        const f = fr.fat_basis === "dry" ? (fr.fat_pct * dry) / 100 : fr.fat_pct;
        const rest = dry - f, sum = p + c + fib;
        if (!(rest > 0) || !(sum > 0)) throw new Error("frying numbers leave no room for the dough");
        truth = { p: (p / sum) * rest, c: (c / sum) * rest, fib: (fib / sum) * rest, f };
        truth.kcal = 4 * truth.p + 4 * truth.c + 9 * truth.f;
        if (!fr.moisture_source?.url) warnings.push(`moisture ${fr.moisture_pct} % assumed`);
        warnings.push(`fried model: ${r2(f)} g fat / 100 g as eaten (ash ignored, so kcal reads a little high)`);
      } else if (food.source.id === "DERIVED") {
        const rec = food.recipe;
        if (!rec?.ingredients?.length || !(rec.cooked_weight_g > 0)) throw new Error("DERIVED without a recipe / cooked weight");
        const sum = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
        for (const ing of rec.ingredients) {
          const v = await sourced(ing.source);
          for (const k of Object.keys(sum)) sum[k] += ((v[k] ?? 0) * ing.grams) / 100;
          if (ing.source.row_name && v.name && !sameName(v.name, ing.source.row_name)) warnings.push(`ingredient ${ing.source.ref} is "${v.name}", research said "${ing.source.row_name}"`);
        }
        truth = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, (v / rec.cooked_weight_g) * 100]));
        if (/assum/i.test(rec.cooked_weight_basis ?? "")) warnings.push("cooked weight assumed");
      } else if (food.source.id === "MFR_LABEL") {
        truth = { kcal: food.per_100g.kcal, p: food.per_100g.protein_g, c: food.per_100g.carbs_g, f: food.per_100g.fat_g, fib: food.per_100g.fiber_g };
        warnings.push(`label values unverified: check against ${food.source.image_url || food.source.url}`);
      } else {
        truth = await sourced(food.source);
        if (truth.fdcId && !/fdcId/.test(food.source.ref)) food.source.ref = `fdcId ${truth.fdcId}`;
        if (truth.fdcId) food.source.url = `https://fdc.nal.usda.gov/food-details/${truth.fdcId}/nutrients`;
        if (food.source.row_name && truth.name && !sameName(truth.name, food.source.row_name)) problems.push(`source row is "${truth.name}", not "${food.source.row_name}"`);
      }

      food.per_100g ??= {};
      const claimed = { kcal: food.per_100g.kcal, p: food.per_100g.protein_g, c: food.per_100g.carbs_g, f: food.per_100g.fat_g };
      for (const k of ["kcal", "p", "c", "f"]) {
        if (claimed[k] != null && !near(claimed[k], truth[k], food.source.id === "DERIVED" ? 0.05 : 0.02)) warnings.push(`${k}: research ${claimed[k]}, source ${r2(truth[k])} (source used)`);
      }
      const macroKcal = 4 * (truth.p ?? 0) + 4 * (truth.c ?? 0) + 9 * (truth.f ?? 0) + 7 * (truth.alc ?? 0);
      const macroOk = truth.p != null && Math.abs(macroKcal - truth.kcal) <= truth.kcal * 0.15;
      if (!macroOk) warnings.push(`macro check fails (${Math.round(macroKcal)} vs ${Math.round(truth.kcal)} kcal): macros set to null`);
      if (truth.f != null && truth.f > FRIED_FAT_MAX && !["condiment", "nuts"].includes(food.category) && !/oil|ghee|butter|nut|seed/i.test(food.name))
        problems.push(`${r2(truth.f)} g fat / 100 g: frying oil counted (Q4), held until the fried-food fix`);
      for (const u of food.units) if ((truth.kcal * u.grams) / 100 > 1200) problems.push(`unit ${u.unit} = ${Math.round((truth.kcal * u.grams) / 100)} kcal (recipe yield?)`);

      seenIds.add(food.id);
      const status = problems.length ? "REJECT" : "ACCEPT";
      if (status === "ACCEPT") computed.set(food.id, { name: food.name, ...truth });
      report.push({ tag, status, problems, warnings, kcal: r2(truth.kcal) });
      const old = heir && built.find((x) => x.id === heir);
      if (heir && !old) problems.push(`replaces ${heir}, which isn't in the catalog`);
      if (old) warnings.push(`replaces ${heir} (${old.kcal} kcal/100 g → ${r2(truth.kcal)})`);
      if (status === "ACCEPT")
        accepted.push({
          id: old ? heir : food.id, ...(old ? { replaces: heir } : {}),
          name: food.name.replace(/\s*\(absorbed-oil model\)/i, ""), name_hi: food.name_hi, category: food.category, diet: food.diet, form: food.form,
          aliases: [...new Set([...(old ? old.aliases : []), ...(food.aliases ?? []).map((a) => a.toLowerCase().trim())
            .filter((a) => !nameOwner.has(a) || nameOwner.get(a) === heir || nameOwner.get(a) === food.id)])],
          per_100g: { kcal: r2(truth.kcal), protein_g: macroOk ? r2(truth.p) : null, carbs_g: macroOk ? r2(truth.c) : null, fat_g: macroOk ? r2(truth.f) : null, fiber_g: r2(truth.fib), ...(truth.alc != null ? { alcohol_g: r2(truth.alc) } : {}) },
          // a replacement keeps the old row's units (old logs point at them; their weights are INDB servings)
          ...(old ? { units: catalog.find((x) => x.id === heir).units, default_unit: catalog.find((x) => x.id === heir).default_unit }
                  : { units: food.units, default_unit: food.default_unit }),
          source: { id: food.source.id, ref: food.source.ref, url: food.source.url, ...(food.source.image_url ? { image_url: food.source.image_url } : {}) },
          ...(food.recipe ? { recipe: food.recipe } : {}),
          ...(food.drink ? { drink: food.drink } : {}),
          confidence: macroOk ? food.confidence : "low",
          notes: food.notes ?? "",
          image_prompt: food.image_prompt ?? food.name,
          research: file,
        });
    } catch (e) {
      report.push({ tag, status: "REJECT", problems: [...problems, e.message], warnings });
    }
  }

  // alias suggestions for existing foods → data/aliases.json "add", only names nobody else owns
  for (const [name, list] of Object.entries(batch.alias_suggestions ?? {})) {
    const f = built.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!f) { report.push({ tag: `${file} alias:${name}`, status: "SKIP", problems: ["no existing food with that name"], warnings: [] }); continue; }
    const keep = list.map((a) => a.toLowerCase().trim()).filter((a) => !nameOwner.has(a) || nameOwner.get(a) === f.id).filter((a) => !f.aliases.includes(a));
    const dropped = list.filter((a) => nameOwner.has(a.toLowerCase()) && nameOwner.get(a.toLowerCase()) !== f.id);
    if (keep.length) aliasAdds[f.id] = [...new Set([...(aliasAdds[f.id] ?? []), ...keep])];
    if (dropped.length) report.push({ tag: `${file} alias:${f.id}`, status: "NOTE", problems: [], warnings: dropped.map((a) => `"${a}" already names ${nameOwner.get(a.toLowerCase())}`) });
  }
}

for (const r of report) {
  console.log(`${r.status.padEnd(6)} ${r.tag}${r.kcal != null ? ` (${r.kcal} kcal/100 g)` : ""}`);
  for (const p of r.problems) console.log(`         ✗ ${p}`);
  for (const w of r.warnings) console.log(`         · ${w}`);
}
console.log(`\n${accepted.length} accepted, ${report.filter((r) => r.status === "REJECT").length} rejected`);
console.log(`alias additions for existing foods: ${JSON.stringify(aliasAdds)}`);

if (WRITE) {
  writeFileSync(OUT, JSON.stringify({ generated_on: new Date().toISOString().slice(0, 10), about: "Foods from data/research/, verified by scripts/check-research.mjs: numbers re-read from the source.", foods: accepted }, null, 2) + "\n");
  const aliases = JSON.parse(readFileSync("data/aliases.json", "utf8"));
  for (const [id, list] of Object.entries(aliasAdds)) aliases.add[id] = [...new Set([...(aliases.add[id] ?? []), ...list])];
  writeFileSync("data/aliases.json", JSON.stringify(aliases, null, 2) + "\n");
  console.log(`wrote ${OUT} (${accepted.length} foods) and data/aliases.json`);
}

function sameName(a, b) {
  const n = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return n(a) === n(b) || n(a).includes(n(b)) || n(b).includes(n(a));
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
