// Badges (workouts.md "Achievements"). Derived from your history, never stored, so nothing can drift out of sync.
// PURE: no imports, so Node can test it. The app builds `Facts` from the store (lib/useBadges.ts).
// Every badge celebrates a habit (showing up, logging, training, beating yourself): never weight loss or eating
// less, same rule as the celebrations (D23) and greetings (D31).

/** Sorted YYYY-MM-DD lists: one entry per qualifying day (or session), oldest first. */
export type Facts = {
  foodBest: string[]; // bestDates of the food streak: [n-1] = day it first reached n
  workoutBest: string[];
  pranaBest: string[];
  foodDays: string[];
  onTargetDays: string[];
  proteinDays: string[];
  waterDays: string[];
  weighDays: string[];
  workoutDays: string[];
  prSessions: string[];
  routineSessions: string[];
  visits: string[];
  specials: Partial<Record<SpecialId, string>>;
};

export type Group = "streaks" | "training" | "habits";
export type Family = { id: string; name: string; emoji: string; group: Group; blurb: string; unit: [string, string]; tiers: [number, number, number, number]; from: Exclude<keyof Facts, "specials"> };

export const TIER_NAME = ["Bronze", "Silver", "Gold", "Diamond"] as const;

export const FAMILIES: Family[] = [
  { id: "food-streak", name: "On a roll", emoji: "🔥", group: "streaks", blurb: "Days in a row with food on target", unit: ["day", "days"], tiers: [5, 14, 30, 100], from: "foodBest" },
  { id: "workout-streak", name: "Iron habit", emoji: "💪", group: "streaks", blurb: "Workout days in a row (rest days never break it)", unit: ["day", "days"], tiers: [5, 14, 30, 60], from: "workoutBest" },
  { id: "prana-streak", name: "Prana balance", emoji: "✨", group: "streaks", blurb: "Days in a row with food on target and your workout done", unit: ["day", "days"], tiers: [3, 7, 21, 50], from: "pranaBest" },
  { id: "pr", name: "PR breaker", emoji: "🏆", group: "training", blurb: "Sessions where you beat a personal record", unit: ["session", "sessions"], tiers: [1, 10, 25, 50], from: "prSessions" },
  { id: "workouts", name: "Gym regular", emoji: "🏋️", group: "training", blurb: "Days you trained", unit: ["day", "days"], tiers: [10, 50, 100, 250], from: "workoutDays" },
  { id: "routines", name: "Game plan", emoji: "📋", group: "training", blurb: "Routine sessions logged", unit: ["session", "sessions"], tiers: [5, 25, 50, 100], from: "routineSessions" },
  { id: "visits", name: "Checked in", emoji: "📍", group: "training", blurb: "Gym visits of 20+ minutes", unit: ["visit", "visits"], tiers: [5, 25, 50, 100], from: "visits" },
  { id: "logged", name: "Food diary", emoji: "📒", group: "habits", blurb: "Days you logged what you ate", unit: ["day", "days"], tiers: [7, 30, 100, 365], from: "foodDays" },
  { id: "on-target", name: "Bullseye", emoji: "🎯", group: "habits", blurb: "Days within 80–105% of your calorie goal", unit: ["day", "days"], tiers: [7, 30, 100, 200], from: "onTargetDays" },
  { id: "protein", name: "Protein pro", emoji: "🥚", group: "habits", blurb: "Days you reached your protein goal", unit: ["day", "days"], tiers: [7, 30, 100, 200], from: "proteinDays" },
  { id: "water", name: "Hydrated", emoji: "💧", group: "habits", blurb: "Days with 8 glasses of water", unit: ["day", "days"], tiers: [7, 30, 100, 200], from: "waterDays" },
  { id: "weigh", name: "Check-in", emoji: "⚖️", group: "habits", blurb: "Days you logged your weight", unit: ["day", "days"], tiers: [7, 30, 100, 200], from: "weighDays" },
];

