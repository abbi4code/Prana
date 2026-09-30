// Builds the app's food catalog from the research dataset.
//   input:  data/foods.json            (research output, see .claude/data.md)
//           data/foods-extra.json      (added later from INDB/USDA/derived, built by scripts/import-extra.mjs)
//           data/foods-research.json   (verified research batches, written by scripts/check-research.mjs --write)
//   output: src/data/foods.generated.json
// Run: npm run foods

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { toAppFood } from "../src/lib/research/shape.ts";

// data/foods-research.json: browser-Claude research that passed scripts/check-research.mjs (numbers re-read from sources)
const SOURCES = ["data/foods.json", "data/foods-extra.json", "data/foods-research.json"].filter((f) => existsSync(f));
const ALIASES = JSON.parse(readFileSync("data/aliases.json", "utf8")); // reviewed search names (nl-logging.md)
const PREFER_OUT = "src/data/food-prefer.generated.json";
const OUT = "src/data/foods.generated.json";
const REFS_OUT = "src/data/food-refs.generated.json";

// Rows flagged in the v2 review as unreliable. Excluded until re-verified.
const EXCLUDE = {
  "onion-uttapam": "462 kcal/100g and mislabeled deep-fried",
  "plain-dosa": "381 kcal/100g is implausible for a plain dosa",
  "paneer-tikka": "94 kcal/100g is below plain paneer (~258)",
};

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
  const { food, unitsDropped } = toAppFood(f, aliasesFor(f)); // shared with the server (src/lib/research/shape.ts)
  report.unitsDropped += unitsDropped;
  if (food.fried) report.fried.push(f.id);
  if (f.per_100g.protein_g == null) report.macroNulled.push(f.id);
  out.push(food);
}

out.sort((a, b) => a.name.localeCompare(b.name));
mkdirSync("src/data", { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
writeFileSync(PREFER_OUT, JSON.stringify(ALIASES.prefer));
// source row of every catalog food ("INDB:ASC096"): the server research agent (D54) won't add a row twice
writeFileSync(REFS_OUT, JSON.stringify(Object.fromEntries(out.map((f) => [f.id, `${f.src}:${all.find((x) => x.id === f.id).source.ref ?? ""}`]))));

console.log(`foods: ${out.length} written to ${OUT}`);
console.log(`excluded (${report.excluded.length}):\n  ${report.excluded.join("\n  ")}`);
console.log(`high-estimate fried items (${report.fried.length}): ${report.fried.join(", ")}`);
console.log(`macros unknown (${report.macroNulled.length}): ${report.macroNulled.join(", ")}`);
console.log(`recipe-yield units dropped: ${report.unitsDropped}`);
console.log(`replaced by research rows (D52): ${[...replaced].join(", ") || "none"}`);
