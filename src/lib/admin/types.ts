// Admin panel (D51): shapes of what /api/admin/* returns. The stats mirror the jsonb built by the Postgres functions
// in supabase/migrations/20260927130000_admin.sql; the user bundle is raw rows in the sync tables' shape.
import type { FoodRow, GymRow, LogRow, MealRow, MeasurementRow, RoutineRow, VisitRow, WaterRow, WeightRow, WorkoutRow } from "../sync/rows";
import type { Verification } from "../types";

export type Section = "growth" | "food" | "training" | "system" | "social";
export type Counts = Record<string, number>;

export type Growth = {
  from: string; to: string; days: number;
  kpi: {
    users: number; new: number; newPrev: number; signedIn7: number;
    dau: number; wau: number; mau: number; active: number; activePrev: number;
    foodLogs: number; foodLogsPrev: number; workouts: number; workoutsPrev: number;
    foodLogsAll: number; workoutsAll: number; visitsAll: number;
  };
  series: { day: string; signups: number; active: number; foodUsers: number; foodLogs: number; workoutUsers: number; workouts: number }[];
  retention: Record<"d1" | "w1" | "w4", { eligible: number; returned: number }>;
  hours: { dow: number; hour: number; n: number }[];
  sources: Counts;
};

export type FoodStats = {
  from: string; to: string;
  meals: Counts;
  top: { id: string; name: string; logs: number; users: number; kcal: number }[];
  custom: { total: number; users: number; top: { name: string; users: number; logs: number }[] };
  days: { userDays: number; avgKcal: number | null; avgGoal: number | null; avgItems: number | null; on: number; under: number; over: number; p: number | null; c: number | null; f: number | null };
  series: { day: string; users: number; avgKcal: number | null; avgGoal: number | null; on: number; logs: number }[];
  water: { userDays: number; users: number; avg: number | null; eight: number };
  goals: {
    rows: number; avgGoal: number | null; avgProtein: number | null; noProfile: number;
    aim: Record<"lose" | "maintain" | "gain", number>; sex: Record<"male" | "female", number>;
    avgAge: number | null; avgWeight: number | null;
  };
  misc: { weighIns: number; weighUsers: number; corrections: number; thalis: number; thaliUsers: number; measureUsers: number };
};

export type TrainingStats = {
  from: string; to: string;
  series: { day: string; lifts: number; cardio: number; sets: number; kcal: number; users: number }[];
  refs: { ref: string; kind: "lift" | "cardio"; name: string; logs: number; users: number; sets: number; minutes: number }[];
  totals: { workouts: number; lifts: number; cardio: number; sets: number; cardioMinutes: number; kcal: number; users: number; userDays: number; fromRoutine: number; atGym: number };
  gym: {
    visits: number; counted: number; open: number; users: number; avgMin: number | null;
    verification: Partial<Record<Verification, number>>; status: Counts; source: Counts;
    series: { day: string; n: number; verified: number }[];
    failedChecks: number;
  };
  misc: { gyms: number; gymsLocated: number; gymsSearched: number; consentOn: number; consentOff: number; routines: number; routineUsers: number; burnGoalUsers: number };
};

export type SystemStats = {
  from: string; to: string;
  parse: { day: string; requests: number; users: number }[];
  cache: { entries: number; hits: number; newInPeriod: number; top: { text: string; hits: number }[] };
  corrections: { id: string; user: string; email: string | null; raw: string; parsed: unknown; confirmed: unknown; at: string }[];
  api: { bucket: string; day: string; requests: number; users: number }[];
  places: { entries: number; hits: number };
  audit: { id: number; admin: string; action: "view_user" | "export_user" | "resolve_report"; target: string | null; targetEmail: string | null; detail: Record<string, unknown> | null; at: string }[];
  storage: { database: number; tables: { table: string; rows: number; bytes: number }[] };
};

export type SocialStats = {
  from: string; to: string;
  kpi: {
    profiles: number; listed: number; newProfiles: number; friends: number; pending: number; blocks: number;
    reportsOpen: number; reportsResolved: number; challenges: number; kinds: Counts; states: Counts;
    members: number; disputes: number; flagged: number;
  };
  series: { day: string; active: number; verified: number; effort: number }[];
  top: { user: string; handle: string; name: string; avatar: string; active: number; effort: number; verified: number }[];
  reports: {
    id: number; reason: string; note: string | null; at: string; challenge: string | null;
    target: string; targetHandle: string | null; targetName: string | null; targetEmail: string | null;
    reporter: string | null; reporterHandle: string | null; openAgainst: number;
    /** the Akhada's own rule (social_hidden): off the global board until reports are resolved */
    hidden: boolean;
  }[];
  challenges: { id: string; title: string; kind: string; audience: string; target: number; startsOn: string; endsOn: string; cancelled: boolean; creator: string | null; members: number }[];
  duels: { total: number; active: number; settled: number; pending: number } | null;
};

