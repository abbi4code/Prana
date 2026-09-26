// Weekly Wrapped (engagement.md): a Monday–Sunday recap as swipeable cards + a share image.
// PURE: types-only / sibling .ts imports, so Node can test it directly.
//
// Rules (same as the rest of the app, D23/D24):
// - celebrate habits (on-target days, protein, water, training, PRs), never eating less; no kcal eaten anywhere in
//   Wrapped, and the share image has no kcal or body weight at all
// - streaks come from the caller's day judges (the same ones the streak cards use), so a new rule (festival days,
//   calorie bank) changes Wrapped with no change here
import type { Entry, Goals, Workout } from "./types";
import { PR_ORDER, type PrHit } from "./records.ts";
import type { Unlock } from "./badges";
import { addDays, parseDay } from "./dates.ts";
import { runStreak, type Judged } from "./streaks.ts";
import { weekActivity } from "./activity.ts";

/** How one day went for food: on target, logged (not on target: neutral, never shamed), nothing, or skipped (festival). */
export type FoodDot = "on" | "logged" | "none" | "skip";
export type WorkoutDot = "hit" | "rest" | "miss" | "none";

export const CHAI_IDS = new Set(["chai", "chai-no-sugar", "hot-tea"]);
/** The current week's Wrapped opens on Sunday from this hour. */
export const READY_HOUR = 18;
/** How long the Today banner offers a finished week (days after its Sunday). */
export const BANNER_DAYS = 2;

export type WrappedInput = {
  weekStart: string; // a Monday
  today: string;
  entries: Entry[];
  goals: Goals;
  water: Record<string, number>;
  workouts: Workout[];
  food: { first: string | null; day: (d: string) => FoodDot };
  /** null until the user has logged a workout or a gym visit (food-only users see no training card) */
  fitness: null | { first: string | null; workout: (d: string) => Judged; prana: (d: string) => Judged };
  prHits: PrHit[];
  unlocks: Unlock[];
  /** finished gym visits (ms), `counted` = long enough to count (D30) */
  visits: { start: number; end: number; counted: boolean }[];
};

export type Persona = { emoji: string; title: string; line: string };

export type WrappedWeek = {
  from: string;
  to: string;
  days: string[];
  hasData: boolean;
  food: {
    dots: FoodDot[];
    logged: number;
    onTarget: number;
    entries: number;
    top: { foodId: string; name: string; count: number }[];
    chai: number;
    newFoods: string[];
    /** average protein on logged days (g), and days that reached the goal */
    protein: { avg: number; goal: number; days: number };
    water: { glasses: number; days: number };
  };
  streak: { food: number; workout: number | null; prana: number | null };
  training: null | {
    dots: WorkoutDot[];
    workoutDays: number;
    sets: number;
    reps: number;
    /** kg × reps over every set with added weight */
    volumeKg: number;
    minutes: number;
    kcal: number;
    top: { name: string; sets: number } | null;
    move: number;
    strengthDays: number;
    visits: number;
    gymMinutes: number;
  };
  /** one per session that set a record (its headline kind) */
  prs: PrHit[];
  badges: Unlock[];
  persona: Persona;
};

