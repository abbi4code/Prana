// Natural-language parsing eval (nl-logging.md, Phase 4). Run on every prompt or model change:
//   npm run eval:parse                 # all cases, default model, pass bar 90%
//   npm run eval:parse -- --model gpt-6-luna --min 0.9 --only rajma
// Calls OpenAI directly with the SAME request the server sends (src/lib/nl/request.ts) and matches
// foods with the SAME matcher + ranking the app uses. Costs ~$0.01 per full run.
import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import OpenAI from "openai";
import { buildMatcher } from "../src/lib/nl/match.ts";
import { buildWorkoutMatcher } from "../src/lib/nl/workoutMatch.ts";
import { PROMPT_VERSION } from "../src/lib/nl/prompt.ts";
import { matchBoost } from "../src/lib/nl/ranking.ts";
import { DEFAULT_MODEL, parseRequest } from "../src/lib/nl/request.ts";
import { ParsedLog } from "../src/lib/nl/schema.ts";

for (const f of [".env", ".env.local"]) if (existsSync(f)) process.loadEnvFile(f);
const { values: args } = parseArgs({
  options: {
    model: { type: "string", default: process.env.NL_MODEL ?? DEFAULT_MODEL },
    min: { type: "string", default: "0.9" },
    only: { type: "string" },
    concurrency: { type: "string", default: "6" },
  },
});

type Expect = { food?: string[]; qty?: number | null; unit?: string | null };
type WExpect = { ex?: string[]; sets?: number | null; reps?: number | null; weight_kg?: number | null; minutes?: number | null; distance_km?: number | null };
type Case = { text: string; meal: string | null; day?: string | null; items: Expect[]; workouts?: WExpect[] };

