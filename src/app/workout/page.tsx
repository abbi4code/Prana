"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Dumbbell, Footprints } from "lucide-react";
import { DateStrip } from "@/components/today/DateStrip";
import { GymCard } from "@/components/workout/GymCard";
import { BurnSummary, WorkoutGoalsCard, WorkoutStreakCard } from "@/components/workout/WorkoutCards";
import { WorkoutList } from "@/components/workout/WorkoutList";
import { dayKey } from "@/lib/dates";
import { useStore, useUI } from "@/lib/store";
import { isRestDay, useDayWorkouts, useFitnessStreaks } from "@/lib/useWorkouts";

export default function WorkoutPage() {
  const hydrated = useStore((s) => s.hydrated);
  const workouts = useStore((s) => s.workouts);
  const fitness = useStore((s) => s.fitness);
  const date = useUI((s) => s.date) ?? dayKey();
  const setDate = useUI((s) => s.setDate);
  const openGym = useUI((s) => s.openGym);
  const { day, kcal, minutes, sets } = useDayWorkouts(date);
  const { workout, today } = useFitnessStreaks();
  const logged = useMemo(() => new Set(workouts.map((w) => w.date)), [workouts]);
  const rest = isRestDay(fitness.restDays, date);

  if (!hydrated) return <WorkoutSkeleton />;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-4 lg:sticky lg:top-10">
        <DateStrip date={date} onChange={setDate} logged={logged} streak={workout.current} streakLive={workout.status.get(today) === "hit"} />
        <GymCard />
        <BurnSummary date={date} kcal={kcal} minutes={minutes} sets={sets} rest={rest} />
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => openGym("strength")}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-jamun to-chilli font-bold text-white shadow-[0_10px_30px_-12px_var(--color-jamun)]"
          >
            <Dumbbell size={19} /> Exercise
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => openGym("cardio")}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface font-bold"
          >
            <Footprints size={19} className="text-jamun" /> Cardio
          </motion.button>
        </div>
      </div>

      <div className="space-y-4">
        <section className="card overflow-hidden lg:mt-[4.6rem]">
          <header className="flex items-center justify-between px-4 pb-2 pt-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Session</h2>
              <p className="text-xs text-muted tabular">
                {day.length ? `${day.length} ${day.length === 1 ? "entry" : "entries"} · ~${kcal.toLocaleString("en-IN")} kcal` : rest ? "Rest day. Recovery is training too." : "Nothing logged yet"}
              </p>
            </div>
          </header>
          {day.length ? (
            <WorkoutList workouts={day} />
          ) : (
            <button
              onClick={() => openGym("strength")}
              className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-4 text-left text-sm text-muted hover:bg-surface-2"
            >
              <Dumbbell size={18} className="shrink-0 text-jamun" />
              <span>
                Pick exercises by muscle or photo, then log sets × reps × kg.
                <span className="hidden lg:inline"> Shortcut: W.</span>
              </span>
            </button>
          )}
        </section>
        <div className="space-y-4 xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0">
          <WorkoutStreakCard />
          <WorkoutGoalsCard key={JSON.stringify(fitness)} fitness={fitness} />
        </div>
      </div>
    </div>
  );
}

function WorkoutSkeleton() {
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8 lg:space-y-0">
      <div className="space-y-4">
        <div className="skeleton h-28" />
        <div className="skeleton h-64" />
        <div className="skeleton h-14" />
      </div>
      <div className="space-y-4 lg:pt-[4.6rem]">
        <div className="skeleton h-40" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}
