"use client";

import { useMemo } from "react";
import { CalorieRing } from "@/components/today/CalorieRing";
import { DateStrip } from "@/components/today/DateStrip";
import { MacroBars } from "@/components/today/MacroBars";
import { MealCard } from "@/components/today/MealCard";
import { CHAI_ID, QuickRow } from "@/components/today/QuickRow";
import { addDays, dayKey } from "@/lib/dates";
import { MEALS, totals } from "@/lib/nutrition";
import { useStore, useUI } from "@/lib/store";
import { useStreaks } from "@/lib/useStreaks";

export default function TodayPage() {
  const hydrated = useStore((s) => s.hydrated);
  const entries = useStore((s) => s.entries);
  const goals = useStore((s) => s.goals);
  const date = useUI((s) => s.date) ?? dayKey();
  const setDate = useUI((s) => s.setDate);
  const streak = useStreaks();
  const prev = addDays(date, -1);

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

  // phone: one column. desktop: summary column (sticky) + meals grid
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-4 lg:sticky lg:top-10">
        <DateStrip date={date} onChange={setDate} logged={logged} streak={streak.current} streakLive={streak.status.get(streak.today) === "on"} />

        <section className="card px-5 pb-5 pt-6">
          <CalorieRing eaten={t.kcal} goal={goals.kcal} />
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <Stat label="Eaten" value={t.kcal} />
            <span className="w-px bg-line-strong" />
            <Stat label="Goal" value={goals.kcal} />
          </div>
          <div className="mt-5 border-t border-line pt-5">
            <MacroBars totals={t} goals={goals} date={date} />
          </div>
        </section>

        <QuickRow date={date} />
      </div>

      <div className="space-y-4">
        <div className="hidden pt-9 lg:block">
          <h2 className="font-display text-2xl font-semibold">Meals</h2>
          <p className="text-sm text-muted">
            {day.length
              ? `${day.length} item${day.length === 1 ? "" : "s"} · ${t.kcal.toLocaleString("en-IN")} kcal`
              : "Nothing logged yet. Press N to add food."}
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
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="font-display text-xl font-semibold tabular">{value.toLocaleString("en-IN")}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-8 lg:space-y-0">
      <div className="space-y-4">
        <div className="skeleton h-28" />
        <div className="skeleton h-[26rem]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-28" />
          <div className="skeleton h-28" />
        </div>
      </div>
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:block lg:space-y-4 lg:pt-24 xl:grid xl:space-y-0">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}
      </div>
    </div>
  );
}
