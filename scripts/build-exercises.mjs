// Builds the app's exercise + activity catalog (decision D27, .claude/workouts.md).
//   input:  data/exercises.json         research: 200 exercises (free-exercise-db ids) + 20 activities
//           data/exercises-extra.json   common exercises free-exercise-db lacks (no photo)
//           data/free-exercise-db.json  muscles + instructions (scripts/import-exercise-db.mjs)
//           data/burn-model.json        Compendium 2024 METs, looked up by code, so every number has a source
//           data/lift-energy.json       per-set energy vs work (Scott / Knausenberger), research round 2
//           data/lift-energy-2.json     machine exercises with loads in kg (Reis 2017), bar travel (Montoro 2025), round 3
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

// ── Lifting burn v2 (workouts.md "Lifting burn model v2"): energy per set = Σ reps × (a + b × load_kg) + set ──
// Every coefficient is computed here from the research files, so each one traces to a table.
const L1 = read("data/lift-energy.json");
const L2 = read("data/lift-energy-2.json");
const KJ_PER_KCAL = 4.184;
const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
const r5 = (n) => Math.round(n * 1e5) / 1e5;

function scottGroup(label, entry, dispM, dispSource) {
  if (!entry?.regression?.slope) throw new Error(`lift model: no regression for ${label}`);
  // per-set kJ = slope × (kg × m × reps) + intercept  →  per rep: slope × m × kg ; per set: intercept (both → kcal)
  // (Scott's "J" are kg·m, see lift-energy.json meta; energy includes the anaerobic part and recovery)
  return { label, a: 0, b: r5((entry.regression.slope * dispM) / KJ_PER_KCAL), set: r5(entry.regression.intercept / KJ_PER_KCAL),
    src: `${entry.study_id} regression × ${dispM.toFixed(3)} m bar travel (${dispSource})` };
}
const knaus = (name) => L1.energy_per_work.find((e) => e.study_id === "knausenberger2014" && e.exercise.startsWith(name));
// the bar travel their own regression was fitted on: work ÷ (kg × reps) over their measured sets
const impliedTravel = (name) => median(knaus(name).data_points.map((p) => p.work_reported / (p.load_kg * p.reps)));
const benchTravel = L2.displacement.find((d) => d.pattern === "bench_press_smith")?.vertical_m;
if (!benchTravel) throw new Error("lift model: Smith bench travel missing (lift-energy-2.json)");

// Reis 2017: machine exercises at 12–24 % 1RM, 15 reps/min, gross kcal/min → net per rep (minus 1 MET of the
// 78.67 kg subjects, same resting convention as the rest of the app), straight-line fit over load in kg.
const REIS_BODY_KG = 78.67;
const oneMetKcalMin = (3.5 * REIS_BODY_KG * 5) / 1000;
function reisGroup(label, name) {
  const pts = L2.energy_sets.filter((e) => e.study_id === "reis2017" && e.exercise.startsWith(name) && e.load.pct_1rm <= 24);
  if (pts.length < 3) throw new Error(`lift model: Reis points missing for ${name}`);
  const xs = pts.map((p) => p.load.kg), ys = pts.map((p) => (p.energy.value - oneMetKcalMin) / 15);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const b = xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0) / xs.reduce((t, x) => t + (x - mx) ** 2, 0);
  return { label, a: r5(my - b * mx), b: r5(b), set: 0, src: `reis2017 Table 1 (${pts.length} loads, ${xs[0]}–${xs.at(-1)} kg), net of 1 MET` };
}

const REP_GROUPS = {
  bench: scottGroup("Bench / chest press", L1.energy_per_work.find((e) => e.study_id === "scott2009"), benchTravel, "montoro2025 Smith bench"),
  incline: scottGroup("Incline / overhead press", knaus("incline_press"), impliedTravel("incline_press"), "knausenberger2014 data"),
  squat: scottGroup("Squat", knaus("squat"), impliedTravel("squat"), "knausenberger2014 data"),
  deadlift: scottGroup("Deadlift / hinge", knaus("deadlift"), impliedTravel("deadlift"), "knausenberger2014 data"),
  shrug: scottGroup("Shrug", knaus("shrug"), impliedTravel("shrug"), "knausenberger2014 data"),
  calf: scottGroup("Calf raise", knaus("calf_raise"), impliedTravel("calf_raise"), "knausenberger2014 data"),
  legpress: reisGroup("Leg press", "45-deg inclined leg press"),
  legext: reisGroup("Leg extension / curl", "seated leg extension"),
  pulldown: reisGroup("Pulldown / row", "wide-grip front lat pulldown"),
  curl: reisGroup("Curl / small muscle", "arm curl"),
  triceps: reisGroup("Triceps extension", "standing triceps extension"),
};

