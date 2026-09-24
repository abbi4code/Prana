// Builds the app's exercise + activity catalog (decision D27, .claude/workouts.md).
//   input:  data/exercises.json         research: 200 exercises (free-exercise-db ids) + 20 activities
//           data/exercises-extra.json   common exercises free-exercise-db lacks (no photo)
//           data/free-exercise-db.json  muscles + instructions (scripts/import-exercise-db.mjs)
//           data/burn-model.json        Compendium 2024 METs, looked up by code, so every number has a source
//   output: src/data/exercises.generated.json         catalog (bundled with the workout screens)
//           src/data/exercise-steps.generated.json    how-to steps, loaded only when an exercise is opened
// Run: npm run exercises

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const research = read("data/exercises.json");
const extra = read("data/exercises-extra.json");
const fedb = new Map(read("data/free-exercise-db.json").exercises.map((e) => [e.id, e]));
const METS = new Map(read("data/burn-model.json").mets.map((m) => [m.code, m]));
const OUT = "src/data/exercises.generated.json";
const OUT_STEPS = "src/data/exercise-steps.generated.json";

const met = (code) => {
  const m = METS.get(code);
  if (!m) throw new Error(`Compendium code ${code} missing from burn-model.json`);
  return { code, value: m.met };
};

// Which Compendium entry each exercise is judged by (mapping is ours; values come from burn-model.json).
const SQUAT_DEADLIFT = new Set([
  "barbell-back-squat", "full-squat-deep", "front-squat", "smith-machine-squat", "hack-squat-machine", "pendulum-squat",
  "goblet-squat", "dumbbell-squat", "deadlift", "rack-pull", "trap-bar-deadlift", "romanian-deadlift",
  "stiff-leg-deadlift", "dumbbell-stiff-leg-deadlift", "sumo-deadlift",
]);
const POWER = new Set(["power-clean", "clean-and-press"]); // power lifting, vigorous
const VIGOROUS_CALISTHENICS = new Set(["burpee", "jumping-jacks", "battle-ropes"]); // named in 02020
const HIGH_INTENSITY_BODYWEIGHT = new Set(["jump-squat", "box-jump", "mountain-climber"]);
// whole-body lifts get their own filter chip
const FULL_BODY = new Set(["kettlebell-swing-one-arm", "turkish-get-up", "kettlebell-clean", "kettlebell-thruster", "clean-and-press", "power-clean", "battle-ropes"]);

function metFor(e, group) {
  if (e.id === "kettlebell-swing-one-arm") return met("02058"); // kettlebell swings
  if (VIGOROUS_CALISTHENICS.has(e.id)) return met("02020");
  if (HIGH_INTENSITY_BODYWEIGHT.has(e.id)) return met("02057");
  if (POWER.has(e.id)) return met("02050");
  if (SQUAT_DEADLIFT.has(e.id)) return met("02052"); // squats or deadlift
  if (e.load_type === "external") return met("02054"); // multiple exercises, 8–15 reps, varied resistance
  if (group === "abs" || e.load_type === "timed") return met("02024"); // crunches, plank: light calisthenics
  return met("02022"); // push-ups, pull-ups, lunges: moderate calisthenics
}
// "Intense" (short rest, supersets): vigorous weight lifting / vigorous calisthenics
const intenseFor = (e, normal) => {
  const v = e.load_type === "external" ? met("02050") : met("02020");
  return v.value > normal.value ? v : normal;
};

const POP = { "very common": 3, common: 2, occasional: 1 };

