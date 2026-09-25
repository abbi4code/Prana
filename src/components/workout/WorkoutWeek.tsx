"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Flame } from "lucide-react";
import { NavBtn } from "@/components/today/DateStrip";
import { addDays, dayKey, dayLabel, parseDay } from "@/lib/dates";
import { GROUP_LABEL, getExercise, photoUrl } from "@/lib/exercises";
import { MIN_VISIT_MINUTES } from "@/lib/gym/config";
import { counted, duration, finishedVisits } from "@/lib/gym/visits";
import { useStore } from "@/lib/store";
import type { Workout } from "@/lib/types";
import { useFitnessStreaks } from "@/lib/useWorkouts";
import { ActivityIcon } from "./ExercisePhoto";

// The Workout tab's week (D27): every day shows how it went for the workout streak, and "Exercises" opens
// what was done each day (phone: a list under the strip; desktop: inside each day of a week calendar).

/** How a day went for the workout streak. "pending" = today, nothing yet (today never breaks a streak). */
type Mark = "fire" | "frozen" | "rest" | "miss" | "pending" | "none";

const EMOJI: Partial<Record<Mark, string>> = { fire: "🔥", frozen: "❄️", rest: "🌙", miss: "🥲" };
const LABEL: Record<Mark, string> = {
  fire: "workout day", frozen: "saved by a freeze", rest: "rest day", miss: "missed", pending: "not yet", none: "no workout",
};
const LEGEND: Mark[] = ["fire", "rest", "frozen", "miss"];

const PREF = "prana-week-exercises";
const readPref = () => {
  try {
    return localStorage.getItem(PREF) === "1";
  } catch {
    return false;
  }
};

type Day = { d: string; mark: Mark; list: Workout[]; kcal: number; visitMs: number };

