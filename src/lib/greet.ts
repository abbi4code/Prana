// Today's greeting (decision D31, .claude/greetings.md). PURE: no app imports, so it can be tested with Node.
// A line that fits the moment (streak, back after a break, at the gym…) is preferred; otherwise a general one,
// sometimes one for this time of day. Recently shown lines are skipped so the pool lasts months.

export type GreetTime = "any" | "early" | "morning" | "afternoon" | "evening" | "night" | "late";
export type GreetCtx =
  | "any" | "streak" | "back_after_break" | "first_day" | "at_gym" | "workout_done" | "rest_day"
  | "nothing_logged" | "on_track" | "monday" | "weekend";

/** One row of src/data/greetings.generated.json (built by scripts/build-greetings.mjs). */
export type Greeting = {
  id: string; t: string; time: GreetTime; ctx: GreetCtx; topic: "gym" | "food" | "general"; bro: boolean;
  /** assumes a working day (office, commute, college): not on weekends */
  work: boolean;
};

/** What the app knows right now. Everything is worked out on the device from the store. */
export type GreetState = {
  hour: number;
  /** 0 = Sunday */
  weekday: number;
  /** first name from the Google account; null for guests */
  name: string | null;
  streak: number;
  firstDay: boolean;
  backAfterBreak: boolean;
  atGym: boolean;
  workoutDone: boolean;
  restDay: boolean;
  nothingLogged: boolean;
  onTrack: boolean;
  /** has ever logged a workout / saved a gym: only then do gym-themed lines make sense */
  gymUser: boolean;
  /** profile says female: skip lines that call you bhai/bro/dude */
  female: boolean;
};

/** Streak lines only once a streak means something. */
export const MIN_STREAK = 3;
/** Recently shown ids not repeated (the general pool alone is 500+). */
export const RECENT_MAX = 80;

export function timeSlot(hour: number): Exclude<GreetTime, "any"> {
  if (hour < 4) return "late";
  if (hour < 7) return "early";
  if (hour < 12) return "morning";
  if (hour < 16) return "afternoon";
  if (hour < 20) return "evening";
  return "night";
}

/**
 * How often a matching moment wins over a general line. The rarer and more personal the moment, the higher:
 * a first day or a return after a break should almost always be acknowledged; "it's the weekend" only sometimes.
 */
const CHANCE: Record<Exclude<GreetCtx, "any">, number> = {
  first_day: 1,
  back_after_break: 0.9,
  at_gym: 0.85,
  rest_day: 0.6,
  workout_done: 0.5,
  streak: 0.5,
  nothing_logged: 0.4,
  on_track: 0.4,
  monday: 0.4,
  weekend: 0.3,
};
/** A general line for this time of day instead of an any-time one, when some exist. */
const TIMED_CHANCE = 0.4;

/** The moments that apply now, most specific first. */
export function moments(s: GreetState): Exclude<GreetCtx, "any">[] {
  const out: Exclude<GreetCtx, "any">[] = [];
  if (s.firstDay) out.push("first_day");
  if (s.backAfterBreak) out.push("back_after_break");
  if (s.atGym) out.push("at_gym");
  if (s.restDay && !s.workoutDone && !s.atGym && s.gymUser) out.push("rest_day");
  if (s.workoutDone && !s.atGym) out.push("workout_done");
  if (s.streak >= MIN_STREAK) out.push("streak");
  if (s.nothingLogged) out.push("nothing_logged");
  if (s.onTrack) out.push("on_track");
  if (s.weekday === 1) out.push("monday");
  if (s.weekday === 0 || s.weekday === 6) out.push("weekend");
  return out;
}

/** Can this line be shown to this person right now (time, name, streak, gym, bhai/bro)? */
export function fits(g: Greeting, s: GreetState): boolean {
  if (g.time !== "any" && g.time !== timeSlot(s.hour)) return false;
  if (g.bro && s.female) return false;
  if (g.work && (s.weekday === 0 || s.weekday === 6)) return false;
  // "log kiya ya bhool gaye?" only after lunch; mornings get the breakfast nudges (time "morning")
  if (g.ctx === "nothing_logged" && g.time === "any" && s.hour < 13) return false;
  if (g.t.includes("{name}") && !s.name) return false;
  if (g.t.includes("{streak}") && s.streak < MIN_STREAK) return false;
  // gym lines: not for food-only users, and not on a rest day you're actually resting
  if (g.topic === "gym" && (!s.gymUser || (s.restDay && !s.workoutDone && !s.atGym))) return false;
  // general gym lines are mostly "go train" nudges: not once today's workout is done (unless still at the gym)
  if (g.topic === "gym" && g.ctx === "any" && s.workoutDone && !s.atGym) return false;
  return true;
}

export function pickGreeting(pool: Greeting[], s: GreetState, recent: readonly string[], rand: () => number = Math.random): Greeting | null {
  const seen = new Set(recent);
  const usable = pool.filter((g) => fits(g, s));
  const fresh = usable.filter((g) => !seen.has(g.id));
  const any = (list: Greeting[]) => (list.length ? list[Math.floor(rand() * list.length)] : null);

  for (const m of moments(s)) {
    if (rand() >= CHANCE[m]) continue;
    const g = any(fresh.filter((x) => x.ctx === m));
    if (g) return g;
  }
  const general = fresh.filter((x) => x.ctx === "any");
  const timed = general.filter((x) => x.time !== "any");
  if (timed.length && rand() < TIMED_CHANCE) return any(timed);
  // everything shown recently: repeat an older general line rather than show nothing
  return any(general) ?? any(usable.filter((x) => x.ctx === "any"));
}

export type GreetPart = { text: string; slot?: "name" | "streak" };

/** The line split into plain text and filled-in slots, so the UI can highlight the name / streak. */
export function greetParts(g: Pick<Greeting, "t">, s: Pick<GreetState, "name" | "streak">): GreetPart[] {
  return g.t
    .split(/(\{name\}|\{streak\})/)
    .filter(Boolean)
    .map((p) => (p === "{name}" ? { text: s.name ?? "", slot: "name" } : p === "{streak}" ? { text: String(s.streak), slot: "streak" } : { text: p }));
}
