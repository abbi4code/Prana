"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { addDays, parseDay } from "@/lib/dates";
import type { DayStatus } from "@/lib/streaks";
import { useStreaks } from "@/lib/useStreaks";

const WEEKS = 53;
const CELL: Record<DayStatus | "frozen" | "empty", string> = {
  empty: "bg-surface-2",
  none: "bg-surface-3",
  under: "bg-turmeric/45",
  on: "bg-leaf",
  over: "bg-chilli/70",
  frozen: "bg-sky/80",
};
const LABEL: Record<DayStatus | "frozen", string> = {
  none: "not logged", under: "under target", on: "on target", over: "over target", frozen: "saved by a freeze",
};

/** GitHub-style year of days, Monday rows, newest week on the right. Tap a day for details. */
export function YearHeatmap() {
  const { status, frozen, kcalByDay, today } = useStreaks();
  const scroller = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const dow = (parseDay(today).getDay() + 6) % 7;
  const start = addDays(today, -dow - (WEEKS - 1) * 7); // Monday, 52 weeks back
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));

  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
  }, []);

  const kind = (d: string): keyof typeof CELL => (frozen.has(d) ? "frozen" : status.get(d) ?? "empty");
  const pickedKind = picked ? kind(picked) : null;

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Your year</p>
        <p className="text-xs text-faint">{parseDay(start).getFullYear()}–{parseDay(today).getFullYear()}</p>
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
                  const k = kind(d);
                  return (
                    <motion.button
                      key={d}
                      disabled={future}
                      onClick={() => setPicked(d === picked ? null : d)}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: future ? 0.25 : 1, scale: 1 }}
                      transition={{ delay: Math.min(w * 0.012, 0.6), duration: 0.25 }}
                      aria-label={`${d}: ${k === "empty" ? "no data" : LABEL[k]}`}
                      className={`size-[13px] rounded-[4px] ${CELL[k]} ${d === today ? "ring-2 ring-turmeric/70 ring-offset-1 ring-offset-surface" : ""} ${picked === d ? "outline-2 outline-text" : ""}`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 min-h-5 text-sm">
        {picked && pickedKind ? (
          <>
            <span className="font-semibold">{parseDay(picked).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="text-muted">
              {" · "}{(kcalByDay.get(picked) ?? 0).toLocaleString("en-IN")} kcal · {pickedKind === "empty" ? "before you started" : LABEL[pickedKind]}
            </span>
          </>
        ) : (
          <span className="text-faint">Tap a day to see it.</span>
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        {(["on", "under", "over", "frozen", "none"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-[3px] ${CELL[k]}`} />
            {LABEL[k]}
          </span>
        ))}
      </div>
    </section>
  );
}