export type SpecialId = "first-food" | "first-workout" | "early-bird" | "weekend" | "comeback" | "perfect-week" | "bw-bench" | "thali" | "routine-made";
export type Special = { id: SpecialId; name: string; emoji: string; blurb: string };

export const SPECIALS: Special[] = [
  { id: "first-food", name: "First katori", emoji: "🥣", blurb: "Logged your first meal" },
  { id: "first-workout", name: "First sweat", emoji: "💦", blurb: "Logged your first workout" },
  { id: "thali", name: "Thali maker", emoji: "🍽️", blurb: "Saved a thali you eat often" },
  { id: "routine-made", name: "Planner", emoji: "🗒️", blurb: "Made your first routine" },
  { id: "early-bird", name: "Early bird", emoji: "🌅", blurb: "Logged a workout before 7 am" },
  { id: "weekend", name: "Weekend warrior", emoji: "⚔️", blurb: "Trained on a Saturday and the Sunday after" },
  { id: "comeback", name: "Comeback", emoji: "🔁", blurb: "Came back after a week away. That's the hard part" },
  { id: "perfect-week", name: "Perfect week", emoji: "🌟", blurb: "Food on target Monday to Sunday" },
  { id: "bw-bench", name: "Bodyweight bench", emoji: "🦾", blurb: "Est. 1-rep max on bench press at or above your body weight" },
];

export type FamilyState = {
  def: Family;
  value: number;
  /** earned tiers: dates[i] = the day tier i was reached */
  earned: string[];
  /** next target, or null when diamond */
  next: number | null;
};
export type SpecialState = { def: Special; date: string | null };
export type Unlock = { id: string; name: string; emoji: string; tier: number | null; date: string };

export type BadgeReport = {
  families: FamilyState[];
  specials: SpecialState[];
  /** everything earned, newest first */
  unlocks: Unlock[];
  earned: number;
  total: number;
  /** earned count per tier (bronze…diamond) */
  byTier: [number, number, number, number];
  /** the locked tier closest to done (by fraction), for "Next up" */
  closest: { state: FamilyState; left: number } | null;
};

export function evaluate(f: Facts): BadgeReport {
  const families = FAMILIES.map((def): FamilyState => {
    const list = f[def.from];
    const value = list.length;
    const earned = def.tiers.filter((t) => value >= t).map((t) => list[t - 1]);
    const next = def.tiers.find((t) => value < t) ?? null;
    return { def, value, earned, next };
  });
  const specials = SPECIALS.map((def): SpecialState => ({ def, date: f.specials[def.id] ?? null }));
  const unlocks: Unlock[] = [
    ...families.flatMap((s) => s.earned.map((date, i) => ({ id: `${s.def.id}:${i}`, name: s.def.name, emoji: s.def.emoji, tier: i, date }))),
    ...specials.filter((s) => s.date).map((s) => ({ id: s.def.id, name: s.def.name, emoji: s.def.emoji, tier: null, date: s.date! })),
  ].sort((a, b) => (a.date === b.date ? (b.tier ?? -1) - (a.tier ?? -1) : a.date < b.date ? 1 : -1));
  const byTier: [number, number, number, number] = [0, 0, 0, 0];
  for (const s of families) s.earned.forEach((_, i) => byTier[i]++);
  let closest: BadgeReport["closest"] = null;
  for (const s of families) {
    if (s.next == null || s.value === 0) continue;
    const frac = s.value / s.next;
    if (!closest || frac > closest.state.value / closest.state.next!) closest = { state: s, left: s.next - s.value };
  }
  return {
    families, specials, unlocks,
    earned: unlocks.length,
    total: FAMILIES.length * 4 + SPECIALS.length,
    byTier, closest,
  };
}

export const unitOf = (d: Family, n: number) => (n === 1 ? d.unit[0] : d.unit[1]);