// Share of body weight lifted in bodyweight moves that map onto a measured group.
const bwf = (name) => {
  const f = [...L1.bodyweight_fractions, ...L2.bodyweight_fractions_new].find((x) => x.exercise === name && x.fraction != null)?.fraction;
  if (f == null) throw new Error(`lift model: no body-weight fraction for ${name}`);
  return f;
};
// pull-up: whole body minus both hands + forearms, which stay on the bar (Winter segment table)
const forearmHand = L1.segments.find((x) => x.segment === "forearm_and_hand")?.mass_fraction;
const PULL_UP_BW = r5(1 - 2 * forearmHand);

// Which measured movement each exercise uses (judgement; listed in workouts.md). Not listed → time × MET model.
const REP_MAP = {
  bench: ["barbell-bench-press", "decline-barbell-bench-press", "wide-grip-bench-press", "dumbbell-bench-press", "decline-dumbbell-press",
    "dumbbell-fly", "incline-dumbbell-fly", "pec-deck-fly", "cable-crossover", "low-to-high-cable-fly", "flat-bench-cable-fly", "incline-cable-fly",
    "machine-chest-press", "plate-loaded-chest-press", "smith-machine-bench-press", "dumbbell-pullover", "close-grip-bench-press", "seated-dip-machine",
    "push-up", "decline-push-up-feet-elevated", "incline-push-up-hands-elevated", "wide-push-up", "knee-push-up", "close-grip-push-up", "chest-dips", "triceps-dips"],
  incline: ["incline-barbell-bench-press", "incline-dumbbell-press", "incline-chest-press-machine", "smith-machine-incline-press",
    "overhead-press-military-press", "seated-barbell-shoulder-press", "dumbbell-shoulder-press", "arnold-press", "shoulder-press-machine",
    "smith-machine-shoulder-press", "behind-the-neck-press", "kettlebell-overhead-press"],
  squat: ["barbell-back-squat", "full-squat-deep", "front-squat", "smith-machine-squat", "hack-squat-machine", "pendulum-squat", "goblet-squat",
    "dumbbell-squat", "dumbbell-lunge", "barbell-lunge", "reverse-lunge", "dumbbell-split-squat", "dumbbell-step-up", "bulgarian-split-squat"],
  deadlift: ["deadlift", "rack-pull", "trap-bar-deadlift", "romanian-deadlift", "stiff-leg-deadlift", "dumbbell-stiff-leg-deadlift", "sumo-deadlift",
    "single-leg-rdl", "good-morning"],
  shrug: ["barbell-shrug", "dumbbell-shrug", "machine-shrug", "cable-shrug"],
  calf: ["standing-calf-raise", "seated-calf-raise", "leg-press-calf-raise", "smith-machine-calf-raise", "dumbbell-calf-raise", "donkey-calf-raise"],
  legpress: ["leg-press", "barbell-hip-thrust", "barbell-glute-bridge", "hip-thrust-machine", "cable-pull-through"],
  legext: ["leg-extension", "single-leg-extension", "lying-leg-curl", "seated-leg-curl", "standing-leg-curl", "hip-abduction-machine",
    "hip-adduction-machine", "cable-hip-adduction", "cable-glute-kickback"],
  pulldown: ["lat-pulldown", "close-grip-lat-pulldown", "v-bar-pulldown", "reverse-grip-lat-pulldown", "behind-the-neck-pulldown",
    "single-arm-lat-pulldown", "straight-arm-pulldown", "rope-straight-arm-pulldown", "barbell-pullover", "barbell-row", "underhand-barbell-row",
    "one-arm-dumbbell-row", "bent-over-dumbbell-row", "chest-supported-dumbbell-row", "t-bar-row", "chest-supported-t-bar-row", "seated-cable-row",
    "single-arm-seated-cable-row", "machine-row", "high-row-machine", "smith-machine-row", "kettlebell-row",
    "pull-up", "chin-up", "weighted-pull-up", "band-assisted-pull-up", "assisted-pull-up-machine"],
  curl: ["barbell-curl", "ez-bar-curl", "dumbbell-curl", "alternate-dumbbell-curl", "hammer-curl", "cross-body-hammer-curl", "concentration-curl",
    "barbell-preacher-curl", "dumbbell-preacher-curl", "preacher-curl-machine", "incline-dumbbell-curl", "cable-curl", "rope-hammer-curl", "spider-curl",
    "reverse-barbell-curl", "zottman-curl", "barbell-wrist-curl", "reverse-wrist-curl", "dumbbell-wrist-curl",
    "dumbbell-lateral-raise", "seated-lateral-raise", "cable-lateral-raise", "machine-lateral-raise", "dumbbell-front-raise", "plate-front-raise",
    "cable-front-raise", "reverse-pec-deck", "dumbbell-reverse-fly", "seated-rear-delt-raise", "cable-rear-delt-fly", "face-pull",
    "barbell-upright-row", "dumbbell-upright-row", "smith-machine-upright-row"],
  triceps: ["triceps-pushdown", "rope-pushdown", "v-bar-pushdown", "reverse-grip-pushdown", "overhead-rope-extension", "single-arm-cable-pushdown",
    "skull-crusher", "dumbbell-overhead-extension", "one-arm-overhead-extension", "dumbbell-kickback", "triceps-extension-machine"],
};
const GROUP_OF = new Map(Object.entries(REP_MAP).flatMap(([g, ids]) => ids.map((id) => [id, g])));
// bodyweight moves: the load is this share of body mass (+ any kg added, − counterweight when assisted)
const BW_LOAD = {
  "push-up": bwf("push_up_regular"), "wide-push-up": bwf("push_up_regular"), "close-grip-push-up": bwf("push_up_regular"),
  "decline-push-up-feet-elevated": bwf("push_up_feet_on_30.5cm_box"), "incline-push-up-hands-elevated": bwf("push_up_hands_on_30.5cm_box"),
  "knee-push-up": bwf("push_up_knees"), "chest-dips": bwf("dip"), "triceps-dips": bwf("dip"),
  "pull-up": PULL_UP_BW, "chin-up": PULL_UP_BW, "weighted-pull-up": PULL_UP_BW, "band-assisted-pull-up": PULL_UP_BW, "assisted-pull-up-machine": PULL_UP_BW,
};
// dumbbell moves done with two dumbbells: the kg entered is per dumbbell, so the load is doubled
const SINGLE_DB = new Set(["one-arm-dumbbell-row", "concentration-curl", "dumbbell-preacher-curl", "one-arm-overhead-extension", "dumbbell-overhead-extension",
  "dumbbell-kickback", "dumbbell-pullover", "goblet-squat", "single-leg-rdl", "kettlebell-row", "plate-front-raise"]);
