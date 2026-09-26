"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Flame } from "lucide-react";
import { NavBtn } from "@/components/today/DateStrip";
import { addDays, dayKey, dayLabel, parseDay } from "@/lib/dates";
import { GROUP_LABEL, getExercise, photoUrl, setsSummary } from "@/lib/exercises";
import { MIN_VISIT_MINUTES } from "@/lib/gym/config";
import { counted, duration, finishedVisits } from "@/lib/gym/visits";
import { useStore } from "@/lib/store";
import type { Workout } from "@/lib/types";
import { usePrDays } from "@/lib/useRecords";
import { useFitnessStreaks } from "@/lib/useWorkouts";
import { ActivityIcon } from "./ExercisePhoto";

// The Workout tab's week (D27): every day shows how it went for the workout streak, and "Exercises" opens
// what was done each day (phone: a list under the strip; desktop: inside each day of a week calendar).
// Desktop also (D35): hover a day to peek at it, click a day to stretch just that one open; a doodle arrow
// points at "Exercises" until it has been used once.

/** How a day went for the workout streak. "pending" = today, nothing yet (today never breaks a streak). */
type Mark = "fire" | "frozen" | "rest" | "miss" | "pending" | "none";

const EMOJI: Partial<Record<Mark, string>> = { fire: "🔥", frozen: "❄️", rest: "🌙", miss: "🥲" };
const LABEL: Record<Mark, string> = {
  fire: "workout day", frozen: "saved by a freeze", rest: "rest day", miss: "missed", pending: "not yet", none: "no workout",
};
const LEGEND: Mark[] = ["fire", "rest", "frozen", "miss"];

const PREF = "prana-week-exercises";
/** set once "Exercises" or a day's details have been opened: the doodle hint is gone for good */
const HINT = "prana-week-hint";
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
  // desktop: one day stretched open by a click (the rest stay compact), and the day being peeked at on hover
  const [focus, setFocus] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(HINT) === "1" || readPref();
    } catch {}
    if (seen) return;
    const t = setTimeout(() => setHint(true), 600); // after the page has settled, so the arrow draws where you look
    return () => clearTimeout(t);
  }, []);
  const discovered = () => {
    setHint(false);
    try {
      localStorage.setItem(HINT, "1");
    } catch {}
  };
  const toggle = () => {
    setOpen(!open);
    setFocus(null);
    discovered();
    try {
      localStorage.setItem(PREF, open ? "0" : "1");
    } catch {}
  };
  const pick = (d: string) => {
    onChange(d);
    setPeek(null);
    // a second click on the open day folds it back
    const next = focus === d ? null : d;
    setFocus(next);
    if (next) discovered();
  };
  const hover = (d: string | null) => {
    clearTimeout(peekTimer.current);
    if (d) peekTimer.current = setTimeout(() => setPeek(d), 140);
    else setPeek(null);
  };
  useEffect(() => () => clearTimeout(peekTimer.current), []);

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

      {/* all open = a calendar (equal heights); one open = only that day grows */}
      <div className={`mt-3 grid grid-cols-7 gap-1.5 lg:gap-3 ${open ? "" : "lg:items-start"}`}>
        {days.map((x, i) => {
          const expanded = open || focus === x.d;
          return (
            <DayTile
              key={x.d}
              day={x}
              index={i}
              active={x.d === date}
              today={today}
              expanded={expanded}
              peek={!expanded && peek === x.d}
              onHover={(on) => hover(on && peekable(x) ? x.d : null)}
              linkLeft={linked[i - 1] ?? false}
              linkRight={linked[i]}
              onPick={() => pick(x.d)}
            />
          );
        })}
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
        <AnimatePresence>{hint && !open && <DoodleHint />}</AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggle}
          aria-expanded={open}
          title="Show what you did each day"
          className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors ${
            open ? "border-jamun/50 bg-jamun/12 text-jamun" : "border-line-strong text-muted hover:text-text"
          }`}
        >
          {hint && !open && <span aria-hidden className="absolute inset-0 animate-ping rounded-full border-2 border-jamun/50 [animation-duration:1.8s] sm:hidden" />}
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

/** Days worth a peek: something was logged, or the day has a verdict (rest, missed, freeze). */
const peekable = (x: Day) => x.list.length > 0 || x.visitMs > 0 || x.mark === "rest" || x.mark === "miss" || x.mark === "frozen";

/**
 * One day of the strip. On desktop it grows into a calendar day listing what was done when "Exercises" is open
 * or when it's clicked (`expanded`), and shows a floating peek while hovered (`peek`).
 */
function DayTile({ day, index, active, today, expanded, peek, onHover, linkLeft, linkRight, onPick }: {
  day: Day; index: number; active: boolean; today: string; expanded: boolean; peek: boolean; onHover: (on: boolean) => void;
  linkLeft: boolean; linkRight: boolean; onPick: () => void;
}) {
  const { d, mark } = day;
  const future = d > today;
  const date = parseDay(d);
  const pr = usePrDays().has(d);
  // desktop calendar: a ring marks the chosen day, so its contents stay readable
  const open = expanded;
  const pill = open ? "bg-cream lg:bg-transparent lg:ring-2 lg:ring-cream" : "bg-cream";
  const ink = active ? (open ? "text-bg lg:text-text" : "text-bg") : "";
  const hasLogs = day.list.length > 0;
  return (
    <button
      disabled={future}
      onClick={onPick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      aria-label={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}: ${LABEL[mark]}${hasLogs ? `, ${day.list.length} logged` : ""}`}
      aria-pressed={active}
      aria-expanded={hasLogs ? open : undefined}
      className={`group relative flex flex-col items-center rounded-2xl py-2 transition-colors disabled:opacity-30 lg:justify-start lg:rounded-3xl lg:border lg:border-line lg:bg-surface/60 lg:py-3 lg:hover:bg-surface ${ink}`}
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
        {pr && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 16, delay: 0.2 }}
            title="Personal record set"
            aria-hidden
            className="absolute -right-0.5 -top-1.5 text-[11px] leading-none lg:right-3 lg:text-sm"
          >
            🏆
          </motion.span>
        )}
      </span>
      {/* desktop: a day with workouts says it opens (the chevron bobs on hover) */}
      {!open && (
        <span aria-hidden className={`relative -mb-1 mt-0.5 hidden transition-transform duration-300 group-hover:translate-y-0.5 lg:block ${hasLogs ? "" : "invisible"} ${active ? "text-bg/60" : "text-faint group-hover:text-jamun"}`}>
          <ChevronDown size={14} strokeWidth={2.6} />
        </span>
      )}
      {open && <TileBody day={day} />}
      <AnimatePresence>{peek && <Peek day={day} index={index} today={today} />}</AnimatePresence>
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