const cases: Case[] = readFileSync("evals/nl-parse.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l))
  .filter((c: Case) => !args.only || c.text.includes(args.only));
const foods = JSON.parse(readFileSync("src/data/foods.generated.json", "utf8"));
const prefer = JSON.parse(readFileSync("src/data/food-prefer.generated.json", "utf8"));
const matcher = buildMatcher(foods, { prefer, boost: matchBoost });
const gym = JSON.parse(readFileSync("src/data/exercises.generated.json", "utf8"));
const wmatcher = buildWorkoutMatcher(gym.exercises, gym.activities);
const openai = new OpenAI({ timeout: 20_000, maxRetries: 2 });

type Result = { c: Case; ok: boolean; problems: string[]; ms: number; got?: ParsedLog; dims: Record<string, boolean> };

async function run(c: Case): Promise<Result> {
  const t = Date.now();
  const problems: string[] = [];
  const dims: Record<string, boolean> = {};
  let got: ParsedLog | undefined;
  try {
    const res = await openai.responses.parse(parseRequest(c.text, args.model!));
    const v = ParsedLog.safeParse(res.output_parsed);
    if (!v.success) problems.push("invalid output");
    else got = v.data;
  } catch (e) {
    problems.push(`api error: ${e instanceof Error ? e.message : e}`);
  }
  if (got) {
    dims.meal = got.meal === c.meal;
    if (!dims.meal) problems.push(`meal ${got.meal} ≠ ${c.meal}`);
    dims.count = got.items.length === c.items.length;
    if (!dims.count) problems.push(`items ${got.items.length} ≠ ${c.items.length}`);
    const used = new Set<number>();
    const ids = got.items.map((it) => matcher.match(it.name, 1)[0]?.item.id);
    c.items.forEach((exp, i) => {
      // pair by expected food (any order), else by position
      let j = exp.food ? ids.findIndex((id, k) => !used.has(k) && id && exp.food!.includes(id)) : -1;
      if (j < 0) j = i < got!.items.length && !used.has(i) ? i : -1;
      if (j < 0) return void problems.push(`missing item #${i + 1}`);
      used.add(j);
      const it = got!.items[j];
      if (exp.food && !exp.food.includes(ids[j] ?? "")) {
        dims.food = false;
        problems.push(`"${it.name}" → ${ids[j] ?? "no match"} (want ${exp.food.join("|")})`);
      }
      if ("qty" in exp && it.qty !== exp.qty) { dims.qty = false; problems.push(`"${it.name}" qty ${it.qty} ≠ ${exp.qty}`); }
      if ("unit" in exp && it.unit !== exp.unit) { dims.unit = false; problems.push(`"${it.name}" unit ${it.unit} ≠ ${exp.unit}`); }
    });
    // day: only checked when the case says so (most cases don't care)
    if ("day" in c) { dims.day = got.day === c.day; if (!dims.day) problems.push(`day ${got.day} ≠ ${c.day}`); }
    // workouts: food-only cases must produce none
    const wexp = c.workouts ?? [];
    dims.wcount = got.workouts.length === wexp.length;
    if (!dims.wcount) problems.push(`workouts ${got.workouts.length} ≠ ${wexp.length}`);
    const wids = got.workouts.map((w) => wmatcher.match(w.name, 1)[0]?.item.id);
    const wused = new Set<number>();
    wexp.forEach((exp, i) => {
      let j = exp.ex ? wids.findIndex((id, k) => !wused.has(k) && id && exp.ex!.includes(id)) : -1;
      if (j < 0) j = i < got!.workouts.length && !wused.has(i) ? i : -1;
      if (j < 0) return void problems.push(`missing workout #${i + 1}`);
      wused.add(j);
      const w = got!.workouts[j];
      if (exp.ex && !exp.ex.includes(wids[j] ?? "")) { dims.exercise = false; problems.push(`"${w.name}" → ${wids[j] ?? "no match"} (want ${exp.ex.join("|")})`); }
      for (const k of ["sets", "reps", "weight_kg", "minutes", "distance_km"] as const)
        if (k in exp && w[k] !== exp[k]) { dims.wnums = false; problems.push(`"${w.name}" ${k} ${w[k]} ≠ ${exp[k]}`); }
    });
    for (const d of ["food", "qty", "unit", "exercise", "wnums"]) dims[d] ??= true;
  }
  return { c, ok: problems.length === 0, problems, ms: Date.now() - t, got, dims };
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

console.log(`eval: ${cases.length} cases · model ${args.model} · prompt ${PROMPT_VERSION}\n`);
const results = await pool(cases, Number(args.concurrency), run);

for (const r of results.filter((x) => !x.ok)) {
  console.log(`✗ "${r.c.text}"`);
  for (const p of r.problems) console.log(`    ${p}`);
  if (r.got) console.log(`    got ${JSON.stringify(r.got)}`);
}
const pct = (k: (r: Result) => boolean) => `${Math.round((results.filter(k).length / results.length) * 100)}%`;
const passRate = results.filter((r) => r.ok).length / results.length;
const ms = results.map((r) => r.ms).sort((a, b) => a - b);
console.log(`\npassed ${results.filter((r) => r.ok).length}/${results.length} (${Math.round(passRate * 100)}%)`);
console.log(`food: meal ${pct((r) => !!r.dims.meal)} · items ${pct((r) => !!r.dims.count)} · match ${pct((r) => !!r.dims.food)} · qty ${pct((r) => !!r.dims.qty)} · unit ${pct((r) => !!r.dims.unit)}`);
console.log(`workout: count ${pct((r) => !!r.dims.wcount)} · exercise ${pct((r) => !!r.dims.exercise)} · numbers ${pct((r) => !!r.dims.wnums)} · day ${pct((r) => r.dims.day !== false)}`);
console.log(`latency p50 ${ms[Math.floor(ms.length / 2)]} ms · p90 ${ms[Math.floor(ms.length * 0.9)]} ms`);
if (passRate < Number(args.min)) {
  console.log(`\nFAIL: below the ${Math.round(Number(args.min) * 100)}% bar`);
  process.exit(1);
}
