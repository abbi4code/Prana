"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Pencil, X } from "lucide-react";
import { AddBar } from "@/components/today/AddBar";
import { BurnCard } from "@/components/today/BurnCard";
import { CalorieRing } from "@/components/today/CalorieRing";
import { DateStrip } from "@/components/today/DateStrip";
import { Greeting } from "@/components/today/Greeting";
import { MacroBars } from "@/components/today/MacroBars";
import { MealCard } from "@/components/today/MealCard";
import { CHAI_ID, QuickRow } from "@/components/today/QuickRow";
import { addDays, dayKey } from "@/lib/dates";
import { MEALS, totals } from "@/lib/nutrition";
import { useStore, useUI } from "@/lib/store";
import { useStreaks } from "@/lib/useStreaks";
import { useDayWorkouts, useFitnessStreaks } from "@/lib/useWorkouts";

export default function TodayPage() {
  const hydrated = useStore((s) => s.hydrated);
  const entries = useStore((s) => s.entries);
  const goals = useStore((s) => s.goals);
  const setGoals = useStore((s) => s.setGoals);
  const date = useUI((s) => s.date) ?? dayKey();
  const setDate = useUI((s) => s.setDate);
  const streak = useStreaks();
  const fit = useFitnessStreaks();
  const burned = useDayWorkouts(date).kcal;
  const prev = addDays(date, -1);
  // the flame is the global streak (food + workout) once workouts are being logged; food-only users keep the food streak
  const flame = fit.started
    ? { n: fit.global.current, live: fit.global.status.get(fit.today) === "hit" }
    : { n: streak.current, live: streak.status.get(streak.today) === "on" };

  const { day, yesterday, logged } = useMemo(
    () => ({
      day: entries.filter((e) => e.date === date),
      yesterday: entries.filter((e) => e.date === prev),
      logged: new Set(entries.map((e) => e.date)),
    }),
    [entries, date, prev],
  );
  const t = totals(day);

  if (!hydrated) return <TodaySkeleton />;

  // greeting on top (full width), then phone: one column. desktop: summary column (sticky) + meals grid
  return (
    <>
      <div className="mb-4 lg:mb-7">
        <Greeting streak={flame.n} />
      </div>
      <div className="space-y-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0">
        <div className="space-y-4 lg:sticky lg:top-10">
          <DateStrip date={date} onChange={setDate} logged={logged} streak={flame.n} streakLive={flame.live} />
          <AddBar />

          <section className="card px-5 pb-5 pt-6">
            <CalorieRing eaten={t.kcal} goal={goals.kcal} />
            <div className="mt-4 grid grid-cols-4 divide-x divide-line-strong text-sm">
              <Stat label="Eaten" value={t.kcal} />
              <Stat label="Burned" value={burned} tone="text-jamun" />
              <Stat label="Net" value={t.kcal - burned} />
              <GoalStat goal={goals.kcal} onSave={(kcal) => setGoals({ ...goals, kcal })} />
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <MacroBars totals={t} goals={goals} date={date} />
            </div>
          </section>

          <QuickRow date={date} />
          <BurnCard date={date} />
        </div>

        <div className="space-y-4">
          <div className="hidden pt-9 lg:block">
            <h2 className="font-display text-2xl font-semibold">Meals</h2>
            <p className="text-sm text-muted">
              {day.length
                ? `${day.length} item${day.length === 1 ? "" : "s"} · ${t.kcal.toLocaleString("en-IN")} kcal`
                : "Nothing logged yet. Press / to add food or a workout."}
            </p>
          </div>
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:block lg:space-y-4 xl:grid xl:space-y-0">
            {MEALS.map((m) => (
              <MealCard
                key={m.id}
                meal={m.id}
                label={m.label}
                date={date}
                prevDate={prev}
                entries={day.filter((e) => e.meal === m.id && e.foodId !== CHAI_ID)}
                yesterday={yesterday.filter((e) => e.meal === m.id && e.foodId !== CHAI_ID)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="px-1 text-center">
      <p className={`font-display text-lg font-semibold tabular ${tone}`}>{value.toLocaleString("en-IN")}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}

/** Tap the goal to change the daily kcal right here (macros stay as set in Me). */
function GoalStat({ goal, onSave }: { goal: number; onSave: (kcal: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const v = Number(draft);
  const ok = draft != null && v >= 800 && v <= 6000;
  const save = () => {
    if (ok) onSave(Math.round(v));
    setDraft(null);
  };
  return (
    <div className="relative px-1 text-center">
      <AnimatePresence mode="wait" initial={false}>
        {draft == null ? (
          <motion.button
            key="view"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            onClick={() => setDraft(String(goal))}
            aria-label={`Daily goal ${goal} kcal. Edit`}
            className="group w-full"
          >
            <p className="font-display text-lg font-semibold tabular">{goal.toLocaleString("en-IN")}</p>
            <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-faint group-hover:text-turmeric">
              Goal <Pencil size={10} />
            </p>
          </motion.button>
        ) : (
          <motion.form
            key="edit"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={(e) => { e.preventDefault(); save(); }}
            className="flex flex-col items-center"
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
              inputMode="numeric"
              aria-label="Daily calorie goal"
              className="w-full rounded-lg border border-turmeric/60 bg-surface-2 text-center font-display text-lg font-semibold outline-none tabular"
            />
            <span className="mt-0.5 flex gap-1">
              <button type="submit" aria-label="Save goal" disabled={!ok} className="grid size-5 place-items-center rounded-full bg-cream text-bg disabled:opacity-30"><Check size={12} /></button>
              <button type="button" aria-label="Cancel" onClick={() => setDraft(null)} className="grid size-5 place-items-center rounded-full border border-line-strong text-muted"><X size={12} /></button>
            </span>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <>
      <div className="mb-4 min-h-[3.6rem] lg:mb-7 lg:min-h-[2.6rem]">
        <div className="skeleton h-7 w-2/3 lg:h-9 lg:w-1/2" />
      </div>
      <div className="space-y-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8 lg:space-y-0">
        <div className="space-y-4">
          <div className="skeleton h-28" />
          <div className="skeleton h-16" />
          <div className="skeleton h-[26rem]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton h-28" />
            <div className="skeleton h-28" />
          </div>
          <div className="skeleton h-20" />
        </div>
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:block lg:space-y-4 lg:pt-24 xl:grid xl:space-y-0">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}
        </div>
      </div>
    </>
  );
}
