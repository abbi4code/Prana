// Checks browser-Claude food research (data/research/batch-*.json, prompt in .claude/data.md "Adding foods at scale")
// against the real sources, and writes the foods that pass to data/foods-research.json (read by build-foods.mjs).
// Numbers are never taken from the research file: every accepted value is re-read from the source by its reference
//   INDB:     INDB.xlsx by food_code          IFCT2017: @ifct2017/compositions CSV (jsDelivr) by code, kJ ÷ 4.184
//   USDA:     FoodData Central API by fdcId   DERIVED:  recomputed from its sourced ingredients and cooked weight
//   MFR_LABEL: can't be fetched: kept as given, marked for a manual check against the label image
//   Deep-fried foods (D52): DERIVED with recipe.frying: dough/filling from sources + measured fat and moisture of the
//   fried product (fat as eaten = fat on dry basis × (1 − moisture)); INDB deep-fried rows (full pan oil) are refused.
//   USDA refs may be "fdcId 123" or "search: <exact FDC description>" (browser Claude can't always reach the FDC API).
// The per-food rules live in src/lib/research/check.ts (shared with the server research agent, D54).
// Run: node --env-file-if-exists=.env scripts/check-research.mjs /path/to/INDB.xlsx [--write]
//   USDA_API_KEY (free, api.data.gov) raises the FDC limit; DEMO_KEY is used otherwise (30 requests an hour, 50 a day per IP).

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";
import { acceptedRow, checkFood, r2 } from "../src/lib/research/check.ts";
import { parseCsv } from "../src/lib/research/csv.ts";

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
  // USDA's own kcal-per-gram factors (SR Legacy): conversion factor id → food, then the calorie values for it
  if (existsSync(`${dir}/food_calorie_conversion_factor.csv`) && existsSync(`${dir}/food_nutrient_conversion_factor.csv`)) {
    const owner = new Map(read("food_nutrient_conversion_factor.csv").map((r) => [r.id, Number(r.fdc_id)]));
    for (const r of read("food_calorie_conversion_factor.csv")) {
      const v = local.byId.get(owner.get(r.food_nutrient_conversion_factor_id));
      const p = Number(r.protein_value), c = Number(r.carbohydrate_value), f = Number(r.fat_value);
      if (v && p && c && f) v.factors = { p, c, f };
    }
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
  const cf = d.nutrientConversionFactors?.find((x) => /CalorieConversionFactor/.test(x.type ?? ""));
  const factors = cf?.proteinValue && cf?.fatValue && cf?.carbohydrateValue ? { p: cf.proteinValue, c: cf.carbohydrateValue, f: cf.fatValue } : null;
  const v = { name: d.description, dataType: d.dataType, kcal: by("208", "958", "957"), p: by("203"), c: by("205"), f: by("204"), fib: by("291"), alc: by("221"), factors,
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

const DIR = process.env.RESEARCH_DIR || "data/research";
const files = readdirSync(DIR).filter((f) => /^batch-[\w-]+\.json$/.test(f)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const accepted = [], report = [], aliasAdds = {};
const seenIds = new Set();

for (const file of files) {
  const batch = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8"));
  for (const food of batch.foods) {
    const tag = `${file} ${food.id}`;
    const heir = REPLACES[food.id];
    const r = await checkFood(food, { sourced, takenIds, seenIds, usedRefs, nameOwner, heir });
    if (r.error) {
      report.push({ tag, status: "REJECT", problems: [...r.problems, r.error], warnings: r.warnings });
      continue;
    }
    const { problems, warnings, truth } = r;
    const old = heir && built.find((x) => x.id === heir);
    if (heir && !old) problems.push(`replaces ${heir}, which isn't in the catalog`);
    if (old) warnings.push(`replaces ${heir} (${old.kcal} kcal/100 g → ${r2(truth.kcal)})`);
    const status = problems.length ? "REJECT" : "ACCEPT"; // after the replacement check (it used to be decided before it)
    if (status === "ACCEPT") computed.set(food.id, { name: food.name, ...truth });
    report.push({ tag, status, problems, warnings, kcal: r2(truth.kcal) });
    if (status === "ACCEPT")
      accepted.push(acceptedRow(food, r, {
        research: file,
        ...(old ? { id: heir, replaces: heir } : {}),
        aliases: [...new Set([...(old ? old.aliases : []), ...(food.aliases ?? []).map((a) => a.toLowerCase().trim())
          .filter((a) => !nameOwner.has(a) || nameOwner.get(a) === heir || nameOwner.get(a) === food.id)])],
        // a replacement keeps the old row's units (old logs point at them; their weights are INDB servings)
        ...(old ? { units: catalog.find((x) => x.id === heir).units, default_unit: catalog.find((x) => x.id === heir).default_unit } : {}),
      }));
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