function repFor(e) {
  const g = GROUP_OF.get(e.id);
  if (!g) return null;
  const perSide = (e.equipment === "dumbbell" || e.equipment === "kettlebell") && !SINGLE_DB.has(e.id);
  return { g, perSide, bw: BW_LOAD[e.id] ?? null };
}

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
    rep: repFor(e),
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

for (const id of GROUP_OF.keys()) if (!exercises.some((e) => e.id === id)) throw new Error(`lift model: unknown exercise id ${id}`);
for (const e of exercises) if (e.rep && e.load === "bodyweight" && e.rep.bw == null) throw new Error(`lift model: ${e.id} is bodyweight but has no body-weight share`);
writeFileSync(OUT, JSON.stringify({ exercises, activities, repGroups: REP_GROUPS }) + "\n");
const steps = Object.fromEntries(all.filter((e) => e.fedb_id).map((e) => [e.id, fedb.get(e.fedb_id).instructions]));
writeFileSync(OUT_STEPS, JSON.stringify(steps) + "\n");
const withPhoto = exercises.filter((e) => e.photo).length;
console.log(`${exercises.length} exercises (${withPhoto} with photos), ${activities.length} activities → ${OUT}`);
console.log(`lift model v2: ${exercises.filter((e) => e.rep).length} exercises on per-rep costs, ${exercises.filter((e) => !e.rep).length} on time × MET`);
for (const [k, g] of Object.entries(REP_GROUPS)) console.log(`  ${k.padEnd(9)} per rep ${g.a} + ${g.b}·kg, per set +${g.set} kcal  (${g.src})`);
