"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Dumbbell, Pencil, Play, Plus, Sparkles, Zap } from "lucide-react";
import { Burst } from "@/components/Burst";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { getActivity, getExercise, photoUrl } from "@/lib/exercises";
import { STARTERS, draftBurn, draftFor, draftWorkout, lastDone, newRoutineId, routineGroups, type Draft } from "@/lib/routines";
import { useStore, useUI } from "@/lib/store";
import type { Routine, RoutineItem, Workout } from "@/lib/types";
import { usePerson } from "@/lib/useWorkouts";
import { ActivityIcon } from "./ExercisePhoto";

// Routines on the Workout tab (workouts.md "Routines"): cards you tap to log a whole workout.

/** Today's plan for a routine: what's done (logged from it on `date`), what's left, and the estimate. */
export function useRoutinePlan(r: Routine | undefined, date: string) {
  const workouts = useStore((s) => s.workouts);
  const p = usePerson(date);
  return useMemo(() => {
    if (!r) return null;
    const done = new Map<string, Workout>();
    for (const w of workouts) if (w.routineId === r.id && w.date === date) done.set(w.refId, w);
    // "last time" = before this session, so ticking and unticking never feeds on itself
    const before = workouts.filter((w) => !(w.routineId === r.id && w.date === date));
    const drafts = r.items.map((it) => draftFor(it, before, date)).filter(Boolean) as Draft[];
    const remaining = drafts.filter((d) => !done.has(d.item.refId));
    const burn = (list: Draft[]) => (p ? list.reduce((t, d) => t + draftBurn(d, p).kcal, 0) : 0);
    return {
      drafts, done, remaining, p,
      total: burn(drafts),
      left: burn(remaining),
      minutes: p ? Math.round(drafts.reduce((t, d) => t + draftBurn(d, p).minutes, 0)) : 0,
      // one tap is never blind (D29): every exercise left must have a last session to repeat
      ready: !!p && remaining.length > 0 && remaining.every((d) => d.last),
    };
  }, [r, workouts, date, p]);
}
export type Plan = NonNullable<ReturnType<typeof useRoutinePlan>>;

/** Logs everything not yet done (with the numbers shown), one toast + Undo for all of it. Returns the count. */
export function logRemaining(r: Routine, plan: Plan, date: string, drafts: Draft[] = plan.remaining) {
  if (!plan.p || !drafts.length) return 0;
  const s = useStore.getState();
  const ids = s.addWorkouts(drafts.map((d) => draftWorkout(d, plan.p!, date, r.id)));
  const kcal = drafts.reduce((t, d) => t + draftBurn(d, plan.p!).kcal, 0);
  const ui = useUI.getState();
  ids.forEach(ui.markFresh);
  navigator.vibrate?.([12, 40, 12]);
  const finished = plan.done.size + ids.length >= plan.drafts.length;
  // finished: the whole routine's burn, not just this batch
  const whole = kcal + [...plan.done.values()].reduce((t, w) => t + w.kcal, 0);
  ui.showToast(finished ? `${r.name} done · ~${whole} kcal` : `Logged ${ids.length} · ~${kcal} kcal`, {
    label: "Undo",
    run: () => ids.forEach((id) => useStore.getState().removeWorkout(id)),
  });
  return ids.length;
}

export const agoLabel = (d: string | null, today = dayKey()) => {
  if (!d) return "Not done yet";
  if (d === today) return "Done today";
  if (d === addDays(today, -1)) return "Yesterday";
  const days = Math.round((parseDay(today).getTime() - parseDay(d).getTime()) / 86_400_000);
  return days < 30 ? `${days} days ago` : parseDay(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export function RoutinesSection({ date }: { date: string }) {
  const routines = useStore((s) => s.routines);
  const workouts = useStore((s) => s.workouts);
  const editRoutine = useUI((s) => s.editRoutine);

  const list = useMemo(() => [...routines].sort((a, b) => a.createdAt - b.createdAt), [routines]);
  // the one you did longest ago (never done counts as oldest), so a Push → Pull → Legs rotation suggests itself
  const upNext = useMemo(() => {
    if (list.length < 2) return null;
    const today = dayKey();
    const withLast = list.map((r) => ({ r, last: lastDone(r, workouts) }));
    if (!withLast.some((x) => x.last) || withLast.some((x) => x.last === today)) return null;
    return withLast.reduce((a, b) => ((a.last ?? "") <= (b.last ?? "") ? a : b)).r.id;
  }, [list, workouts]);

  return (
    <section>
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="font-display text-lg font-semibold">Routines</h2>
          <p className="text-xs text-muted">
            {list.length ? "Tap a card to train. Numbers follow your last session." : "Save the workouts you repeat. Start with one of these, or build your own."}
          </p>
        </div>
        {list.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => editRoutine({})}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-xs font-bold text-muted hover:text-text"
          >
            <Plus size={14} /> New
          </motion.button>
        )}
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0">
        <AnimatePresence initial={false}>
          {list.length
            ? list.map((r) => <RoutineCard key={r.id} routine={r} date={date} upNext={r.id === upNext} />)
            : STARTERS.map((s, i) => <StarterCard key={s.key} starter={s} index={i} />)}
        </AnimatePresence>
        <NewCard empty={!list.length} />
      </div>
    </section>
  );
}

