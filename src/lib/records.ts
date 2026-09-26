// Personal records (workouts.md "PRs"). Derived from the workout log, never stored: editing or deleting a log
// fixes the records by itself. PURE: types-only imports, so Node can test it directly.
//
// Rules
// - Walk every log oldest → newest; per exercise and per record kind keep the best so far.
// - The first value of a kind is a baseline, not a PR (otherwise day one celebrates everything).
// - A PR is strictly better than every earlier log. "assist" (counterweight) is better when LOWER.
// - Estimated 1-rep max = Brzycki (1993), w × 36 / (37 − reps), only for sets of 1–10 reps: prediction
//   accuracy falls as reps rise (LeSuer 1997: ≤ 10 reps to fatigue predicts 1RM well; Reynolds 2006: 5RM best).
//   Our sets aren't always to failure, so it's labelled "est." and reads as a floor, not a test result.
import type { Activity, Exercise, WorkSet, Workout } from "./types";

export type PrKind = "weight" | "e1rm" | "set" | "reps" | "added" | "assist" | "hold" | "minutes" | "speed" | "distance";

/** Most meaningful first: the banner headlines the first kind hit for an exercise. */
export const PR_ORDER: PrKind[] = ["weight", "e1rm", "added", "reps", "assist", "hold", "set", "distance", "speed", "minutes"];

export const PR_LABEL: Record<PrKind, string> = {
  weight: "Heaviest", e1rm: "Est. 1-rep max", set: "Best set", reps: "Most reps", added: "Most added weight",
  assist: "Least assistance", hold: "Longest hold", minutes: "Longest session", speed: "Fastest", distance: "Farthest",
};

const LOWER_IS_BETTER = new Set<PrKind>(["assist"]);
const EPS = 1e-6;

export const E1RM_MAX_REPS = 10;
/** Brzycki (1993). One rep = the weight itself. */
export const brzycki = (kg: number, reps: number) => (reps <= 1 ? kg : (kg * 36) / (37 - reps));

/** What kind of thing a workout is, looked up by the caller (keeps this module free of catalog imports). */
export type RefInfo = { kind: "lift"; load: Exercise["load"] } | { kind: "cardio"; model: Activity["model"] };

export type Metric = { value: number; set?: WorkSet };

const round = (n: number, step: number) => Math.round(n / step) * step;

/** Every record-worthy number in one log. */
export function metrics(w: Pick<Workout, "kind" | "sets" | "minutes" | "speedKmh">, info: RefInfo): Partial<Record<PrKind, Metric>> {
  const out: Partial<Record<PrKind, Metric>> = {};
  if (info.kind === "cardio") {
    if (w.minutes > 0) out.minutes = { value: Math.round(w.minutes) };
    // speed and distance only for walks/runs long enough to mean something
    if (info.model !== "met" && w.speedKmh && w.minutes >= 5) {
      out.speed = { value: w.speedKmh };
      out.distance = { value: round((w.minutes / 60) * w.speedKmh, 0.01) };
    }
    return out;
  }
  const sets = (w.sets ?? []).filter((s) => (s.secs != null ? s.secs > 0 : s.reps >= 1));
  if (!sets.length) return out;
  const best = (score: (s: WorkSet) => number, lower = false) =>
    sets.reduce((a, b) => (lower ? (score(b) < score(a) ? b : a) : score(b) > score(a) || (score(b) === score(a) && b.reps > a.reps) ? b : a));

  if (info.load === "timed") {
    const s = best((x) => x.secs ?? 0);
    out.hold = { value: s.secs ?? 0, set: s };
    return out;
  }
  if (info.load === "assisted") {
    const s = best((x) => x.kg, true);
    out.assist = { value: s.kg, set: s };
    out.reps = { value: best((x) => x.reps).reps, set: best((x) => x.reps) };
    return out;
  }
  if (info.load === "bodyweight") {
    const r = best((x) => x.reps);
    out.reps = { value: r.reps, set: r };
    const heavy = best((x) => x.kg);
    if (heavy.kg > 0) out.added = { value: heavy.kg, set: heavy };
    return out;
  }
  // external load
  const loaded = sets.filter((s) => s.kg > 0);
  if (!loaded.length) return out;
  const heavy = loaded.reduce((a, b) => (b.kg > a.kg || (b.kg === a.kg && b.reps > a.reps) ? b : a));
  out.weight = { value: heavy.kg, set: heavy };
  const vol = loaded.reduce((a, b) => (b.kg * b.reps > a.kg * a.reps ? b : a));
  out.set = { value: vol.kg * vol.reps, set: vol };
  const short = loaded.filter((s) => s.reps <= E1RM_MAX_REPS);
  if (short.length) {
    const e = short.reduce((a, b) => (brzycki(b.kg, b.reps) > brzycki(a.kg, a.reps) ? b : a));
    out.e1rm = { value: round(brzycki(e.kg, e.reps), 0.5), set: e };
  }
  return out;
}

