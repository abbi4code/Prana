"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { addDays, parseDay } from "@/lib/dates";
import type { DayStatus, Judged } from "@/lib/streaks";
import { useStreaks } from "@/lib/useStreaks";
import { useFitnessStreaks } from "@/lib/useWorkouts";

const WEEKS = 53;
type Mode = "food" | "workout" | "both";
type Cell = { cls: string; label: string };

const FOOD: Record<DayStatus | "frozen", Cell> = {
  on: { cls: "bg-leaf", label: "on target" },
  under: { cls: "bg-turmeric/45", label: "under target" },
  over: { cls: "bg-chilli/70", label: "over target" },
  frozen: { cls: "bg-sky/80", label: "saved by a freeze" },
  none: { cls: "bg-surface-3", label: "not logged" },
};
const WORKOUT: Record<Judged | "frozen", Cell> = {
  hit: { cls: "bg-jamun", label: "workout done" },
  rest: { cls: "bg-sky/25", label: "rest day" },
  frozen: { cls: "bg-sky/80", label: "saved by a freeze" },
  miss: { cls: "bg-surface-3", label: "no workout" },
};
const BOTH: Record<"hit" | "frozen" | "miss", Cell> = {
  hit: { cls: "bg-gradient-to-br from-saffron to-jamun", label: "food + workout done" },
  frozen: { cls: "bg-sky/80", label: "saved by a freeze" },
  miss: { cls: "bg-surface-3", label: "not both" },
};
const EMPTY: Cell = { cls: "bg-surface-2", label: "before you started" };

/** GitHub-style year of days, Monday rows, newest week on the right. Food, workout or both. Tap a day for details. */
export function YearHeatmap() {
  const food = useStreaks();
  const fit = useFitnessStreaks();
  const { today } = food;
  const scroller = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("food");

  const dow = (parseDay(today).getDay() + 6) % 7;
  const start = addDays(today, -dow - (WEEKS - 1) * 7); // Monday, 52 weeks back
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));

  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
  }, []);

  const cell = (d: string): Cell => {
    if (mode === "food") {
      if (food.frozen.has(d)) return FOOD.frozen;
      const s = food.status.get(d);
      return s ? FOOD[s] : EMPTY;
    }
    const run = mode === "workout" ? fit.workout : fit.global;
    if (run.frozen.has(d)) return (mode === "workout" ? WORKOUT : BOTH).frozen;
    const j = run.status.get(d);
    if (!j) return EMPTY;
    return mode === "workout" ? WORKOUT[j] : BOTH[j === "hit" ? "hit" : "miss"];
  };
  const legend: Cell[] = mode === "food" ? Object.values(FOOD) : mode === "workout" ? Object.values(WORKOUT) : Object.values(BOTH);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Your year</p>
        {fit.started ? (
          <div className="flex rounded-full border border-line-strong bg-surface-2 p-0.5 text-xs font-semibold">
            {(["food", "workout", "both"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`relative rounded-full px-2.5 py-1 capitalize transition-colors ${mode === m ? "text-bg" : "text-muted"}`}>
                {mode === m && <motion.span layoutId="heat-mode" className="absolute inset-0 rounded-full bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">{m}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-faint">{parseDay(start).getFullYear()}–{parseDay(today).getFullYear()}</p>
        )}
      </div>

      <div ref={scroller} className="no-scrollbar -mx-5 mt-3 overflow-x-auto px-5">
        <div className="flex w-max gap-[3px]">
          {weeks.map((week, w) => {
            const first = parseDay(week[0]);
            const showMonth = first.getDate() <= 7;
            return (
              <div key={w} className="flex flex-col gap-[3px]">
                <span className="h-4 text-[10px] leading-4 text-faint">
                  {showMonth ? first.toLocaleDateString("en-IN", { month: "short" }) : ""}
                </span>
                {week.map((d) => {
                  const future = d > today;
                  const c = cell(d);
                  return (
                    <motion.button
                      key={d}
                      disabled={future}
                      onClick={() => setPicked(d === picked ? null : d)}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: future ? 0.25 : 1, scale: 1 }}
                      transition={{ delay: Math.min(w * 0.012, 0.6), duration: 0.25 }}
                      aria-label={`${d}: ${c.label}`}
                      className={`size-[13px] rounded-[4px] transition-colors duration-300 ${c.cls} ${d === today ? "ring-2 ring-turmeric/70 ring-offset-1 ring-offset-surface" : ""} ${picked === d ? "outline-2 outline-text" : ""}`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 min-h-5 text-sm">
        {picked ? (
          <>
            <span className="font-semibold">{parseDay(picked).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="text-muted">
              {" · "}{(food.kcalByDay.get(picked) ?? 0).toLocaleString("en-IN")} kcal eaten
              {fit.started ? ` · ${(fit.burnByDay.get(picked) ?? 0).toLocaleString("en-IN")} burned` : ""} · {cell(picked).label}
            </span>
          </>
        ) : (
          <span className="text-faint">Tap a day to see it.</span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        {legend.map((c) => (
          <span key={c.label} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-[3px] ${c.cls}`} />
            {c.label}
          </span>
        ))}
      </div>
    </section>
  );
}
