"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Dumbbell, Moon, Plus } from "lucide-react";
import { useActiveVisit, useTick } from "@/components/workout/GymCard";
import { dayKey } from "@/lib/dates";
import { clock } from "@/lib/gym/visits";
import { useStore, useUI } from "@/lib/store";
import { isRestDay, useDayWorkouts } from "@/lib/useWorkouts";

/** Today's burn at a glance (D27): kept apart from food, with its own optional goal. Opens the Workout tab. */
export function BurnCard({ date }: { date: string }) {
  const { day, kcal, minutes } = useDayWorkouts(date);
  const goal = useStore((s) => s.fitness.burnGoal);
  const rest = useStore((s) => isRestDay(s.fitness.restDays, date));
  // at the gym right now (D30): a live timer replaces the summary line
  const visit = useActiveVisit();
  const live = visit && date === dayKey() ? visit : null;
  const tick = useTick(!!live);
  const skew = useUI((s) => s.clockSkew);
  const openGym = useUI((s) => s.openGym);
  const pct = goal ? Math.min(kcal / goal, 1) : 0;

  return (
    <section className="card relative flex items-center gap-4 p-4">
      <Link href="/workout" className="absolute inset-0 rounded-[inherit]" aria-label="Open workout" />
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-jamun/15 text-jamun">
        <Dumbbell size={21} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Burned</p>
          <p className="truncate text-xs text-muted tabular">
            {live ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-jamun">
                <span className="size-1.5 animate-pulse rounded-full bg-jamun" /> At the gym {tick ? clock(tick + (live.offline ? 0 : skew) - live.startedAt).replace(/:\d\d$/, "") : ""}
              </span>
            ) : day.length ? `${day.length} logged · ${minutes} min` : rest ? <span className="inline-flex items-center gap-1 text-sky"><Moon size={11} /> Rest day</span> : "No workout yet"}
          </p>
        </div>
        <p className="font-display text-2xl font-semibold leading-tight tabular">
          {kcal.toLocaleString("en-IN")}
          <span className="text-sm font-medium text-muted"> {goal ? `/ ${goal.toLocaleString("en-IN")} kcal` : "kcal"}</span>
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-jamun to-chilli"
            initial={{ width: 0 }}
            animate={{ width: goal ? `${pct * 100}%` : kcal ? "100%" : "0%" }}
            transition={{ type: "spring", stiffness: 70, damping: 18 }}
          />
        </div>
      </div>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => openGym("strength")}
        aria-label="Log a workout"
        className="relative grid size-9 shrink-0 place-items-center rounded-full bg-cream text-bg"
      >
        <Plus size={18} />
      </motion.button>
    </section>
  );
}