export function WorkoutWeek({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const workouts = useStore((s) => s.workouts);
  const burnGoal = useStore((s) => s.fitness.burnGoal);
  const restDays = useStore((s) => s.fitness.restDays);
  const visits = useStore((s) => s.visits);
  const localVisits = useStore((s) => s.localVisits);
  const pendingCheckout = useStore((s) => s.pendingCheckout);
  const { workout: run, today } = useFitnessStreaks();
  const [open, setOpen] = useState(readPref);
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(PREF, open ? "0" : "1");
    } catch {}
  };

  const monday = addDays(date, -((parseDay(date).getDay() + 6) % 7));
  const days: Day[] = useMemo(() => {
    const visitMs = new Map<string, number>();
    for (const v of finishedVisits(visits, localVisits, pendingCheckout))
      if (counted(v, MIN_VISIT_MINUTES)) visitMs.set(dayKey(new Date(v.start)), (visitMs.get(dayKey(new Date(v.start))) ?? 0) + v.end - v.start);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      const list = workouts.filter((w) => w.date === d).sort((a, b) => a.createdAt - b.createdAt);
      const j = run.status.get(d);
      const mark: Mark =
        d > today || !j ? "none"
        : run.frozen.has(d) ? "frozen"
        : j === "hit" ? "fire"
        : j === "rest" ? "rest"
        : d === today ? "pending"
        : "miss";
      return { d, mark, list, kcal: list.reduce((t, w) => t + w.kcal, 0), visitMs: visitMs.get(d) ?? 0 };
    });
  }, [monday, workouts, visits, localVisits, pendingCheckout, run, today]);

  // a band joins neighbouring days that keep the streak alive (rest days inside a run too, not at its ends)
  const linked = useMemo(() => {
    const kept = (m: Mark) => m === "fire" || m === "frozen" || m === "rest";
    const out = Array<boolean>(7).fill(false); // out[i]: day i joins day i + 1
    for (let i = 0; i < 7; ) {
      if (!kept(days[i].mark)) { i++; continue; }
      let j = i;
      while (j + 1 < 7 && kept(days[j + 1].mark)) j++;
      let a = i, b = j;
      while (a <= b && days[a].mark === "rest") a++;
      while (b >= a && days[b].mark === "rest") b--;
      if (b > a) for (let k = a; k < b; k++) out[k] = true;
      i = j + 1;
    }
    return out;
  }, [days]);

  const planned = 7 - new Set(restDays).size;
  const done = days.filter((x) => x.mark === "fire").length;
  const weekKcal = days.reduce((t, x) => t + x.kcal, 0);
  const shown = days.filter((x) => x.d <= today);

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
            aria-label={`${run.current} day workout streak`}
            className={`mr-1 flex h-10 items-center gap-1 rounded-full border px-3 text-sm font-bold tabular transition-colors ${
              run.current ? "border-saffron/40 bg-saffron/10 text-saffron" : "border-line text-faint"
            }`}
          >
            <Flame size={16} strokeWidth={2.4} />
            {run.current}
          </Link>
          <NavBtn onClick={() => onChange(addDays(date, -7))} label="Previous week"><ChevronLeft size={20} /></NavBtn>
          <NavBtn onClick={() => onChange(addDays(date, 7))} label="Next week" disabled={addDays(monday, 7) > today}>
            <ChevronRight size={20} />
          </NavBtn>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5 lg:gap-3">
        {days.map((x, i) => (
          <DayTile key={x.d} day={x} active={x.d === date} today={today} open={open} linkLeft={linked[i - 1] ?? false} linkRight={linked[i]} onPick={() => onChange(x.d)} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted tabular">
          {done ? (
            <>
              <span className="font-semibold text-text">{done}</span>/{planned} workout days
              {weekKcal ? <span className="text-faint"> · ~{weekKcal.toLocaleString("en-IN")} kcal</span> : null}
            </>
          ) : (
            "No workout days yet this week"
          )}
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggle}
          aria-expanded={open}
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors ${
            open ? "border-jamun/50 bg-jamun/12 text-jamun" : "border-line-strong text-muted hover:text-text"
          }`}
        >
          <Dumbbell size={14} /> Exercises
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="grid place-items-center">
            <ChevronDown size={14} />
          </motion.span>
        </motion.button>
      </div>

      {/* phone + tablet: the week as a list under the strip */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="overflow-hidden lg:hidden"
          >
            <div className="card mt-3 p-2">
              <ul>
                {shown.map((x, i) => (
                  <motion.li key={x.d} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
                    <DayRow day={x} active={x.d === date} today={today} burnGoal={burnGoal} onPick={() => onChange(x.d)} />
                  </motion.li>
                ))}
              </ul>
              <Legend />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {open && (
        <div className="hidden lg:block">
          <Legend />
        </div>
      )}
    </div>
  );
}

/** One day of the strip. On desktop with "Exercises" open it grows into a calendar day listing what was done. */
function DayTile({ day, active, today, open, linkLeft, linkRight, onPick }: {
  day: Day; active: boolean; today: string; open: boolean; linkLeft: boolean; linkRight: boolean; onPick: () => void;
}) {
  const { d, mark } = day;
  const future = d > today;
  const date = parseDay(d);
  // desktop calendar: a ring marks the chosen day, so its contents stay readable
  const pill = open ? "bg-cream lg:bg-transparent lg:ring-2 lg:ring-cream" : "bg-cream";
  const ink = active ? (open ? "text-bg lg:text-text" : "text-bg") : "";
  return (
    <button
      disabled={future}
      onClick={onPick}
      aria-label={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}: ${LABEL[mark]}`}
      aria-pressed={active}
      className={`relative flex flex-col items-center rounded-2xl py-2 transition-colors disabled:opacity-30 lg:justify-start lg:rounded-3xl lg:border lg:border-line lg:bg-surface/60 lg:py-3 lg:hover:bg-surface ${ink}`}
    >
      {active && (
        <motion.span layoutId="wday-pill" className={`absolute inset-0 rounded-2xl lg:rounded-3xl ${pill}`} transition={{ type: "spring", stiffness: 500, damping: 40 }} />
      )}
      <span className={`relative text-[10px] font-bold uppercase ${active ? (open ? "text-bg/70 lg:text-faint" : "text-bg/70") : "text-faint"}`}>
        {date.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2)}
      </span>
      <span className="relative mt-0.5 font-display text-lg font-semibold">{date.getDate()}</span>
      <span className="relative mt-1 grid h-7 w-full place-items-center">
        {linkLeft && <Band side="left" />}
        {linkRight && <Band side="right" />}
        <MarkIcon mark={mark} live={d === today && mark === "fire"} />
      </span>
      {open && <TileBody day={day} />}
    </button>
  );
}

/** Half of the streak band; the tile gap is 6 px on phones, 12 px on desktop. */
function Band({ side }: { side: "left" | "right" }) {
  return (
    <motion.span
      aria-hidden
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`absolute top-1/2 h-[18px] -translate-y-1/2 bg-saffron/22 ${
        side === "left" ? "left-[-3px] right-1/2 origin-right lg:left-[-6px]" : "left-1/2 right-[-3px] origin-left lg:right-[-6px]"
      }`}
    />
  );
}

function MarkIcon({ mark, live }: { mark: Mark; live?: boolean }) {
  const emoji = EMOJI[mark];
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {emoji ? (
        <motion.span
          key={mark}
          initial={{ scale: 0, rotate: -25 }}
          animate={live ? { scale: [1, 1.18, 1], rotate: [0, -6, 0] } : { scale: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={live ? { duration: 1.4, repeat: Infinity, repeatDelay: 1.6 } : { type: "spring", stiffness: 520, damping: 18 }}
          className={`relative text-[17px] leading-none lg:text-xl ${mark === "miss" || mark === "rest" ? "opacity-80" : ""}`}
          aria-hidden
        >
          {emoji}
        </motion.span>
      ) : mark === "pending" ? (
        <motion.span key="pending" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} aria-hidden className="relative size-[18px] rounded-full border-2 border-dashed border-jamun/60" />
      ) : (
        <span key="none" aria-hidden className="relative size-1 rounded-full bg-line-strong" />
      )}
    </AnimatePresence>
  );
}