function RoutineCard({ routine: r, date, upNext }: { routine: Routine; date: string; upNext: boolean }) {
  const workouts = useStore((s) => s.workouts);
  const runRoutine = useUI((s) => s.runRoutine);
  const editRoutine = useUI((s) => s.editRoutine);
  const plan = useRoutinePlan(r, date);
  const [burst, setBurst] = useState(0);
  const groups = routineGroups(r.items);
  const last = lastDone(r, workouts);
  if (!plan) return null;
  const doneCount = plan.done.size;
  const total = plan.drafts.length;
  const allDone = total > 0 && doneCount >= total;

  const logAll = () => {
    if (!plan.ready) return runRoutine(r.id);
    if (logRemaining(r, plan, date)) setBurst((b) => b + 1);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="card relative flex w-[16.5rem] shrink-0 snap-start flex-col overflow-hidden md:w-auto"
    >
      <Burst trigger={burst} />
      <button onClick={() => runRoutine(r.id)} className="group block w-full text-left" aria-label={`Open ${r.name}`}>
        <div className="relative">
          <Collage items={r.items} className="h-32 transition-transform duration-500 group-hover:scale-[1.03]" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            {allDone ? (
              <Badge tone="leaf"><Check size={12} strokeWidth={3} /> Done today</Badge>
            ) : upNext ? (
              <Badge tone="jamun"><Sparkles size={12} /> Up next</Badge>
            ) : null}
          </div>
        </div>
        <div className="-mt-6 px-4">
          <p className="relative truncate font-display text-2xl font-semibold leading-tight">{r.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{groups.join(" · ")}</p>
          <p className="mt-2 flex items-center gap-2 text-xs text-faint tabular">
            <span>{total} {total === 1 ? "exercise" : "exercises"}</span>
            {plan.p && plan.total > 0 && <><Dot /><span className="text-jamun">~{plan.total} kcal</span></>}
            <Dot />
            <span className="truncate">{allDone ? "today" : agoLabel(last)}</span>
          </p>
        </div>
      </button>

      {/* edit sits on the photos, outside the open-button */}
      <button
        onClick={() => editRoutine({ id: r.id })}
        aria-label={`Edit ${r.name}`}
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60"
      >
        <Pencil size={15} />
      </button>

      <div className="mt-auto px-4 pb-4 pt-3">
        {doneCount > 0 && !allDone && (
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-muted tabular">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-jamun to-chilli" initial={false} animate={{ width: `${(doneCount / total) * 100}%` }} />
            </div>
            {doneCount}/{total}
          </div>
        )}
        {allDone ? (
          <button onClick={() => runRoutine(r.id)} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-leaf/12 text-sm font-bold text-leaf">
            <Check size={16} strokeWidth={3} /> {doneCount} logged · see it
          </button>
        ) : (
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => runRoutine(r.id)}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold ${
                plan.ready ? "flex-1 border border-line-strong" : "flex-1 bg-gradient-to-r from-jamun to-chilli text-white shadow-[0_8px_24px_-12px_var(--color-jamun)]"
              }`}
            >
              <Play size={15} className={plan.ready ? "text-jamun" : ""} fill="currentColor" /> {doneCount ? "Continue" : "Start"}
            </motion.button>
            {plan.ready && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={logAll}
                title="Logs every exercise with the numbers from your last session"
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-jamun to-chilli text-sm font-bold text-white shadow-[0_8px_24px_-12px_var(--color-jamun)]"
              >
                <Zap size={15} fill="currentColor" /> Log all
              </motion.button>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}

function StarterCard({ starter, index }: { starter: (typeof STARTERS)[number]; index: number }) {
  const saveRoutine = useStore((s) => s.saveRoutine);
  const runRoutine = useUI((s) => s.runRoutine);
  const editRoutine = useUI((s) => s.editRoutine);
  const showToast = useUI((s) => s.showToast);
  const use = () => {
    const id = newRoutineId();
    saveRoutine({ id, name: starter.name, items: starter.items, createdAt: Date.now() + index, starter: starter.key });
    showToast(`Added ${starter.name} to your routines`);
    runRoutine(id);
  };
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="card relative flex w-[16.5rem] shrink-0 snap-start flex-col overflow-hidden md:w-auto"
    >
      <button onClick={use} className="group block w-full text-left">
        <div className="relative">
          <Collage items={starter.items} className="h-28 opacity-80 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
          <div className="absolute left-3 top-3"><Badge tone="brass">Starter</Badge></div>
        </div>
        <div className="-mt-5 px-4">
          <p className="relative font-display text-2xl font-semibold leading-tight">{starter.name}</p>
          <p className="mt-0.5 text-xs text-muted">{starter.blurb}</p>
          <p className="mt-2 text-xs text-faint">{starter.items.length} exercises</p>
        </div>
      </button>
      <div className="mt-auto flex gap-2 px-4 pb-4 pt-3">
        <motion.button whileTap={{ scale: 0.96 }} onClick={use} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-cream text-sm font-bold text-bg">
          <Plus size={15} /> Use this
        </motion.button>
        <button onClick={() => editRoutine({ prefill: starter.items, starter: starter.key })} className="h-10 rounded-2xl border border-line-strong px-3.5 text-sm font-semibold text-muted hover:text-text">
          Customise
        </button>
      </div>
    </motion.article>
  );
}

function NewCard({ empty }: { empty: boolean }) {
  const editRoutine = useUI((s) => s.editRoutine);
  return (
    <motion.button
      layout
      whileTap={{ scale: 0.97 }}
      onClick={() => editRoutine({})}
      className="flex min-h-[15rem] w-[12rem] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-line-strong p-5 text-center text-muted transition-colors hover:border-jamun/50 hover:text-text md:col-span-2 md:min-h-0 md:w-auto md:flex-row md:justify-start md:py-4 md:text-left"
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-jamun/12 text-jamun">
        <Plus size={24} />
      </span>
      <span>
        <span className="block font-display text-lg font-semibold text-text">{empty ? "Build your own" : "New routine"}</span>
        <span className="mt-1 block text-xs">Pick exercises, or save a session you just did</span>
      </span>
    </motion.button>
  );
}

/** 1–4 exercise photos as a mosaic; cardio and photo-less exercises get an icon tile. */
export function Collage({ items, className = "" }: { items: RoutineItem[]; className?: string }) {
  const tiles = items.slice(0, 4);
  const n = tiles.length;
  const grid = n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2";
  return (
    <div className={`grid gap-0.5 overflow-hidden bg-surface-3 ${grid} ${className}`}>
      {tiles.map((it, i) => (
        <Tile key={`${it.refId}-${i}`} item={it} className={n === 3 && i === 0 ? "row-span-2" : ""} />
      ))}
      {!n && <span className="grid place-items-center text-jamun/60"><Dumbbell size={30} /></span>}
    </div>
  );
}

function Tile({ item, className }: { item: RoutineItem; className: string }) {
  const ex = item.kind === "lift" ? getExercise(item.refId) : undefined;
  if (ex?.photo)
    // eslint-disable-next-line @next/next/no-img-element -- static WebP in /public, cached offline by sw.js
    return <img src={photoUrl(ex.id, 0)} alt="" loading="lazy" decoding="async" className={`size-full min-h-0 bg-[#f4f4f2] object-cover ${className}`} />;
  return (
    <span className={`grid min-h-0 place-items-center bg-jamun/12 ${className}`}>
      {item.kind === "cardio" && getActivity(item.refId) ? <ActivityIcon id={item.refId} size={36} /> : <Dumbbell size={22} className="text-jamun" />}
    </span>
  );
}

/** Small square for lists: the exercise's photo, else a cardio / dumbbell icon. */
export function ItemThumb({ item, size = 48, className = "" }: { item: RoutineItem; size?: number; className?: string }) {
  const ex = item.kind === "lift" ? getExercise(item.refId) : undefined;
  if (ex?.photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static WebP in /public, cached offline by sw.js
      <img src={photoUrl(ex.id, 0)} alt="" loading="lazy" decoding="async" className={`block shrink-0 rounded-2xl bg-[#f4f4f2] object-cover ${className}`} style={{ width: size, height: size }} />
    );
  if (item.kind === "cardio") return <ActivityIcon id={item.refId} size={size} />;
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl bg-jamun/12 text-jamun ${className}`} style={{ width: size, height: size }}>
      <Dumbbell size={Math.round(size * 0.45)} />
    </span>
  );
}

function Badge({ tone, children }: { tone: "leaf" | "jamun" | "brass"; children: React.ReactNode }) {
  const cls = tone === "leaf" ? "bg-leaf text-bg" : tone === "jamun" ? "bg-jamun text-white" : "bg-brass text-bg";
  return <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-lg ${cls}`}>{children}</span>;
}

const Dot = () => <span aria-hidden className="size-1 rounded-full bg-line-strong" />;
