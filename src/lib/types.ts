export type Category =
  | "breakfast" | "roti_bread" | "rice" | "dal" | "sabzi" | "paneer" | "egg" | "non_veg"
  | "snack" | "sweet" | "dairy" | "fruit" | "beverage" | "condiment" | "nuts" | "soup" | "supplement" | "cereal";

export type UnitKind =
  | "g" | "katori" | "bowl" | "plate" | "piece" | "glass" | "cup" | "tbsp" | "tsp" | "handful" | "pack" | "scoop";

export type FoodUnit = { id: string; kind: UnitKind; label: string; g: number };

/** One row of src/data/foods.generated.json (built by scripts/build-foods.mjs). */
export type Food = {
  id: string;
  name: string;
  hi: string | null;
  aliases: string[];
  cat: Category;
  diet: "vegan" | "veg" | "egg" | "non_veg";
  /** per 100 g; macros are null when the source row failed the macro check */
  kcal: number;
  p: number | null;
  c: number | null;
  f: number | null;
  fib: number | null;
  units: FoodUnit[];
  du: string;
  /** "user" = created by the owner (custom food) */
  conf: "high" | "medium" | "low" | "user";
  src: string;
  /** deep-fried INDB row: kcal includes full frying oil, so it's a high estimate */
  fried: boolean;
  /** raw grain/dal/flour/egg, weighed before cooking */
  uncooked: boolean;
  note: string | null;
};

export type Meal = "breakfast" | "lunch" | "snacks" | "dinner";

/** A logged food. Nutrition is snapshotted at log time (decision D05). */
export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD
  meal: Meal;
  foodId: string;
  name: string;
  unitId: string;
  unitLabel: string;
  qty: number;
  grams: number;
  kcal: number;
  p: number | null;
  c: number | null;
  f: number | null;
  createdAt: number;
  /** how it was logged; absent on entries made before natural-language logging */
  source?: LogSource;
  /** the sentence it came from (text/voice) */
  rawInput?: string;
};

export type LogSource = "manual" | "text" | "voice";

export type Goals = { kcal: number; p: number; c: number; f: number };

/** One line of a saved meal. Nutrition is computed when it's logged (entries snapshot, D05). */
export type ThaliItem = { foodId: string; unitId: string; qty: number };

/** A named meal you eat often ("Office lunch"), logged in one tap. */
export type SavedMeal = { id: string; name: string; meal: Meal; items: ThaliItem[]; createdAt: number };

export type Profile = {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: 1.2 | 1.375 | 1.55 | 1.725;
  aim: "lose" | "maintain" | "gain";
};

export type WeightLog = { date: string; kg: number };

// ── Workouts (decision D27, .claude/workouts.md) ──

export type MuscleGroup = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms" | "abs" | "legs" | "full";

/** A Compendium 2024 activity: code + MET, looked up from data/burn-model.json at build time. */
export type Met = { code: string; value: number };

/** One row of src/data/exercises.generated.json (built by scripts/build-exercises.mjs). */
export type Exercise = {
  id: string;
  name: string;
  aliases: string[];
  group: MuscleGroup;
  sub: string | null;
  equip: string;
  mech: "compound" | "isolation" | null;
  /** external = kg you add; bodyweight = reps (+ optional kg); assisted = counterweight kg; timed = seconds */
  load: "external" | "bodyweight" | "assisted" | "timed";
  /** share of body mass moved (push-ups only, Ebben 2011) */
  bwf: number | null;
  /** 3 = very common in Indian gyms, 1 = occasional */
  pop: 1 | 2 | 3;
  /** has start/end photos in public/exercises (free-exercise-db) */
  photo: boolean;
  frames: number;
  muscles: string[];
  also: string[];
  met: Met;
  /** short rest / supersets */
  metIntense: Met;
  /** lifting burn v2: which measured movement this uses; null = time × MET model (core, conditioning, bands…) */
  rep: { g: string; perSide: boolean; bw: number | null } | null;
};

/** Measured per-rep cost of a movement (net kcal): per rep a + b × load_kg, plus `set` once per set. */
export type RepGroup = { label: string; a: number; b: number; set: number; src: string };

/** Cardio or sport. walk/run use the ACSM equations; "met" picks one of `options`. */
export type Activity = {
  id: string;
  name: string;
  aliases: string[];
  model: "walk" | "run" | "met";
  incline: boolean;
  start: { speed: number; incline: number } | null;
  options: (Met & { label: string })[];
};

/** One set. `secs` replaces reps for timed holds (plank). kg = weight added (or counterweight when assisted). */
export type WorkSet = { reps: number; kg: number; secs?: number };

/** A logged exercise or cardio bout. Burn is snapshotted at log time, like food (D05). */
export type Workout = {
  id: string;
  date: string; // YYYY-MM-DD
  kind: "lift" | "cardio";
  /** exercise or activity id */
  refId: string;
  name: string;
  // lift
  sets?: WorkSet[];
  restSec?: number;
  intense?: boolean;
  // cardio
  speedKmh?: number;
  inclinePct?: number;
  optionCode?: string;
  minutes: number;
  /** effective MET used */
  met: number;
  /** estimated kcal above resting */
  kcal: number;
  createdAt: number;
  /** "rep" = lifting burn v2 (per-rep costs); absent = time × MET (v1 or cardio) */
  burn?: "rep";
  /** gym visit this was logged during (D30); calories never come from the visit itself */
  visitId?: string;
};

/** Workout goals. restDays uses JS weekday numbers (0 = Sunday). */
export type Fitness = { burnGoal: number | null; restDays: number[] };


// ── Gym check-in (decision D30, .claude/gym-checkin.md) ──

export type Verification = "verified" | "outside_radius" | "low_accuracy" | "permission_denied" | "unavailable" | "not_checked";

/** The user's gym. lat/lng stay null until a location is saved (phase 3). Synced (user_gyms). */
export type Gym = { id: string; name: string; lat: number | null; lng: number | null; radiusM: number; createdAt: number };

/** A visit as stored by the server (gym_visits). Written only by the API; the device keeps a read-only copy. */
export type GymVisit = {
  id: string;
  gymId: string | null;
  startedAt: string; // ISO, server clock (device clock when source = web_offline)
  endedAt: string | null;
  status: "active" | "completed" | "auto_closed";
  startVerification: Verification;
  endVerification: Verification | null;
  source: "web_manual" | "web_offline" | "native_geofence";
};

/** A visit saved only on this device (offline, or as a guest), uploaded once signed in and online. */
export type LocalVisit = { id: string; gymId: string | null; startedAt: number; endedAt: number | null };