export type Best = Metric & { workoutId: string; date: string };
export type PrHit = Metric & { kind: PrKind; prev: number; workoutId: string; refId: string; name: string; date: string; createdAt: number };
export type ExerciseRecord = { refId: string; name: string; kind: "lift" | "cardio"; sessions: number; lastDate: string; best: Partial<Record<PrKind, Best>> };
export type Records = {
  byRef: Map<string, ExerciseRecord>;
  /** PRs set by each log */
  hitsByWorkout: Map<string, PrHit[]>;
  /** every PR ever set, newest first */
  recent: PrHit[];
};

const better = (kind: PrKind, v: number, best: number) => (LOWER_IS_BETTER.has(kind) ? v < best - EPS : v > best + EPS);

export function computeRecords(workouts: Workout[], infoOf: (w: Workout) => RefInfo | null): Records {
  const byRef = new Map<string, ExerciseRecord>();
  const hitsByWorkout = new Map<string, PrHit[]>();
  const recent: PrHit[] = [];
  const ordered = [...workouts].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  for (const w of ordered) {
    const info = infoOf(w);
    if (!info) continue;
    let rec = byRef.get(w.refId);
    if (!rec) byRef.set(w.refId, (rec = { refId: w.refId, name: w.name, kind: w.kind, sessions: 0, lastDate: w.date, best: {} }));
    rec.sessions++;
    rec.lastDate = w.date;
    rec.name = w.name;
    const m = metrics(w, info);
    for (const kind of PR_ORDER) {
      const v = m[kind];
      if (!v) continue;
      const b = rec.best[kind];
      if (b && better(kind, v.value, b.value)) {
        const hit: PrHit = { ...v, kind, prev: b.value, workoutId: w.id, refId: w.refId, name: w.name, date: w.date, createdAt: w.createdAt };
        recent.push(hit);
        hitsByWorkout.set(w.id, [...(hitsByWorkout.get(w.id) ?? []), hit]);
      }
      if (!b || better(kind, v.value, b.value)) rec.best[kind] = { ...v, workoutId: w.id, date: w.date };
    }
  }
  recent.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  return { byRef, hitsByWorkout, recent };
}

/** Which records a not-yet-logged draft would break (live "PR" badge while editing). Needs an earlier baseline. */
export function wouldBreak(m: Partial<Record<PrKind, Metric>>, rec: ExerciseRecord | undefined): PrKind[] {
  if (!rec) return [];
  return PR_ORDER.filter((k) => m[k] && rec.best[k] && better(k, m[k]!.value, rec.best[k]!.value));
}

const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} kg`;
const secs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} min` : `${s} s`);

/** "62.5 kg × 5", "72 kg", "12 reps", "1:30 min", "5.2 km" */
export function formatPr(kind: PrKind, m: Metric): string {
  switch (kind) {
    case "weight": return m.set ? `${kg(m.value)} × ${m.set.reps}` : kg(m.value);
    case "e1rm": return kg(m.value);
    case "set": return m.set ? `${kg(m.set.kg)} × ${m.set.reps}` : `${Math.round(m.value)} kg`;
    case "reps": return `${m.value} reps`;
    case "added": return `+${kg(m.value)}`;
    case "assist": return m.value === 0 ? "no assistance" : `${kg(m.value)} assist`;
    case "hold": return secs(m.value);
    case "minutes": return `${m.value} min`;
    case "speed": return `${m.value} km/h`;
    case "distance": return `${m.value.toFixed(2).replace(/\.?0+$/, "")} km`;
  }
}

/** "+2.5 kg", "+2 reps", "−5 kg" (assist), "+15 s" */
export function formatGain(hit: Pick<PrHit, "kind" | "value" | "prev">): string {
  const d = hit.value - hit.prev;
  const n = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  switch (hit.kind) {
    case "weight": case "e1rm": case "added": return `+${n(d)} kg`;
    case "assist": return `−${n(-d)} kg`;
    case "set": return `+${Math.round(d)} kg moved`;
    case "reps": return `+${d} rep${d === 1 ? "" : "s"}`;
    case "hold": return `+${d} s`;
    case "minutes": return `+${d} min`;
    case "speed": return `+${n(d)} km/h`;
    case "distance": return `+${d.toFixed(2).replace(/\.?0+$/, "")} km`;
  }
}

/** The headline record for an exercise's list row. */
export function headline(rec: ExerciseRecord): { kind: PrKind; best: Best } | null {
  for (const k of PR_ORDER) if (rec.best[k]) return { kind: k, best: rec.best[k]! };
  return null;
}
