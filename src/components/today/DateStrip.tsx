"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { addDays, dayKey, dayLabel, parseDay } from "@/lib/dates";

/** Week strip (Mon–Sun) around the selected day; dots mark days with logs. */
export function DateStrip({ date, onChange, logged, streak, streakLive }: {
  date: string;
  onChange: (d: string) => void;
  logged: Set<string>;
  streak: number;
  /** today is already on target */
  streakLive: boolean;
}) {
  const today = dayKey();
  const dow = (parseDay(date).getDay() + 6) % 7; // Monday = 0
  const monday = addDays(date, -dow);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">
            {parseDay(date).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </p>
          <h1 className="font-display text-[2rem] font-semibold leading-tight">{dayLabel(date)}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/progress"
            aria-label={`${streak} day streak`}
            className={`mr-1 flex h-10 items-center gap-1 rounded-full border px-3 text-sm font-bold tabular transition-colors ${
              streak ? "border-saffron/40 bg-saffron/10 text-saffron" : "border-line text-faint"
            }`}
          >
            <motion.span
              animate={streakLive ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 1.2, repeat: streakLive ? Infinity : 0, repeatDelay: 1.8 }}
              className="grid place-items-center"
            >
              <Flame size={16} strokeWidth={2.4} />
            </motion.span>
            {streak}
          </Link>
          <NavBtn onClick={() => onChange(addDays(date, -7))} label="Previous week"><ChevronLeft size={20} /></NavBtn>
          <NavBtn onClick={() => onChange(addDays(date, 7))} label="Next week" disabled={addDays(monday, 7) > today}>
            <ChevronRight size={20} />
          </NavBtn>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const active = d === date;
          const future = d > today;
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => onChange(d)}
              className={`relative flex flex-col items-center rounded-2xl py-2 transition-colors disabled:opacity-30 ${active ? "text-bg" : ""}`}
            >
              {active && (
                <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
              )}
              <span className={`relative text-[10px] font-bold uppercase ${active ? "text-bg/70" : "text-faint"}`}>
                {parseDay(d).toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2)}
              </span>
              <span className="relative mt-0.5 font-display text-lg font-semibold">{parseDay(d).getDate()}</span>
              <span
                className={`relative mt-0.5 size-1 rounded-full ${logged.has(d) ? (active ? "bg-saffron" : "bg-turmeric") : "bg-transparent"} ${d === today && !active ? "ring-2 ring-turmeric/30" : ""}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NavBtn({ children, onClick, label, disabled }: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} disabled={disabled} className="grid size-10 place-items-center rounded-full border border-line text-muted disabled:opacity-30 active:bg-surface-2">
      {children}
    </button>
  );
}
