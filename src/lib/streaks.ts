// Streak rules (decisions D24 food, D27 workout + global). Pure functions, no app imports, so they can be tested in isolation.

export type DayStatus = "none" | "under" | "on" | "over";

/** The one definition of a disciplined day: logged, and within 80–105% of the calorie goal. */
export function dayStatus(kcal: number, goal: number): DayStatus {
  if (kcal <= 0) return "none";
  if (kcal < goal * 0.8) return "under";
  if (kcal <= goal * 1.05) return "on";
  return "over";
}

export const FREEZE_EVERY = 7; // on-target days to earn a freeze
export const MAX_FREEZES = 2;

export type StreakResult = {
  current: number;
  best: number;
  freezes: number;
  /** days where a freeze saved the streak */
  frozen: Set<string>;
  status: Map<string, DayStatus>;
  onTargetDays: number;
  /** bestDates[n - 1] = the day the streak first reached n (badges) */
  bestDates: string[];
};

const next = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** How one day counts for a streak. "rest" = a planned rest day: it neither adds to nor breaks the streak. */
export type Judged = "hit" | "miss" | "rest";

export type RunResult = {
  current: number; best: number; freezes: number; frozen: Set<string>; hits: number;
  /** bestDates[n - 1] = the day the streak first reached n days (for badges) */
  bestDates: string[];
};

/**
 * Walks every day from `first` to today.
 * - hit: streak +1; every 7th day earns a freeze (max 2)
 * - rest: skipped
 * - miss: spends a freeze if there is one, otherwise the streak resets
 * - today only counts once it's a hit; an unfinished today never breaks the streak
 */
export function runStreak(first: string | null, today: string, judge: (day: string) => Judged): RunResult {
  const frozen = new Set<string>();
  let current = 0, best = 0, freezes = 0, hits = 0;
  const bestDates: string[] = [];
  if (!first) return { current, best, freezes, frozen, hits, bestDates };

  for (let d = first; d <= today; d = next(d)) {
    const j = judge(d);
    if (j === "hit") {
      hits++;
      current++;
      if (current > best) bestDates.push(d);
      best = Math.max(best, current);
      if (current % FREEZE_EVERY === 0 && freezes < MAX_FREEZES) freezes++;
    } else if (j === "rest" || d === today) {
      // rest day, or today still in progress
    } else if (current > 0 && freezes > 0) {
      freezes--;
      frozen.add(d);
    } else {
      current = 0;
    }
  }
  return { current, best, freezes, frozen, hits, bestDates };
}

/** Food streak (D24): on target = logged and 80–105% of the goal. */
export function computeStreaks(kcalByDay: Map<string, number>, goal: number, today: string): StreakResult {
  const status = new Map<string, DayStatus>();
  const first = [...kcalByDay.keys()].filter((d) => d <= today).sort()[0] ?? null;
  const r = runStreak(first, today, (d) => {
    const s = dayStatus(kcalByDay.get(d) ?? 0, goal);
    status.set(d, s);
    return s === "on" ? "hit" : "miss";
  });
  return { current: r.current, best: r.best, freezes: r.freezes, frozen: r.frozen, status, onTargetDays: r.hits, bestDates: r.bestDates };
}

/**
 * Workout day (D27): with a daily burn goal, hit = burned at least the goal; without one, hit = any workout logged.
 * A counted gym visit (≥ MIN_VISIT_MINUTES, D30) is always a hit.
 * A missed planned rest day is "rest", so it never breaks the streak.
 */
export function workoutDay(logged: boolean, burned: number, burnGoal: number | null, restDay: boolean, visited = false): Judged {
  if (visited) return "hit"; // a counted gym visit (D30) makes it a workout day, whatever the burn
  if (logged && (burnGoal == null || burned >= burnGoal)) return "hit";
  return restDay ? "rest" : "miss";
}

/** Global "Prana" day: food on target and the workout side done (hit, or a planned rest day). */
export const globalDay = (food: DayStatus, workout: Judged): Judged => (food === "on" && workout !== "miss" ? "hit" : "miss");
