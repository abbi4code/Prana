"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Moon, Target } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Fitness } from "@/lib/types";

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
        <label className="flex h-12 min-w-0 flex-1 items-center rounded-2xl border border-line-strong bg-surface-2 px-4 focus-within:border-jamun/60">
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
            className="h-12 shrink-0 rounded-2xl bg-cream px-5 font-bold text-bg"
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