const all = [...research.exercises, ...extra.exercises];
const dupes = all.map((e) => e.id).filter((id, i, ids) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error(`duplicate exercise ids: ${dupes.join(", ")}`);

const exercises = all.map((e) => {
  const f = e.fedb_id ? fedb.get(e.fedb_id) : null;
  if (e.fedb_id && !f) throw new Error(`${e.id}: ${e.fedb_id} not in data/free-exercise-db.json (run scripts/import-exercise-db.mjs)`);
  const photo = !!f && existsSync(`public/exercises/${e.id}-0.webp`);
  if (f && !photo) throw new Error(`${e.id}: photo missing (run scripts/import-exercise-db.mjs)`);
  const group = FULL_BODY.has(e.id) ? "full" : e.group;
  const normal = metFor(e, group);
  return {
    id: e.id,
    name: e.name,
    aliases: e.aliases,
    group,
    sub: group === "full" ? null : e.sub_group,
    equip: e.equipment,
    mech: e.mechanic,
    load: e.load_type,
    bwf: e.bodyweight_fraction,
    pop: POP[e.popularity] ?? 1,
    photo,
    frames: photo && existsSync(`public/exercises/${e.id}-1.webp`) ? 2 : photo ? 1 : 0,
    muscles: f?.primaryMuscles ?? [],
    also: f?.secondaryMuscles ?? [],
    met: normal,
    metIntense: intenseFor(e, normal),
  };
});

// Cardio + sports. Walking and running use the ACSM equations (speed + incline); everything else picks a
// Compendium entry. Labels are ours; METs come from burn-model.json by code.
const OPTIONS = {
  "stationary-cycle": [["01214", "Light · ~50 W"], ["01220", "Moderate · 90–100 W"], ["01228", "Hard · 126–150 W"], ["01232", "Very hard · 151–199 W"], ["01270", "Spin class"]],
  elliptical: [["02048", "Moderate"], ["02049", "Vigorous"]],
  "rowing-machine": [["02071", "Moderate · under 100 W"], ["02072", "100–149 W"], ["02073", "150–199 W"], ["02074", "200 W +"]],
  "stair-climber": [["02065", "Stair machine"], ["17133", "Real stairs, slow"], ["17131", "Real stairs"], ["17134", "Real stairs, fast"]],
  "skipping-rope": [["15552", "Under 100 skips/min"], ["15551", "100–120 skips/min"], ["15550", "120–160 skips/min"], ["15554", "Double unders"]],
  swimming: [["18240", "Freestyle, easy"], ["18230", "Freestyle, fast"], ["18265", "Breaststroke, easy"], ["18255", "Backstroke, easy"], ["18270", "Butterfly"], ["18310", "Leisure swim"]],
  cricket: [["15150", "Batting, bowling, fielding"]],
  badminton: [["15030", "Friendly game"], ["15020", "Competitive"], ["15025", "Match play"]],
  football: [["15610", "Casual"], ["15605", "Competitive"], ["15195", "Futsal"]],
  "yoga-hatha": [["02150", "Hatha"], ["02153", "Hatha, high intensity"]],
  "yoga-power": [["02160", "Power yoga"], ["02185", "Vinyasa"]],
  pranayama: [["02170", "Nadi shodhana / anulom vilom"]],
  "surya-namaskar": [["02180", "Surya namaskar"]],
  hiit: [["02210", "Moderate"], ["02214", "All-out (burpees, Tabata)"], ["02032", "Bodyweight circuit"]],
  zumba: [["02310", "Class"], ["02315", "At home"]],
};
const MODEL = { "treadmill-walk": "walk", "incline-walk": "walk", "outdoor-walk": "walk", "treadmill-run": "run", running: "run" };
// starting speed / incline for the steppers (UI defaults, not data)
const START = {
  "treadmill-walk": { speed: 5, incline: 0 }, "incline-walk": { speed: 4.5, incline: 10 }, "outdoor-walk": { speed: 5, incline: 0 },
  "treadmill-run": { speed: 9, incline: 0 }, running: { speed: 9, incline: 0 },
};

const activities = research.activities.map((a) => {
  const model = MODEL[a.id] ?? "met";
  const options = (OPTIONS[a.id] ?? []).map(([code, label]) => ({ ...met(code), label }));
  if (model === "met" && !options.length) throw new Error(`activity ${a.id} has no options`);
  return {
    id: a.id,
    name: a.name,
    aliases: a.aliases,
    model,
    incline: model !== "met" && a.inputs.includes("incline_pct"),
    start: START[a.id] ?? null,
    options,
  };
});

writeFileSync(OUT, JSON.stringify({ exercises, activities }) + "\n");
const steps = Object.fromEntries(all.filter((e) => e.fedb_id).map((e) => [e.id, fedb.get(e.fedb_id).instructions]));
writeFileSync(OUT_STEPS, JSON.stringify(steps) + "\n");
const withPhoto = exercises.filter((e) => e.photo).length;
console.log(`${exercises.length} exercises (${withPhoto} with photos), ${activities.length} activities → ${OUT}`);
