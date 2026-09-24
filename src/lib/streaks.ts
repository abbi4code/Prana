// Streak rules (decision D24). Pure functions, no app imports, so they can be tested in isolation.

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
};

const next = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/**
 * Walks every day from the first logged day to today.
 * - on target: streak +1; every 7th day earns a freeze (max 2)
 * - anything else (not logged, under, over): spends a freeze if there is one, otherwise the streak resets
 * - today only counts once it's on target; an unfinished today never breaks the streak
 */
export function computeStreaks(kcalByDay: Map<string, number>, goal: number, today: string): StreakResult {
  const status = new Map<string, DayStatus>();
  const frozen = new Set<string>();
  const logged = [...kcalByDay.keys()].filter((d) => d <= today).sort();
  let current = 0, best = 0, freezes = 0, onTargetDays = 0;
  if (!logged.length) return { current, best, freezes, frozen, status, onTargetDays };

  for (let d = logged[0]; d <= today; d = next(d)) {
    const s = dayStatus(kcalByDay.get(d) ?? 0, goal);
    status.set(d, s);
    if (s === "on") {
      onTargetDays++;
      current++;
      best = Math.max(best, current);
      if (current % FREEZE_EVERY === 0 && freezes < MAX_FREEZES) freezes++;
    } else if (d === today) {
      // still in progress
    } else if (current > 0 && freezes > 0) {
      freezes--;
      frozen.add(d);
    } else {
      current = 0;
    }
  }
  return { current, best, freezes, frozen, status, onTargetDays };
}
