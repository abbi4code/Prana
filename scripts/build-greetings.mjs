// Builds the Today greeting pool (decision D31, .claude/greetings.md).
//   input:  data/greetings/*.json   (batches from the browser-Claude prompt; drop new files in, then rerun; optional `topic` / `work` override the auto tags)
//   output: src/data/greetings.generated.json
// Run: npm run greetings
// Fails on any broken rule, so a bad batch never reaches the app.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const DIR = "data/greetings";
const OUT = "src/data/greetings.generated.json";

const TIME = ["any", "early", "morning", "afternoon", "evening", "night", "late"];
const CTX = ["any", "streak", "back_after_break", "first_day", "at_gym", "workout_done", "rest_day", "nothing_logged", "on_track", "monday", "weekend"];
const TONE = ["hype", "funny", "chill", "filmy"];
const LANG = ["hinglish", "english"];
const TOPIC = ["gym", "food", "general"];
const MAX_LEN = 60;

// topic decides who may see a line: "gym" lines are skipped for food-only users and on rest days.
// Anything that mentions lifting is "gym", even if it also mentions food. A line can set `topic` itself to override.
const GYM = /\b(gym|sets?|reps?|squats?|dumbbells?|bench|rack|leg day|legs|lift(s|ing)?|workout|warm-?ups?|warm up|treadmill|chalk|pr|gains|muscles?|train(ing)?|beast mode|pasina|sweat|protein shake|deadlifts?|cardio)\b/i;
const FOOD = /\b(khana|khao|food|katori|dal|roti|chawal|rajma|paneer|protein|plate|meals?|doodh|dahi|tiffin|fuel|snacks?|sabzi|dinner|lunch|breakfast|nashta)\b/i;
const topicOf = (text) => (GYM.test(text) ? "gym" : FOOD.test(text) ? "food" : "general");
// "work" lines assume a working day (office, standup, commute, college): skipped on Saturday and Sunday.
// A line can set `work` itself to override.
const WORK = /\b(office|meetings?|standup|laptop|commute|inbox|metro|traffic|college|school bus|wfh|auto nahi|lunch box|tiffin|dhakke|canteen|desk|class|tuition)\b/i;

const norm = (s) => s.toLowerCase().replace(/\{\w+\}/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const idOf = (text) => createHash("sha1").update(norm(text)).digest("hex").slice(0, 10);

const errors = [];
const seen = new Map(); // normalized text → where
const out = [];

const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
for (const file of files) {
  let list;
  try {
    list = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8"));
  } catch (e) {
    errors.push(`${file}: invalid JSON (${e.message})`);
    continue;
  }
  if (!Array.isArray(list)) {
    errors.push(`${file}: expected a JSON array`);
    continue;
  }
  list.forEach((g, i) => {
    const at = `${file} #${i + 1} "${g?.text}"`;
    const fail = (why) => errors.push(`${at}: ${why}`);
    if (typeof g?.text !== "string" || !g.text.trim()) return fail("missing text");
    const text = g.text.trim();
    if (!TIME.includes(g.time)) fail(`time "${g.time}"`);
    if (!CTX.includes(g.ctx)) fail(`ctx "${g.ctx}"`);
    if (!TONE.includes(g.tone)) fail(`tone "${g.tone}"`);
    if (!LANG.includes(g.lang)) fail(`lang "${g.lang}"`);
    if (typeof g.bro !== "boolean") fail("bro must be true/false");
    if (g.topic != null && !TOPIC.includes(g.topic)) fail(`topic "${g.topic}"`);
    if (g.work != null && typeof g.work !== "boolean") fail("work must be true/false");
    if ([...text].length > MAX_LEN) fail(`${[...text].length} characters (max ${MAX_LEN})`);
    for (const p of text.match(/\{[^}]*\}/g) ?? []) if (p !== "{name}" && p !== "{streak}") fail(`unknown placeholder ${p}`);
    if (text.includes("{streak}") && g.ctx !== "streak") fail("{streak} only works in ctx \"streak\"");
    if (/\p{Extended_Pictographic}/u.test(text)) fail("emoji");
    if (/\p{Script=Devanagari}/u.test(text)) fail("Devanagari (use roman script)");
    const key = norm(text);
    if (seen.has(key)) return fail(`duplicate of ${seen.get(key)}`);
    seen.set(key, at);
    out.push({ id: idOf(text), t: text, time: g.time, ctx: g.ctx, topic: g.topic ?? topicOf(text), bro: g.bro, work: g.work ?? WORK.test(text) });
  });
}

if (errors.length) {
  console.error(`greetings: ${errors.length} problem(s), nothing written:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

mkdirSync("src/data", { recursive: true });
writeFileSync(OUT, JSON.stringify(out));

const tally = (k) => Object.entries(out.reduce((m, g) => ((m[g[k]] = (m[g[k]] ?? 0) + 1), m), {})).map(([v, n]) => `${v} ${n}`).join(", ");
console.log(`greetings: ${out.length} from ${files.length} file(s) written to ${OUT}`);
console.log(`  ctx:   ${tally("ctx")}`);
console.log(`  time:  ${tally("time")}`);
console.log(`  topic: ${tally("topic")}`);
console.log(`  work (weekdays only): ${out.filter((g) => g.work).length}`);
