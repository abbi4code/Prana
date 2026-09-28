// Builds the app's food catalog from the research dataset.
//   input:  data/foods.json            (research output, see .claude/data.md)
//           data/foods-extra.json      (added later from INDB/USDA/derived, built by scripts/import-extra.mjs)
//           data/foods-research.json   (verified research batches, written by scripts/check-research.mjs --write)
//   output: src/data/foods.generated.json
// Run: npm run foods

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

// data/foods-research.json: browser-Claude research that passed scripts/check-research.mjs (numbers re-read from sources)
const SOURCES = ["data/foods.json", "data/foods-extra.json", "data/foods-research.json"].filter((f) => existsSync(f));
const ALIASES = JSON.parse(readFileSync("data/aliases.json", "utf8")); // reviewed search names (nl-logging.md)
const PREFER_OUT = "src/data/food-prefer.generated.json";
const OUT = "src/data/foods.generated.json";

// Rows flagged in the v2 review as unreliable. Excluded until re-verified.
const EXCLUDE = {
  "onion-uttapam": "462 kcal/100g and mislabeled deep-fried",
  "plain-dosa": "381 kcal/100g is implausible for a plain dosa",
  "paneer-tikka": "94 kcal/100g is below plain paneer (~258)",
};

// D07: every unit maps onto one canonical kind; the friendly text stays in `label`.
const KIND = {
  katori: "katori",
  bowl: "bowl", small_bowl: "bowl", soup_bowl: "bowl", curry_bowl: "bowl",
  plate: "plate", portion: "plate",
  glass: "glass", tall_glass: "glass", can: "glass", shaker: "glass",
  scoop: "scoop",
  cup: "cup", tea_cup: "cup", cutting: "cup",
  tbsp: "tbsp", tablespoon: "tbsp",
  tsp: "tsp", teaspoon: "tsp",
  handful: "handful",
  pack: "pack",
};
// INDB recipe-yield units, dropped when the food already has a corrected standard one.
const YIELD_UNITS = { curry_bowl: "bowl", soup_bowl: "bowl", tall_glass: "glass", tea_cup: "cup" };

const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

// a research row with `replaces` (D52 fried-food rebuilds) takes over that id: the old catalog row is dropped
const loaded = SOURCES.map((f) => ({ f, foods: JSON.parse(readFileSync(f, "utf8")).foods }));
const replaced = new Set(loaded.flatMap(({ foods }) => foods.filter((x) => x.replaces).map((x) => x.replaces)));
const all = loaded.flatMap(({ f, foods }) => foods.filter((x) => f === "data/foods-research.json" || !replaced.has(x.id)));
const dupes = all.map((f) => f.id).filter((id, i, ids) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error(`duplicate food ids: ${dupes.join(", ")}`);
const out = [];
const ids = new Set(all.map((f) => f.id));
for (const id of [...Object.keys(ALIASES.add), ...Object.keys(ALIASES.remove), ...Object.values(ALIASES.prefer)])
  if (!ids.has(id)) throw new Error(`data/aliases.json refers to unknown food id: ${id}`);
const aliasesFor = (f) => {
  const drop = new Set((ALIASES.remove[f.id] ?? []).map((a) => a.toLowerCase()));
  const merged = [...(f.aliases ?? []), ...(ALIASES.add[f.id] ?? [])].map((a) => a.toLowerCase().trim());
  return [...new Set(merged)].filter((a) => a && !drop.has(a));
};
const report = { excluded: [], macroNulled: [], fried: [], unitsDropped: 0 };

for (const f of all) {
  if (EXCLUDE[f.id]) {
    report.excluded.push(`${f.id}: ${EXCLUDE[f.id]}`);
    continue;
  }
  const p = f.per_100g;
  if (p.kcal == null) throw new Error(`${f.id}: kcal is null`);

  const unitIds = new Set(f.units.map((u) => u.unit));
  const units = [];
  for (const u of f.units) {
    const replacement = YIELD_UNITS[u.unit];
    if (replacement && unitIds.has(replacement)) {
      report.unitsDropped++;
      continue;
    }
    if (!u.grams || u.grams <= 0) throw new Error(`${f.id}/${u.unit}: bad grams`);
    units.push({
      id: u.unit,
      kind: KIND[u.unit] ?? "piece",
      label: u.label.replace(/ = \d+ kcal$/, ""),
      g: round(u.grams),
    });
  }
  units.push({ id: "g", kind: "g", label: "grams", g: 1 });

  const defaultUnit = units.some((u) => u.id === f.default_unit) ? f.default_unit : units[0].id;
  // INDB counts full frying oil; only rows whose kcal is actually inflated get the "high estimate" badge.
  const fried = /DEEP-FRIED/.test(f.notes ?? "") && p.kcal >= 400;
  if (fried) report.fried.push(f.id);
  if (p.protein_g == null) report.macroNulled.push(f.id);
  // raw grains/dals/flours: easy to confuse with the cooked dish in search
  // (IFCT files boiled eggs under "raw" too, hence the name check)
  const uncooked = f.form === "raw" && ["rice", "roti_bread", "dal", "egg", "breakfast"].includes(f.category) && !/boiled|cooked/i.test(f.name);

  out.push({
    id: f.id,
    name: f.name,
    hi: f.name_hi || null,
    aliases: aliasesFor(f),
    cat: f.category,
    diet: f.diet,
    kcal: round(p.kcal),
    p: round(p.protein_g),
    c: round(p.carbs_g),
    f: round(p.fat_g),
    fib: round(p.fiber_g),
    units,
    du: defaultUnit,
    conf: f.confidence,
    src: f.source.id,
    fried,
    uncooked,
    note: f.confidence === "low" ? (f.notes ?? "").split(". ")[0].slice(0, 160) : null,
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
mkdirSync("src/data", { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
writeFileSync(PREFER_OUT, JSON.stringify(ALIASES.prefer));

console.log(`foods: ${out.length} written to ${OUT}`);
console.log(`excluded (${report.excluded.length}):\n  ${report.excluded.join("\n  ")}`);
console.log(`high-estimate fried items (${report.fried.length}): ${report.fried.join(", ")}`);
console.log(`macros unknown (${report.macroNulled.length}): ${report.macroNulled.join(", ")}`);
console.log(`recipe-yield units dropped: ${report.unitsDropped}`);
console.log(`replaced by research rows (D52): ${[...replaced].join(", ") || "none"}`);