/** Desktop calendar content: up to four exercises with a thumbnail, then the day's burn. */
function TileBody({ day }: { day: Day }) {
  const { list, kcal, mark, visitMs } = day;
  const extra = list.length - 4;
  return (
    <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative mt-3 hidden w-full flex-1 flex-col gap-1.5 px-2.5 text-left lg:flex">
      {list.length ? (
        <>
          {list.slice(0, 4).map((w) => (
            <span key={w.id} className="flex min-w-0 items-center gap-2">
              <Thumb w={w} size={26} />
              <span className="truncate text-xs font-medium">{w.name}</span>
            </span>
          ))}
          {extra > 0 && <span className="pl-[34px] text-[11px] text-muted">+{extra} more</span>}
          <span className="mt-auto pt-1 text-xs font-semibold text-jamun tabular">~{kcal} kcal</span>
        </>
      ) : (
        <span className="text-center text-[11px] leading-snug text-faint">
          {visitMs ? `Gym visit · ${duration(visitMs)}` : mark === "rest" ? "Rest day" : mark === "pending" ? "Not yet" : mark === "none" ? "" : "No workout"}
        </span>
      )}
    </motion.span>
  );
}

/** Phone list row: emoji, day, muscle groups, exercises, photos, burn. Tap = show that day's session. */
function DayRow({ day, active, today, burnGoal, onPick }: { day: Day; active: boolean; today: string; burnGoal: number | null; onPick: () => void }) {
  const { d, mark, list, kcal, visitMs } = day;
  const date = parseDay(d);
  const groups = [...new Set(list.map((w) => {
    const ex = w.kind === "lift" ? getExercise(w.refId) : undefined;
    return ex ? GROUP_LABEL[ex.group] : w.name;
  }))];
  const names = list.map((w) => w.name);
  const sub = list.length
    ? names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ")
    : visitMs ? `Gym visit · ${duration(visitMs)}`
    : mark === "rest" ? "Rest day. Recovery is training too."
    : mark === "frozen" ? "Saved by a freeze"
    : mark === "pending" ? "Nothing yet today"
    : "No workout";
  const underGoal = mark === "miss" && list.length > 0 && burnGoal;

  return (
    <button
      onClick={onPick}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors ${active ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-xl ${mark === "fire" ? "bg-saffron/12" : "bg-surface-2"}`}>
        <MarkIcon mark={mark} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5 text-sm">
          <span className="shrink-0 font-semibold">{d === today ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</span>
          {groups.length > 0 && <span className="truncate text-muted">· {groups.join(" · ")}</span>}
        </span>
        <span className="block truncate text-xs text-faint">{underGoal ? `Under your burn goal (~${kcal} of ${burnGoal})` : sub}</span>
      </span>
      {list.length > 0 && (
        <span className="flex shrink-0 -space-x-2">
          {list.slice(0, 3).map((w) => (
            <span key={w.id} className="rounded-lg ring-2 ring-surface">
              <Thumb w={w} size={28} />
            </span>
          ))}
        </span>
      )}
      {kcal > 0 && (
        <span className="w-11 shrink-0 text-right font-display text-sm font-semibold text-jamun tabular">
          <span className="text-muted">~</span>{kcal}
        </span>
      )}
    </button>
  );
}

/** Small square: the exercise's start photo, else a cardio / dumbbell icon. */
function Thumb({ w, size }: { w: Workout; size: number }) {
  const ex = w.kind === "lift" ? getExercise(w.refId) : undefined;
  if (ex?.photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static WebP in /public, cached offline by sw.js
      <img src={photoUrl(ex.id, 0)} alt="" loading="lazy" decoding="async" className="block shrink-0 rounded-lg bg-[#f4f4f2] object-cover" style={{ width: size, height: size }} />
    );
  if (w.kind === "cardio") return <ActivityIcon id={w.refId} size={size} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-lg bg-jamun/12 text-jamun" style={{ width: size, height: size }}>
      <Dumbbell size={Math.round(size * 0.5)} />
    </span>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 pt-2 text-[11px] text-muted lg:px-0 lg:pt-3">
      {LEGEND.map((m) => (
        <span key={m} className="flex items-center gap-1.5">
          <span aria-hidden>{EMOJI[m]}</span>
          {LABEL[m]}
        </span>
      ))}
    </p>
  );
}
