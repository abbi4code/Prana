"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Droplets, Dumbbell, MapPin, Mic, Scale, Sparkles, Utensils } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { ActivityIcon, ExercisePhoto } from "@/components/workout/ExercisePhoto";
import type { UserModel } from "@/lib/admin/userModel";
import { dayLabel } from "@/lib/dates";
import { getExercise, setsSummary } from "@/lib/exercises";
import { getFood } from "@/lib/foods";
import { MEALS, fmtQty, totals } from "@/lib/nutrition";
import { dayStatus } from "@/lib/streaks";
import { nf } from "./ui";

const STATUS = {
  on: { label: "On target", cls: "bg-leaf/15 text-leaf" },
  under: { label: "Under goal", cls: "bg-turmeric/15 text-turmeric" },
  over: { label: "Over goal", cls: "bg-chilli/15 text-chilli" },
  none: { label: "No food logged", cls: "bg-surface-3 text-muted" },
} as const;
const VERIFY: Record<string, string> = {
  verified: "location verified", outside_radius: "too far from the gym", low_accuracy: "fuzzy location",
  permission_denied: "location blocked", unavailable: "no location fix", not_checked: "not verified",
};
const time = (iso: string | number) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Everything one member logged on one day, like their Today screen, with arrows through the days that have data. */
export function UserDay({ m, day, onDay }: { m: UserModel; day: string; onDay: (d: string) => void }) {
  const entries = useMemo(() => m.entries.filter((e) => e.date === day), [m.entries, day]);
  const workouts = useMemo(() => m.workouts.filter((w) => w.date === day), [m.workouts, day]);
  const visits = useMemo(() => m.visits.filter((v) => v.day === day), [m.visits, day]);
  const t = totals(entries);
  const status = dayStatus(t.kcal, m.goals.kcal);
  const weight = m.weights.find((w) => w.date === day);
  const water = m.water.get(day) ?? 0;
  const burn = workouts.reduce((s, w) => s + w.kcal, 0);
  const i = m.activeDays.indexOf(day);
  const older = i >= 0 ? m.activeDays[i + 1] : m.activeDays.find((d) => d < day);
  const newer = i > 0 ? m.activeDays[i - 1] : i === -1 ? [...m.activeDays].reverse().find((d) => d > day) : undefined;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Day by day</p>
          <h3 className="mt-1 font-display text-2xl font-semibold">{dayLabel(day)}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => older && onDay(older)} disabled={!older} aria-label="Earlier day with logs" className="grid size-9 place-items-center rounded-full border border-line-strong text-muted hover:text-text disabled:opacity-30">
            <ChevronLeft size={17} />
          </button>
          <input
            type="date"
            value={day}
            max={m.today}
            onChange={(e) => e.target.value && onDay(e.target.value)}
            aria-label="Pick a day"
            className="h-9 rounded-full border border-line-strong bg-surface-2 px-3 text-sm text-text outline-none [color-scheme:inherit] focus:border-turmeric/60"
          />
          <button onClick={() => newer && onDay(newer)} disabled={!newer} aria-label="Later day with logs" className="grid size-9 place-items-center rounded-full border border-line-strong text-muted hover:text-text disabled:opacity-30">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {/* the day in numbers */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[status].cls}`}>{STATUS[status].label}</span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs tabular"><b>{nf(t.kcal)}</b> / {nf(m.goals.kcal)} kcal</span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs tabular">P <b className="text-chilli">{nf(t.p)}</b> · C <b className="text-turmeric">{nf(t.c)}</b> · F <b className="text-saffron">{nf(t.f)}</b> g</span>
            {burn > 0 && <span className="rounded-full bg-jamun/15 px-2.5 py-1 text-xs font-semibold text-jamun tabular">~{nf(burn)} kcal burned</span>}
            {water > 0 && <span className="flex items-center gap-1 rounded-full bg-sky/15 px-2.5 py-1 text-xs font-semibold text-sky"><Droplets size={12} /> {water} glasses</span>}
            {weight && <span className="flex items-center gap-1 rounded-full bg-brass/15 px-2.5 py-1 text-xs font-semibold text-brass"><Scale size={12} /> {weight.kg} kg</span>}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint"><Utensils size={13} /> Food</p>
              {entries.length ? (
                <div className="space-y-4">
                  {MEALS.map((meal) => {
                    const list = entries.filter((e) => e.meal === meal.id);
                    if (!list.length) return null;
                    return (
                      <div key={meal.id}>
                        <p className="flex justify-between text-sm font-semibold">
                          {meal.label} <span className="font-normal text-muted tabular">{nf(totals(list).kcal)} kcal</span>
                        </p>
                        <ul className="mt-1.5 space-y-1.5">
                          {list.map((e) => {
                            const food = getFood(e.foodId);
                            return (
                              <li key={e.id} className="flex items-start gap-2.5 rounded-xl bg-surface-2/60 px-2.5 py-2">
                                {food ? <FoodIcon cat={food.cat} size={32} /> : <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-[9px] font-bold text-muted">OWN</span>}
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className="truncate text-sm font-semibold">{e.name}</span>
                                    {e.source === "text" && <Sparkles size={12} className="shrink-0 text-saffron" aria-label="typed sentence" />}
                                    {e.source === "voice" && <Mic size={12} className="shrink-0 text-sky" aria-label="voice" />}
                                  </span>
                                  <span className="block text-xs text-muted">{fmtQty(e.qty)} × {e.unitLabel.replace(/^1 /, "")} · {nf(e.grams)} g · {time(e.createdAt)}</span>
                                  {e.rawInput && <span className="mt-0.5 block truncate text-[11px] italic text-faint">&ldquo;{e.rawInput}&rdquo;</span>}
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block font-display text-base font-semibold tabular">{nf(e.kcal)}</span>
                                  <span className="block text-[10px] text-faint tabular">{e.p != null ? `${nf(e.p)}p ${nf(e.c)}c ${nf(e.f)}f` : "no macros"}</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">No food logged.</p>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-faint"><Dumbbell size={13} /> Training</p>
              {workouts.length ? (
                <ul className="space-y-1.5">
                  {workouts.map((w) => {
                    const ex = w.kind === "lift" ? getExercise(w.refId) : undefined;
                    const prs = m.records.hitsByWorkout.get(w.id)?.length ?? 0;
                    return (
                      <li key={w.id} className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-2.5 py-2">
                        {ex ? <ExercisePhoto ex={ex} className="w-12 shrink-0 rounded-lg" /> : <ActivityIcon id={w.refId} size={32} />}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            <span className="truncate">{w.name}</span>
                            {prs > 0 && <span className="shrink-0 rounded-full bg-turmeric/15 px-1.5 text-[10px] font-bold text-turmeric">🏆 PR</span>}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {w.kind === "lift" ? setsSummary(w, ex) : `${nf(w.minutes)} min${w.speedKmh ? ` · ${w.speedKmh} km/h` : ""}`} · {time(w.createdAt)}
                            {w.visitId ? " · at the gym" : ""}{w.routineId ? " · routine" : ""}
                          </span>
                        </span>
                        <span className="shrink-0 font-display text-base font-semibold text-jamun tabular">~{nf(w.kcal)}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
                  {m.fitness.restDays.includes(new Date(`${day}T12:00`).getDay()) ? "Planned rest day." : "No workout logged."}
                </p>
              )}
              {visits.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {visits.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs">
                      <MapPin size={14} className={v.startVerification === "verified" ? "text-leaf" : "text-faint"} />
                      <span className="font-semibold">Gym {time(v.startedAt)}{v.endedAt ? `–${time(v.endedAt)}` : " (still there)"}</span>
                      <span className="text-muted">{v.minutes != null ? `${v.minutes} min` : ""} · {VERIFY[v.startVerification] ?? v.startVerification}</span>
                      {!v.counted && v.endedAt && <span className="ml-auto text-faint">under 20 min</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
