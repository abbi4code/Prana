// One-time import from free-exercise-db (public domain, github.com/yuhonas/free-exercise-db), pinned to the
// commit the research was checked against (data/exercises.json meta).
//   output: data/free-exercise-db.json          muscles + instructions for the exercises we use
//           public/exercises/<id>-0.webp, -1.webp  start / end photos, 480 px wide (needs `cwebp`: brew install webp)
// Run: node scripts/import-exercise-db.mjs   (then npm run exercises)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const COMMIT = "a859101d633a01c4a1a920d6a8ce41dabba0705f";
const RAW = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}`;
const OUT_DB = "data/free-exercise-db.json";
const OUT_IMG = "public/exercises";

const ours = JSON.parse(readFileSync("data/exercises.json", "utf8")).exercises.filter((e) => e.fedb_id);
const db = await (await fetch(`${RAW}/dist/exercises.json`)).json();
const byId = new Map(db.map((e) => [e.id, e]));

const missing = ours.filter((e) => !byId.has(e.fedb_id));
if (missing.length) throw new Error(`not in free-exercise-db@${COMMIT}: ${missing.map((e) => e.fedb_id).join(", ")}`);

const subset = ours.map((e) => {
  const f = byId.get(e.fedb_id);
  return {
    id: f.id, name: f.name, level: f.level, force: f.force, mechanic: f.mechanic, equipment: f.equipment,
    primaryMuscles: f.primaryMuscles, secondaryMuscles: f.secondaryMuscles, instructions: f.instructions, images: f.images,
  };
});
writeFileSync(OUT_DB, JSON.stringify({ source: "https://github.com/yuhonas/free-exercise-db", commit: COMMIT, licence: "Unlicense (public domain)", exercises: subset }, null, 1) + "\n");
console.log(`${subset.length} exercises → ${OUT_DB}`);

mkdirSync(OUT_IMG, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "fedb-"));
let done = 0;
for (const e of ours) {
  const f = byId.get(e.fedb_id);
  for (const [i, path] of f.images.slice(0, 2).entries()) {
    const out = `${OUT_IMG}/${e.id}-${i}.webp`;
    if (existsSync(out)) continue;
    const res = await fetch(`${RAW}/exercises/${path}`);
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    const jpg = join(tmp, `${e.id}-${i}.jpg`);
    writeFileSync(jpg, Buffer.from(await res.arrayBuffer()));
    execFileSync("cwebp", ["-quiet", "-q", "62", "-resize", "480", "0", jpg, "-o", out]);
    done++;
  }
}
console.log(`${done} photos written to ${OUT_IMG}/`);
