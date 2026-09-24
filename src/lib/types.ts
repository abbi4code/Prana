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