/** Monday of the week that contains `day`. */
export function weekStartOf(day: string) {
  const dow = parseDay(day).getDay(); // 0 = Sunday
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

/** The newest week that can be wrapped at this moment: this week from Sunday READY_HOUR, else last week. */
export function latestWrappable(today: string, hour: number) {
  const start = weekStartOf(today);
  return parseDay(today).getDay() === 0 && hour >= READY_HOUR ? start : addDays(start, -7);
}

/** Show the Today banner for this finished week? (Sunday evening until BANNER_DAYS after, and not seen yet) */
export function bannerWeek(today: string, hour: number, seen: string | null): string | null {
  const w = latestWrappable(today, hour);
  const sunday = addDays(w, 6);
  if (today > addDays(sunday, BANNER_DAYS)) return null;
  return seen === w ? null : w;
}

export const weekLabel = (from: string) => {
  const a = parseDay(from), b = parseDay(addDays(from, 6));
  const m = (d: Date) => d.toLocaleDateString("en-IN", { month: "short" });
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)}`;
};

/** Streak length on `to`, walking the same judge the streak cards use. */
const streakOn = (first: string | null, to: string, judge: (d: string) => Judged) => runStreak(first, to, judge).current;

export function wrapWeek(x: WrappedInput): WrappedWeek {
  const from = x.weekStart;
  const to = addDays(from, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const inWeek = (d: string) => d >= from && d <= to && d <= x.today;
  const end = to < x.today ? to : x.today;

  // ── food ──
  const week = x.entries.filter((e) => inWeek(e.date));
  const dots = days.map((d) => (d > x.today ? "none" : x.food.day(d)));
  const byFood = new Map<string, { foodId: string; name: string; count: number }>();
  for (const e of week) {
    const f = byFood.get(e.foodId) ?? { foodId: e.foodId, name: e.name, count: 0 };
    f.count++;
    byFood.set(e.foodId, f);
  }
  const earlier = new Set(x.entries.filter((e) => e.date < from).map((e) => e.foodId));
  const newFoods = [...byFood.keys()].filter((id) => !earlier.has(id)).map((id) => byFood.get(id)!.name);
  const loggedDays = new Set(week.map((e) => e.date));
  const proteinBy = new Map<string, number>();
  for (const e of week) proteinBy.set(e.date, (proteinBy.get(e.date) ?? 0) + (e.p ?? 0));
  const proteinTotal = [...proteinBy.values()].reduce((t, p) => t + p, 0);
  const water = days.filter((d) => d <= x.today).map((d) => x.water[d] ?? 0);

  // ── training ──
  let training: WrappedWeek["training"] = null;
  const wk = x.workouts.filter((w) => inWeek(w.date));
  const visits = x.visits.filter((v) => v.counted && inWeek(localDay(v.start)));
  if (x.fitness) {
    const fit = x.fitness;
    const sets = wk.flatMap((w) => w.sets ?? []);
    const setsBy = new Map<string, { name: string; sets: number }>();
    for (const w of wk) if (w.kind === "lift") {
      const t = setsBy.get(w.refId) ?? { name: w.name, sets: 0 };
      t.sets += w.sets?.length ?? 0;
      setsBy.set(w.refId, t);
    }
    const act = weekActivity(wk, from, to);
    const wdots: WorkoutDot[] = days.map((d) => (d > x.today || !fit.first || d < fit.first ? "none" : fit.workout(d)));
    training = {
      dots: wdots,
      workoutDays: wdots.filter((j) => j === "hit").length,
      sets: sets.length,
      reps: sets.reduce((t, s) => t + (s.secs ? 0 : s.reps), 0),
      volumeKg: Math.round(sets.reduce((t, s) => t + (s.secs ? 0 : s.reps * s.kg), 0)),
      minutes: Math.round(wk.reduce((t, w) => t + w.minutes, 0)),
      kcal: Math.round(wk.reduce((t, w) => t + w.kcal, 0)),
      top: [...setsBy.values()].sort((a, b) => b.sets - a.sets)[0] ?? null,
      move: act.move,
      strengthDays: act.strengthDays,
      visits: visits.length,
      gymMinutes: Math.round(visits.reduce((t, v) => t + (v.end - v.start), 0) / 60_000),
    };
  }

  // one PR per session (its most meaningful kind, as the PR banner headlines it): a heavier bench set is one
  // record, not three (heaviest + est. 1RM + best set)
  const bySession = new Map<string, PrHit>();
  for (const h of x.prHits) {
    if (!inWeek(h.date)) continue;
    const cur = bySession.get(h.workoutId);
    if (!cur || PR_ORDER.indexOf(h.kind) < PR_ORDER.indexOf(cur.kind)) bySession.set(h.workoutId, h);
  }
  const prs = [...bySession.values()].sort((a, b) => a.createdAt - b.createdAt);
  const badges = x.unlocks.filter((u) => inWeek(u.date));

  const judgeFood = (d: string): Judged => {
    const s = x.food.day(d);
    return s === "on" ? "hit" : s === "skip" ? "rest" : "miss";
  };
  const out: WrappedWeek = {
    from, to, days,
    hasData: week.length > 0 || wk.length > 0 || visits.length > 0,
    food: {
      dots,
      logged: loggedDays.size,
      onTarget: dots.filter((d) => d === "on").length,
      entries: week.length,
      top: [...byFood.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 3),
      chai: week.filter((e) => CHAI_IDS.has(e.foodId)).reduce((t, e) => t + e.qty, 0),
      newFoods,
      protein: { avg: loggedDays.size ? Math.round(proteinTotal / loggedDays.size) : 0, goal: x.goals.p, days: x.goals.p > 0 ? [...proteinBy.values()].filter((p) => p >= x.goals.p).length : 0 },
      water: { glasses: water.reduce((t, g) => t + g, 0), days: water.filter((g) => g >= 8).length },
    },
    streak: {
      food: streakOn(x.food.first, end, judgeFood),
      workout: x.fitness ? streakOn(x.fitness.first, end, x.fitness.workout) : null,
      prana: x.fitness ? streakOn(x.fitness.first, end, x.fitness.prana) : null,
    },
    training,
    prs,
    badges,
    persona: { emoji: "", title: "", line: "" },
  };
  out.persona = persona(out);
  return out;
}

/** The streak worth celebrating: the Prana streak (food + workout) when it's going, else the food streak. null under 2 days. */
export function bestStreak(w: Pick<WrappedWeek, "streak">): { n: number; label: "Prana" | "food" } | null {
  if (w.streak.prana != null && w.streak.prana >= 2) return { n: w.streak.prana, label: "Prana" };
  if (w.streak.food >= 2) return { n: w.streak.food, label: "food" };
  return null;
}

/** One title for the week, the most remarkable habit first. Only ever praise; the fallback is "you showed up". */
export function persona(w: WrappedWeek): Persona {
  const t = w.training;
  if (w.food.onTarget === 7) return { emoji: "👑", title: "Perfect week", line: "Seven for seven. Katori-level precision." };
  if (w.prs.length >= 3) return { emoji: "🏆", title: "Record breaker", line: `${w.prs.length} personal records. Wickets falling everywhere.` };
  if (t && t.workoutDays >= 5) return { emoji: "🔥", title: "Gym regular", line: "The gym knows your name now." };
  if (w.food.protein.days >= 5) return { emoji: "💪", title: "Protein pro", line: "Protein goal, most days. Muscles are saying thank you." };
  if (w.food.logged === 7) return { emoji: "📒", title: "Never missed a log", line: "Every single day, logged. That's the whole game." };
  if (w.food.onTarget >= 4) return { emoji: "🎯", title: "On target", line: "More days on target than off. Discipline, one katori at a time." };
  if (w.food.water.days >= 5) return { emoji: "💧", title: "Hydration hero", line: "Eight glasses, again and again." };
  if (w.food.chai >= 14) return { emoji: "☕", title: "Chai connoisseur", line: "Two cups a day. Logged, every one." };
  if (w.food.newFoods.length >= 5) return { emoji: "🧭", title: "Food explorer", line: "New dishes, all logged. Curious and consistent." };
  if (t && t.workoutDays >= 3) return { emoji: "⚡", title: "Moving well", line: "Three or more workout days. Keep the rhythm." };
  return { emoji: "🌱", title: "Showing up", line: "You showed up. That's where every streak starts." };
}

/** Local day of a timestamp (visits are stored in ms). */
function localDay(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Weeks worth wrapping, newest first: from the week of the first log up to `latest`, only weeks with data. */
export function wrappableWeeks(firstDay: string | null, latest: string, hasData: (weekStart: string) => boolean, max = 12) {
  if (!firstDay) return [];
  const out: string[] = [];
  for (let w = latest; w >= weekStartOf(firstDay) && out.length < max; w = addDays(w, -7)) if (hasData(w)) out.push(w);
  return out;
}
