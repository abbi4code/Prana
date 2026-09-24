"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Dumbbell, Flame, Moon, Snowflake, Target, Trophy } from "lucide-react";
import { Burst, useGoalHits } from "@/components/Burst";
import { RollingNumber } from "@/components/RollingNumber";
import { MAX_FREEZES, FREEZE_EVERY } from "@/lib/streaks";
import { useStore, useUI } from "@/lib/store";
import type { Fitness } from "@/lib/types";
import { useFitnessStreaks } from "@/lib/useWorkouts";

/** Big "burned" number, bar toward the optional daily burn goal, time and sets. */
export function BurnSummary({ date, kcal, minutes, sets, rest }: { date: string; kcal: number; minutes: number; sets: number; rest: boolean }) {
  const goal = useStore((s) => s.fitness.burnGoal);
  const showToast = useUI((s) => s.showToast);
  const hits = useGoalHits(kcal, goal ?? 0, date, () => showToast("Burn goal done. Strong session."));
  const pct = goal ? Math.min(kcal / goal, 1) : 0;

  return (
    <section className="card relative overflow-hidden p-5">
      <Burst trigger={hits} />
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full opacity-35 blur-3xl" style={{ background: kcal ? "var(--color-jamun)" : "transparent" }} />
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Burned</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="font-display text-6xl font-semibold leading-none tracking-tight">
          <RollingNumber value={kcal} />
          <span className="ml-1.5 text-lg font-medium text-muted">kcal</span>
        </p>
        {goal ? <p className="pb-1 text-sm text-muted tabular">of {goal.toLocaleString("en-IN")}</p> : null}
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-3">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-jamun to-chilli"
          style={{ boxShadow: "0 0 14px var(--color-jamun)" }}
          initial={{ width: 0 }}
          animate={{ width: goal ? `${pct * 100}%` : kcal ? "100%" : "0%" }}
          transition={{ type: "spring", stiffness: 70, damping: 18 }}
        />
      </div>
      <div className="mt-4 flex gap-5 text-sm">
        <Stat value={minutes} label="minutes" />
        <Stat value={sets} label="sets" />
        {rest && !kcal ? (
          <p className="ml-auto flex items-center gap-1.5 self-center rounded-full bg-sky/12 px-3 py-1 text-xs font-semibold text-sky">
            <Moon size={13} /> Rest day
          </p>
        ) : null}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        Estimates (about ±25%): calories above resting only, from the Compendium of Physical Activities 2024. Kept separate from your food goal.
      </p>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-xl font-semibold tabular">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}

export function WorkoutStreakCard() {
  const { workout, today, started } = useFitnessStreaks();
  const todayOn = workout.status.get(today) === "hit";
  const { current, best, freezes, hits } = workout;
  return (
    <section className="card relative overflow-hidden p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Workout streak</p>
      <div className="mt-2 flex items-end gap-3">
        <motion.span
          animate={current ? { scale: [1, 1.12, 1], rotate: [0, -6, 0] } : {}}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }}
          className={`grid size-14 place-items-center rounded-2xl ${current ? "bg-jamun/15 text-jamun" : "bg-surface-2 text-faint"}`}
        >
          <Dumbbell size={28} strokeWidth={2.2} />
        </motion.span>
        <div>
          <p className="font-display text-5xl font-semibold leading-none">
            <RollingNumber value={current} />
          </p>
          <p className="mt-1 text-sm text-muted">
            {!started ? "Log a workout to start" : `workout ${current === 1 ? "day" : "days"}${todayOn ? ", today included" : ""}`}
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Mini icon={<Trophy size={15} className="text-turmeric" />} value={best} label="best" />
        <Mini icon={<Flame size={15} className="text-jamun" />} value={hits} label="workout days" />
        <div className="rounded-2xl bg-surface-2 px-2 py-2.5">
          <div className="flex justify-center gap-1">
            {Array.from({ length: MAX_FREEZES }, (_, i) => (
              <Snowflake key={i} size={17} className={i < freezes ? "text-sky" : "text-faint/50"} />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">freezes</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        A workout day = your burn goal reached (or any workout, if you haven&apos;t set one). Rest days you picked never break it. Every {FREEZE_EVERY} days earns a freeze.
      </p>
    </section>
  );
}

function Mini({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-2.5">
      <p className="flex items-center justify-center gap-1 font-display text-xl font-semibold tabular">{icon}{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

// Monday first, JS weekday numbers (0 = Sunday)
const WEEK = [
  [1, "M"], [2, "T"], [3, "W"], [4, "T"], [5, "F"], [6, "S"], [0, "S"],
] as const;
const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Daily burn goal (optional) + which weekdays are rest days. Synced with the other goals. */
export function WorkoutGoalsCard({ fitness }: { fitness: Fitness }) {
  const setFitness = useStore((s) => s.setFitness);
  const [goal, setGoal] = useState(fitness.burnGoal ? String(fitness.burnGoal) : "");
  const parsed = goal.trim() ? Math.round(Number(goal)) : null;
  const valid = parsed === null || (parsed > 0 && parsed <= 5000);
  const dirty = valid && parsed !== fitness.burnGoal;

  const toggleRest = (d: number) => {
    const restDays = fitness.restDays.includes(d) ? fitness.restDays.filter((x) => x !== d) : [...fitness.restDays, d].sort();
    setFitness({ ...fitness, restDays });
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <Target size={16} className="text-jamun" />
        <h2 className="font-display text-lg font-semibold">Workout goals</h2>
      </div>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Daily burn goal (optional)</p>
      <div className="mt-2 flex gap-2">
        <label className="flex h-12 flex-1 items-center rounded-2xl border border-line-strong bg-surface-2 px-4 focus-within:border-jamun/60">
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="e.g. 300"
            className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold outline-none tabular placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-faint"
          />
          <span className="text-sm text-muted">kcal</span>
        </label>
        {dirty && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFitness({ ...fitness, burnGoal: parsed })}
            className="h-12 rounded-2xl bg-cream px-5 font-bold text-bg"
          >
            Save
          </motion.button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {fitness.burnGoal ? "The workout streak counts days you reach it." : "No goal: any logged workout counts for your streak."} It never changes your food goal.
      </p>

      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Rest days</p>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {WEEK.map(([d, letter]) => {
          const on = fitness.restDays.includes(d);
          return (
            <motion.button
              key={d}
              whileTap={{ scale: 0.9 }}
              onClick={() => toggleRest(d)}
              aria-pressed={on}
              aria-label={`${DAY_NAME[d]}: ${on ? "rest day" : "workout day"}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-sm font-bold transition-colors ${
                on ? "border-sky/50 bg-sky/15 text-sky" : "border-line-strong bg-surface-2 text-muted"
              }`}
            >
              {letter}
              {on && <Moon size={11} className="mt-0.5" />}
            </motion.button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        {fitness.restDays.length
          ? `${fitness.restDays.map((d) => DAY_NAME[d].slice(0, 3)).join(", ")} off. Skipping a workout on these days won't break a streak.`
          : "No rest days: every day counts. Tap a day to make it a rest day."}
      </p>
    </section>
  );
}