export type StatsOf = { growth: Growth; food: FoodStats; training: TrainingStats; system: SystemStats; social: SocialStats };

export type UserSort = "active" | "joined" | "logs" | "name";
export type UserRow = {
  id: string; email: string | null; name: string | null; avatar: string | null; created_at: string; last_sign_in_at: string | null;
  logs: number; days: number; workouts: number; visits: number; active7: number;
  last_day: string | null; last_active: string | null; goal: number | null; aim: string | null; handle: string | null;
};
export type UserList = { total: number; rows: UserRow[] };

export type GoalsRow = {
  user_id: string; daily_kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  profile: { sex: "male" | "female"; age: number; heightCm: number; weightKg: number; activity: number; aim: "lose" | "maintain" | "gain" } | null;
  fitness: { burnGoal?: number | null; restDays?: number[] } | null;
  location_consent: boolean | null; location_consent_at: string | null; updated_at: string;
};

export type AdminUserBundle = {
  user: { id: string; email: string | null; name: string | null; avatar: string | null; provider: string | null; createdAt: string; lastSignInAt: string | null };
  goals: GoalsRow | null;
  logs: LogRow[];
  workouts: WorkoutRow[];
  weights: WeightRow[];
  water: WaterRow[];
  customFoods: FoodRow[];
  meals: MealRow[];
  routines: RoutineRow[];
  measurements: MeasurementRow[];
  gyms: GymRow[];
  visits: (VisitRow & { start_distance_m: number | null; start_accuracy_m: number | null; end_distance_m: number | null; created_at: string })[];
  corrections: { id: string; raw_input: string; parsed: unknown; confirmed: unknown; created_at: string }[];
  usage: { day: string; day_count: number }[];
  social: { handle: string; display_name: string; avatar: string; listed: boolean; created_at: string } | null;
  reports: { id: number; reason: string; note: string | null; created_at: string; resolved_at: string | null }[];
  activity: { day: string; sets: number; minutes: number; visited: boolean; verified: boolean; active: boolean; effort: number; flagged: number }[];
};

// ── missing-food requests (D54, admin_food_requests) ──
export type FoodRequestStatus = "new" | "alias" | "researching" | "found" | "not_found" | "junk";
export type FoodRequestFilter = "open" | "done" | "junk" | "all";
/** people = distinct users; asked / searched / ai / custom = distinct users per signal; times = every signal, repeats included */
export type FoodRequestRow = {
  id: number; name: string; status: FoodRequestStatus; reason: string | null; foodId: string | null;
  firstSeen: string; lastSeen: string; people: number; asked: number; searched: number; ai: number; custom: number; times: number;
};
export type FoodRequests = { counts: { open: number; done: number; junk: number; people: number }; rows: FoodRequestRow[] };

// ── shared foods review (D54 phase 2, admin_food_review) ──
export type CandidateSource = { id?: string; ref?: string; url?: string; image_url?: string; row_name?: string };
export type FoodCandidate = {
  id: number; foodId: string; data: import("../types").Food; source: CandidateSource; warnings: string[]; model: string | null;
  status: "pending" | "approved" | "rejected"; reason: string | null; createdAt: string; decidedAt: string | null; decidedBy: string | null;
  /** a shared food with this id is live now */
  live: boolean;
  request: { id: number; name: string; people: number } | null;
  /** what would stop Approve (server check: FoodSchema, built-in catalog ids, label mismatches); [] = can go live */
  problems: string[];
  /** D54 phase 4: the label image + what the vision model read (label foods only) */
  label: StoredLabel | null;
  labelNotes: string[];
  labelChecks: LabelCheck[] | null;
};
export type LabelPanel = { energy_kcal: number | null; energy_kj: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fibre_g: number | null; [k: string]: number | null };
export type StoredLabel = {
  image: string; error: string | null; model: string; read_at: string; read_by: string;
  reading: { is_nutrition_label: boolean; product: string | null; columns: string[]; per_100_basis: string | null; per_100: LabelPanel | null; serving: { size: number | null; unit: string | null; text: string | null }; per_serve: LabelPanel | null; notes: string } | null;
  per100: { kcal: number | null; p: number | null; c: number | null; f: number | null; fib: number | null; basis: string } | null;
};
export type LabelCheck = { field: "kcal" | "p" | "c" | "f" | "fib"; label: number | null; food: number | null; same: boolean | null };
export type SharedFoodRow = { id: string; data: import("../types").Food; approvedBy: string | null; approvedAt: string; retracted: boolean; requestName: string | null };
export type FoodReview = { candidates: FoodCandidate[]; shared: SharedFoodRow[] };