/** Names of the routines a day's workouts came from ("Chest day"), in the order they were logged. */
function useRoutineNames(list: Workout[]) {
  const routines = useStore((s) => s.routines);
  const ids = [...new Set(list.map((w) => w.routineId).filter(Boolean))];
  return ids.map((id) => routines.find((r) => r.id === id)?.name).filter(Boolean) as string[];
}

/** Desktop calendar content: the routine's name, up to four exercises with a thumbnail, then the day's burn. */
function TileBody({ day }: { day: Day }) {
  const { list, kcal, mark, visitMs } = day;
  const routineNames = useRoutineNames(list);
  const extra = list.length - 4;
  return (
    <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative mt-3 hidden w-full flex-1 flex-col gap-1.5 px-2.5 text-left lg:flex">
      {list.length ? (
        <>
          {routineNames.length > 0 && <span className="truncate text-[11px] font-bold uppercase tracking-wider text-jamun">{routineNames.join(" + ")}</span>}
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

/**
 * Desktop hover card under a day: routine, each exercise with photo + sets (or minutes), burn. Nothing on the page
 * moves. Spans only (it lives inside the day's button). Edge days align to their side so it never leaves the strip.
 */
function Peek({ day, index, today }: { day: Day; index: number; today: string }) {
  const { d, list, kcal, mark, visitMs } = day;
  const routineNames = useRoutineNames(list);
  const date = parseDay(d);
  const align = index === 0 ? "left-0" : index === 6 ? "right-0" : "left-1/2";
  const caret = index === 0 ? "left-8" : index === 6 ? "right-8" : "left-1/2 -ml-1.5";
  const extra = list.length - 5;
  return (
    <motion.span
      role="tooltip"
      initial={{ opacity: 0, y: -6, scale: 0.97, x: index === 0 || index === 6 ? 0 : "-50%" }}
      animate={{ opacity: 1, y: 0, scale: 1, x: index === 0 || index === 6 ? 0 : "-50%" }}
      exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 520, damping: 34 }}
      className={`pointer-events-none absolute top-full z-30 mt-2.5 hidden w-72 origin-top flex-col rounded-2xl border border-line-strong bg-surface p-3 text-left text-text shadow-[0_18px_50px_-18px_rgb(0_0_0/0.7)] lg:flex ${align}`}
    >
      <span aria-hidden className={`absolute -top-1.5 size-3 rotate-45 border-l border-t border-line-strong bg-surface ${caret}`} />
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold">{d === today ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
        <span className="flex items-center gap-1 text-[11px] text-muted">
          {EMOJI[mark] && <span aria-hidden>{EMOJI[mark]}</span>}
          {LABEL[mark]}
        </span>
      </span>
      {routineNames.length > 0 && <span className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-wider text-jamun">{routineNames.join(" + ")}</span>}
      {list.length > 0 ? (
        <span className="mt-2 flex flex-col gap-2">
          {list.slice(0, 5).map((w) => {
            const ex = w.kind === "lift" ? getExercise(w.refId) : undefined;
            return (
              <span key={w.id} className="flex min-w-0 items-center gap-2.5">
                <Thumb w={w} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{w.name}</span>
                  <span className="block truncate text-[11px] text-muted tabular">
                    {w.kind === "lift" ? `${w.sets?.length ?? 0} sets · ${setsSummary(w, ex)}` : `${Math.round(w.minutes)} min${w.speedKmh ? ` · ${w.speedKmh} km/h` : ""}`}
                  </span>
                </span>
                <span className="shrink-0 font-display text-sm font-semibold text-jamun tabular">~{w.kcal}</span>
              </span>
            );
          })}
          {extra > 0 && <span className="pl-[42px] text-[11px] text-muted">+{extra} more</span>}
        </span>
      ) : (
        <span className="mt-1.5 text-xs text-muted">
          {visitMs ? `Gym visit · ${duration(visitMs)}` : mark === "rest" ? "Rest day. Recovery is training too." : mark === "frozen" ? "Saved by a freeze" : "No workout this day"}
        </span>
      )}
      <span className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[11px]">
        <span className="font-semibold text-jamun tabular">{kcal ? `~${kcal} kcal` : ""}</span>
        <span className="flex items-center gap-1 text-faint">
          Click to open <ChevronDown size={12} />
        </span>
      </span>
    </motion.span>
  );
}

/**
 * Hand-drawn arrow toward "Exercises" (draws itself), shown until the week's details have been opened once.
 * Tablet + desktop only; phones get a soft ping around the button instead (no room beside it).
 */
function DoodleHint() {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className="pointer-events-none ml-auto hidden shrink-0 items-center gap-1 text-jamun sm:flex"
    >
      <motion.span
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="-translate-y-2 -rotate-3 font-display text-sm italic"
      >
        see every day&apos;s workout
      </motion.span>
      <svg width="52" height="30" viewBox="0 0 52 30" fill="none" className="-translate-y-1 overflow-visible">
        <motion.path
          d="M3 22 C 9 8, 20 6, 22 15 C 24 24, 13 24, 17 14 C 21 5, 36 6, 47 17"
          style={{ stroke: "currentColor" }}
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />
        <motion.path
          d="M39 16.5 L47.5 17.5 L45 9.5"
          style={{ stroke: "currentColor" }}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.3 }}
        />
      </svg>
    </motion.span>
  );
}

/** Phone list row: emoji, day, muscle groups, exercises, photos, burn. Tap = show that day's session. */
function DayRow({ day, active, today, burnGoal, onPick }: { day: Day; active: boolean; today: string; burnGoal: number | null; onPick: () => void }) {
  const prDay = usePrDays().has(day.d);
  const { d, mark, list, kcal, visitMs } = day;
  const date = parseDay(d);
  const routineNames = useRoutineNames(list);
  // a routine's name says it best ("Chest day"); otherwise the muscle groups
  const groups = routineNames.length ? routineNames : [...new Set(list.map((w) => {
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
          <span className="shrink-0 font-semibold">{d === today ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}{prDay ? " 🏆" : ""}</span>
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
