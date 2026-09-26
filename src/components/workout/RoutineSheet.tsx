"use client";

import { useId, useMemo, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { Check, ChevronLeft, GripVertical, History, Pencil, Plus, Search, Sparkles, Trash, TrendingUp, Trophy, X } from "lucide-react";
import { Burst } from "@/components/Burst";
import { RollingNumber } from "@/components/RollingNumber";
import { Sheet } from "@/components/Sheet";
import { dayKey, dayLabel, parseDay } from "@/lib/dates";
import { GROUPS, GROUP_LABEL, equipLabel, findActivities, findExercises, getExercise, kgStep, setsSummary } from "@/lib/exercises";
import {
  STARTERS, applyHint, draftBurn, draftSummary, draftWorkout, itemName, itemsFromSession, newRoutineId, routineGroups,
  type CardioVals, type Draft,
} from "@/lib/routines";
import { formatPr, metrics, wouldBreak, type Records } from "@/lib/records";
import { useStore, useUI } from "@/lib/store";
import { refInfo, useRecords } from "@/lib/useRecords";
import type { Person } from "@/lib/burn";
import type { MuscleGroup, Routine, RoutineItem, WorkSet, Workout } from "@/lib/types";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { useDayWorkouts } from "@/lib/useWorkouts";
import { Collage, ItemThumb, logRemaining, useRoutinePlan } from "./Routines";
import { NumStepper, WeightPrompt } from "./WorkoutSheet";

/**
 * Routine sheet (workouts.md "Routines"). Run: a checklist where ticking an exercise logs it at once (so closing the
 * app mid-workout loses nothing), numbers editable inline, "Log all" for the rest. Edit: name, exercises, order.
 */
export function RoutineSheet() {
  const state = useUI((s) => s.routine);
  const close = useUI((s) => s.closeRoutine);
  return (
    <Sheet open={!!state} onClose={close} size={state ? "normal" : undefined}>
      {state?.mode === "run" && <RunFlow key={`run-${state.id}`} id={state.id} />}
      {state?.mode === "edit" && <BuildFlow key={`edit-${state.id ?? state.starter ?? "new"}`} id={state.id} prefill={state.prefill} starter={state.starter} />}
    </Sheet>
  );
}

// ── Run: checklist ──

type Edit = { sets?: WorkSet[]; vals?: CardioVals };

function RunFlow({ id }: { id: string }) {
  const r = useStore((s) => s.routines.find((x) => x.id === id));
  const date = useUI((s) => s.date) ?? dayKey();
  const plan = useRoutinePlan(r, date);
  const records = useRecords();
  const close = useUI((s) => s.closeRoutine);
  const editRoutine = useUI((s) => s.editRoutine);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  if (!r || !plan) return <Drawer.Title className="sr-only">Routine</Drawer.Title>;

  const merge = (d: Draft): Draft => {
    const e = edits[d.item.refId];
    if (!e) return d;
    return d.kind === "lift" ? { ...d, sets: e.sets ?? d.sets } : { ...d, vals: e.vals ?? d.vals };
  };
  const drafts = plan.drafts.map(merge);
  const remaining = drafts.filter((d) => !plan.done.has(d.item.refId));
  const left = plan.p ? remaining.reduce((t, d) => t + draftBurn(d, plan.p!).kcal, 0) : 0;
  const doneKcal = [...plan.done.values()].reduce((t, w) => t + w.kcal, 0);
  const total = drafts.length;
  const doneCount = drafts.filter((d) => plan.done.has(d.item.refId)).length;
  const groups = routineGroups(r.items);

  const tick = (d: Draft) => {
    const ref = d.item.refId;
    const logged = plan.done.get(ref);
    const s = useStore.getState();
    if (logged) {
      // untick: remove the log, keep its numbers editable
      s.removeWorkout(logged.id);
      setEdits((e) => ({
        ...e,
        [ref]: logged.kind === "lift" ? { sets: logged.sets } : { vals: { minutes: logged.minutes, speedKmh: logged.speedKmh, inclinePct: logged.inclinePct, optionCode: logged.optionCode } },
      }));
      return;
    }
    if (!plan.p) return;
    const [newId] = s.addWorkouts([draftWorkout(d, plan.p, date, r.id)]);
    useUI.getState().markFresh(newId);
    navigator.vibrate?.(12);
    setOpen((o) => (o === ref ? null : o));
    if (doneCount + 1 >= total) {
      setBurst((b) => b + 1);
      useUI.getState().showToast(`${r.name} done. Strong session 🔥`);
    }
  };

  const logAll = () => {
    if (logRemaining(r, plan, date, remaining)) setBurst((b) => b + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">{r.name}</Drawer.Title>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="relative">
          <Collage items={r.items} className="h-36 lg:-mt-5 lg:h-44" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-surface from-35% via-surface/85 to-surface/10" />
          <div className="absolute right-3 top-3 flex gap-2">
            <HeroBtn label={`Edit ${r.name}`} onClick={() => editRoutine({ id: r.id })}><Pencil size={16} /></HeroBtn>
            <HeroBtn label="Close" onClick={close}><X size={18} /></HeroBtn>
          </div>
          <div className="relative -mt-16 flex items-end justify-between gap-4 px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-faint">{dayLabel(date)} · Routine</p>
              <h2 className="truncate font-display text-3xl font-semibold leading-tight">{r.name}</h2>
              <p className="mt-0.5 truncate text-xs text-muted">
                {groups.join(" · ")}
                {plan.minutes ? ` · ~${plan.minutes} min` : ""}
              </p>
            </div>
            <Ring done={doneCount} total={total} burst={burst} />
          </div>
        </div>

        <ul className="mt-5 space-y-2 px-4">
          {drafts.map((d, i) => {
            const ref = d.item.refId;
            return (
              <motion.li key={ref} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
                <ExerciseRow
                  d={d}
                  logged={plan.done.get(ref)}
                  p={plan.p}
                  records={records}
                  expanded={open === ref}
                  onToggle={() => setOpen(open === ref ? null : ref)}
                  onTick={() => tick(d)}
                  onChange={(e) => setEdits((x) => ({ ...x, [ref]: { ...x[ref], ...e } }))}
                />
              </motion.li>
            );
          })}
        </ul>
        {!drafts.length && <p className="px-5 py-10 text-center text-sm text-muted">This routine has no exercises yet. Tap the pencil to add some.</p>}
        <p className="mt-4 px-5 text-[11px] leading-relaxed text-faint">
          Numbers start from your last session of each exercise. Tick one as you finish it: it&apos;s logged right away, so closing the app loses nothing. Tap a row to change sets, reps or kg.
        </p>
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        {!plan.p ? (
          <WeightPrompt />
        ) : remaining.length ? (
          <>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{doneCount ? "Left to log" : "Estimated burn"}</p>
                <p className="font-display text-3xl font-semibold text-jamun">
                  <span className="text-xl">~</span>
                  <RollingNumber value={left} />
                  <span className="ml-1 text-base font-medium text-muted">kcal</span>
                </p>
              </div>
              <p className="pb-1 text-right text-xs text-muted tabular">
                {doneCount} of {total} done
                <br />
                {doneKcal ? `~${doneKcal} kcal logged` : "tick each as you go"}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={logAll}
              className="h-13 w-full rounded-2xl bg-gradient-to-r from-jamun to-chilli py-3.5 font-bold text-white shadow-[0_10px_30px_-10px_var(--color-jamun)]"
            >
              {doneCount ? `Log the other ${remaining.length}` : `Log all ${total}`}
            </motion.button>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-xl font-semibold">All done 💪</p>
              <p className="text-xs text-muted tabular">{total} exercises · ~{doneKcal} kcal logged</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={close} className="h-12 rounded-2xl bg-cream px-6 font-bold text-bg">
              Finish
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function ExerciseRow({ d, logged, p, records, expanded, onToggle, onTick, onChange }: {
  d: Draft;
  logged: Workout | undefined;
  p: Person | null;
  records: Records;
  expanded: boolean;
  onToggle: () => void;
  onTick: () => void;
  onChange: (e: Edit) => void;
}) {
  const done = !!logged;
  // what's shown: the logged numbers once ticked, else today's draft
  const shown: Draft = logged
    ? d.kind === "lift"
      ? { ...d, sets: logged.sets ?? d.sets }
      : { ...d, vals: { minutes: logged.minutes, speedKmh: logged.speedKmh, inclinePct: logged.inclinePct, optionCode: logged.optionCode } }
    : d;
  const kcal = logged ? logged.kcal : p ? draftBurn(d, p).kcal : null;
  const hint = !done && d.kind === "lift" && d.hint && !d.sets.every((s) => (d.hint!.kind === "kg" ? s.kg === d.hint!.to : s.reps === d.hint!.to)) ? d.hint : null;
  const name = d.kind === "lift" ? d.ex.name : d.a.name;
  // PRs: the ones this log set once ticked; before that, whether today's numbers would set one
  const prHit = logged ? records.hitsByWorkout.get(logged.id)?.[0] : undefined;
  const info = refInfo(d.item);
  const draftM = info ? metrics(d.kind === "lift" ? { kind: "lift", sets: d.sets, minutes: 0 } : { kind: "cardio", minutes: d.vals.minutes, speedKmh: d.vals.speedKmh }, info) : {};
  const willPr = !logged ? wouldBreak(draftM, records.byRef.get(d.item.refId))[0] : undefined;

  return (
    <div className={`overflow-hidden rounded-3xl border transition-colors ${done ? "border-leaf/30 bg-leaf/[0.06]" : expanded ? "border-jamun/40 bg-surface-2" : "border-line bg-surface-2/60"}`}>
      <div className="flex items-center gap-3 p-2.5 pr-3">
        <button onClick={onToggle} disabled={done} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expanded}>
          <span className="relative">
            <ItemThumb item={d.item} size={56} className={done ? "opacity-60" : ""} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[15px] font-semibold ${done ? "text-muted" : ""}`}>{name}</span>
            <span className="block truncate text-xs text-muted tabular">{draftSummary(shown)}</span>
          </span>
        </button>
        {kcal != null && (
          <span className={`shrink-0 font-display text-sm font-semibold tabular ${done ? "text-leaf" : "text-jamun"}`}>
            <span className="text-muted">~</span>{kcal}
          </span>
        )}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onTick}
          disabled={!done && !p}
          aria-label={done ? `Undo ${name}` : `Done: log ${name}`}
          aria-pressed={done}
          className={`grid size-11 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-30 ${
            done ? "border-leaf bg-leaf text-bg" : "border-line-strong text-faint hover:border-jamun hover:text-jamun"
          }`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={done ? "on" : "off"}
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 16 }}
              className="grid place-items-center"
            >
              <Check size={done ? 20 : 17} strokeWidth={done ? 3.2 : 2.4} />
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>

      {((!done && (hint || !d.last || willPr)) || prHit) && (
        <div className="-mt-1 flex flex-wrap gap-1.5 pb-2.5 pl-[76px] pr-3">
          {prHit && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-turmeric to-saffron px-2.5 py-1 text-[11px] font-bold text-on-accent"
            >
              <Trophy size={12} strokeWidth={2.6} /> PR · {formatPr(prHit.kind, prHit)}
            </motion.span>
          )}
          {willPr && draftM[willPr] && (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-turmeric ring-1 ring-turmeric/40">
              <Trophy size={12} /> PR if you finish this · {formatPr(willPr, draftM[willPr]!)}
            </span>
          )}
          {hint && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => d.kind === "lift" && onChange({ sets: applyHint(d.sets, hint) })}
              aria-label={`Go up to ${hint.to} ${hint.kind === "kg" ? "kg" : "reps"}: you finished every set at ${hint.from} in your last two sessions`}
              className="flex items-center gap-1 rounded-full bg-turmeric/15 px-2.5 py-1 text-[11px] font-bold text-turmeric ring-1 ring-turmeric/30"
            >
              <TrendingUp size={12} /> {hint.kind === "kg" ? `${hint.to} kg?` : `${hint.to} reps?`}
            </motion.button>
          )}
          {!d.last && <span className="rounded-full bg-saffron/12 px-2.5 py-1 text-[11px] font-semibold text-saffron">First time · check the numbers</span>}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && !done && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-line px-3 pb-3 pt-3">
              {d.last && (
                <p className="flex items-center gap-2 text-xs text-muted">
                  <History size={13} className="shrink-0 text-jamun" />
                  <span className="truncate">
                    Last time ({parseDay(d.last.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}):{" "}
                    <span className="font-semibold text-text">
                      {d.kind === "lift" ? setsSummary(d.last, d.ex) : `${Math.round(d.last.minutes)} min${d.last.speedKmh ? ` · ${d.last.speedKmh} km/h` : ""}`}
                    </span>
                  </span>
                </p>
              )}
              {hint && (
                <p className="text-[11px] leading-snug text-faint">
                  You finished every set at {hint.from} {hint.kind === "kg" ? "kg" : "reps"} in your last two sessions. Tap ↑ to try {hint.to}; it&apos;s only a suggestion.
                </p>
              )}
              {d.kind === "lift" ? <LiftEditor d={d} onChange={(sets) => onChange({ sets })} /> : <CardioEditor d={d} onChange={(vals) => onChange({ vals })} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LiftEditor({ d, onChange }: { d: Extract<Draft, { kind: "lift" }>; onChange: (sets: WorkSet[]) => void }) {
  const { ex, sets } = d;
  const timed = ex.load === "timed";
  const kgLabel = ex.load === "assisted" ? "assist kg" : ex.load === "bodyweight" ? "+ kg" : ex.rep?.perSide ? "kg each" : "kg";
  const patch = (i: number, v: Partial<WorkSet>) => onChange(sets.map((s, j) => (j === i ? { ...s, ...v } : s)));
  return (
    <>
      <ul className="space-y-2">
        {sets.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-bold text-muted tabular">{i + 1}</span>
            {timed ? (
              <NumStepper label="sec" value={s.secs ?? 30} step={5} min={5} onChange={(v) => patch(i, { secs: v })} />
            ) : (
              <>
                <NumStepper label={kgLabel} value={s.kg} step={kgStep(ex.equip)} min={0} decimal onChange={(v) => patch(i, { kg: v })} />
                <span className="text-faint">×</span>
                <NumStepper label="reps" value={s.reps} step={1} min={1} onChange={(v) => patch(i, { reps: v })} />
              </>
            )}
            <button
              onClick={() => onChange(sets.filter((_, j) => j !== i))}
              disabled={sets.length === 1}
              aria-label={`Remove set ${i + 1}`}
              className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:text-chilli disabled:opacity-30"
            >
              <X size={15} />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => onChange([...sets, { ...sets[sets.length - 1] }])}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-sm font-semibold text-muted hover:border-jamun/50 hover:text-jamun"
      >
        <Plus size={15} /> Add set
      </button>
    </>
  );
}

function CardioEditor({ d, onChange }: { d: Extract<Draft, { kind: "cardio" }>; onChange: (vals: CardioVals) => void }) {
  const v = d.vals;
  return (
    <div className="flex gap-2">
      <NumStepper label="min" value={v.minutes} step={5} min={1} onChange={(m) => onChange({ ...v, minutes: m })} />
      {d.a.model !== "met" && <NumStepper label="km/h" value={v.speedKmh ?? 5} step={0.5} min={1} decimal onChange={(s) => onChange({ ...v, speedKmh: s })} />}
      {d.a.incline && <NumStepper label="incline %" value={v.inclinePct ?? 0} step={0.5} min={0} decimal onChange={(s) => onChange({ ...v, inclinePct: s })} />}
    </div>
  );
}

/** done / total as a ring that fills; bursts when the routine is finished. */
function Ring({ done, total, burst }: { done: number; total: number; burst: number }) {
  const gid = useId();
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  const full = total > 0 && done >= total;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <Burst trigger={burst} />
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--color-jamun)" }} />
            <stop offset="100%" style={{ stopColor: "var(--color-chilli)" }} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" style={{ stroke: "var(--color-surface-3)" }} />
        <motion.circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          style={{ stroke: `url(#${gid})` }}
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
      </svg>
      <span className="relative font-display text-sm font-semibold tabular">
        {full ? <Check size={22} strokeWidth={3} className="text-leaf" /> : <>{done}<span className="text-muted">/{total}</span></>}
      </span>
    </div>
  );
}

function HeroBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60">
      {children}
    </button>
  );
}

// ── Edit: name, exercises, order ──

const NAME_IDEAS = ["Chest day", "Back day", "Leg day", "Shoulders", "Arms", "Push", "Pull", "Full body", "Cardio"];

function BuildFlow({ id, prefill, starter }: { id?: string; prefill?: RoutineItem[]; starter?: string }) {
  const existing = useStore((s) => (id ? s.routines.find((x) => x.id === id) : undefined));
  const saveRoutine = useStore((s) => s.saveRoutine);
  const deleteRoutine = useStore((s) => s.deleteRoutine);
  const runRoutine = useUI((s) => s.runRoutine);
  const close = useUI((s) => s.closeRoutine);
  const showToast = useUI((s) => s.showToast);
  const date = useUI((s) => s.date) ?? dayKey();
  const { day } = useDayWorkouts(date);
  const st = STARTERS.find((s) => s.key === starter);
  const [name, setName] = useState(existing?.name ?? st?.name ?? "");
  const [items, setItems] = useState<RoutineItem[]>(() => (existing?.items ?? prefill ?? []).map((it) => ({ ...it })));
  const [picking, setPicking] = useState(false);
  const fromSession = useMemo(() => itemsFromSession(day), [day]);

  if (picking) return <Picker items={items} onChange={setItems} onDone={() => setPicking(false)} />;

  const valid = name.trim().length > 0 && items.length > 0;
  const save = () => {
    if (!valid) return;
    const rid = existing?.id ?? newRoutineId();
    const routine: Routine = { id: rid, name: name.trim().slice(0, 40), items, createdAt: existing?.createdAt ?? Date.now(), ...(existing?.starter ?? starter ? { starter: existing?.starter ?? starter } : {}) };
    saveRoutine(routine);
    showToast(existing ? `Saved ${routine.name}` : `Created ${routine.name}`);
    runRoutine(rid);
  };
  const remove = () => {
    if (!existing) return;
    deleteRoutine(existing.id);
    showToast(`Deleted ${existing.name}`, { label: "Undo", run: () => useStore.getState().saveRoutine(existing) });
    close();
  };
  const use = (list: RoutineItem[], title?: string) => {
    setItems(list.map((it) => ({ ...it })));
    if (title && !name.trim()) setName(title);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">{existing ? `Edit ${existing.name}` : "New routine"}</Drawer.Title>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-faint">{existing ? "Edit routine" : "New routine"}</p>
          <button onClick={() => (existing ? runRoutine(existing.id) : close())} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line text-muted">
            <X size={18} />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name it: Chest day"
          maxLength={40}
          aria-label="Routine name"
          className="mt-1 w-full bg-transparent font-display text-3xl font-semibold outline-none placeholder:text-faint"
        />
        <AnimatePresence initial={false}>
          {!name.trim() && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <Chips>
                {NAME_IDEAS.map((n) => (
                  <Pill key={n} onClick={() => setName(n)}>{n}</Pill>
                ))}
              </Chips>
            </motion.div>
          )}
        </AnimatePresence>

        {!existing && (
          <>
            <Label>Start from</Label>
            <Chips>
              {fromSession.length > 0 && (
                <Pill tone="jamun" onClick={() => use(fromSession)}>
                  <Sparkles size={13} /> {dayLabel(date)}&apos;s session · {fromSession.length}
                </Pill>
              )}
              {STARTERS.map((s) => (
                <Pill key={s.key} onClick={() => use(s.items, s.name)}>{s.name}</Pill>
              ))}
            </Chips>
          </>
        )}

        <Label>
          {items.length ? `${items.length} ${items.length === 1 ? "exercise" : "exercises"} · drag to reorder` : "Exercises"}
        </Label>
        {items.length ? (
          <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-2" data-vaul-no-drag>
            {items.map((it) => (
              <ReorderRow key={`${it.kind}-${it.refId}`} item={it} onRemove={() => setItems((l) => l.filter((x) => x !== it))} />
            ))}
          </Reorder.Group>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
            No exercises yet. Add the ones you do on this day, in the order you do them.
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setPicking(true)}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-jamun/40 bg-jamun/10 text-sm font-bold text-jamun"
        >
          <Plus size={17} /> Add exercises
        </motion.button>
      </div>

      <div className="flex shrink-0 gap-2 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        {existing && (
          <button onClick={remove} aria-label={`Delete ${existing.name}`} className="grid size-13 shrink-0 place-items-center rounded-2xl border border-line-strong text-muted hover:border-chilli/50 hover:text-chilli">
            <Trash size={18} />
          </button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={save}
          disabled={!valid}
          className="h-13 flex-1 rounded-2xl bg-gradient-to-r from-jamun to-chilli py-3.5 font-bold text-white shadow-[0_10px_30px_-10px_var(--color-jamun)] disabled:opacity-40 disabled:shadow-none"
        >
          {existing ? "Save changes" : valid ? `Save ${name.trim()}` : !items.length ? "Add exercises to save" : "Name it to save"}
        </motion.button>
      </div>
    </div>
  );
}

function ReorderRow({ item, onRemove }: { item: RoutineItem; onRemove: () => void }) {
  const controls = useDragControls();
  const ex = item.kind === "lift" ? getExercise(item.refId) : undefined;
  const meta = ex ? `${GROUP_LABEL[ex.group]} · ${equipLabel(ex.equip)}` : "Cardio";
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      whileDrag={{ scale: 1.03, boxShadow: "0 16px 40px -12px rgb(0 0 0 / 0.5)" }}
      className="relative flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-2 pr-1"
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag ${itemName(item)} to reorder`}
        className="grid h-11 w-6 shrink-0 cursor-grab touch-none place-items-center text-faint active:cursor-grabbing"
      >
        <GripVertical size={18} />
      </button>
      <ItemThumb item={item} size={44} className="rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{itemName(item)}</span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </span>
      <button onClick={onRemove} aria-label={`Remove ${itemName(item)}`} className="grid size-10 shrink-0 place-items-center rounded-full text-faint hover:text-chilli">
        <X size={17} />
      </button>
    </Reorder.Item>
  );
}

/** Multi-select over the library + cardio. Tapping toggles; the order you pick is the routine's order. */
function Picker({ items, onChange, onDone }: { items: RoutineItem[]; onChange: (l: RoutineItem[]) => void; onDone: () => void }) {
  const workouts = useStore((s) => s.workouts);
  const desktop = useIsDesktop();
  const [tab, setTab] = useState<"strength" | "cardio">("strength");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const picked = new Set(items.map((i) => i.refId));

  // your recent exercises first when not searching: that's usually what goes into a routine
  const recentIds = useMemo(() => {
    const seen: string[] = [];
    for (const w of [...workouts].sort((a, b) => b.createdAt - a.createdAt)) if (w.kind === "lift" && !seen.includes(w.refId)) seen.push(w.refId);
    return seen.slice(0, 6);
  }, [workouts]);
  const lifts = useMemo(() => {
    const list = findExercises(query, { group, sub: null, equip: null });
    if (query || group) return list;
    const recent = recentIds.map(getExercise).filter(Boolean) as typeof list;
    return [...recent, ...list.filter((e) => !recentIds.includes(e.id))];
  }, [query, group, recentIds]);
  const cardio = useMemo(() => findActivities(query), [query]);

  const toggle = (it: RoutineItem) =>
    onChange(picked.has(it.refId) ? items.filter((x) => x.refId !== it.refId) : [...items, it]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Add exercises</Drawer.Title>
      <div className="shrink-0 px-5">
        <div className="flex items-center gap-2">
          <button onClick={onDone} aria-label="Back" className="-ml-2 grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
            <ChevronLeft size={24} />
          </button>
          <h2 className="flex-1 font-display text-2xl font-semibold">Add exercises</h2>
          <motion.button whileTap={{ scale: 0.94 }} onClick={onDone} className="flex h-10 items-center gap-1.5 rounded-full bg-cream px-4 text-sm font-bold text-bg">
            <Check size={16} /> Done · {items.length}
          </motion.button>
        </div>
        <div className="mt-3 flex rounded-2xl border border-line-strong bg-surface-2 p-1">
          {(["strength", "cardio"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`relative flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${tab === t ? "text-bg" : "text-muted hover:text-text"}`}>
              {tab === t && <motion.span layoutId="routine-tab" className="absolute inset-0 rounded-xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">{t === "strength" ? "Strength" : "Cardio & sports"}</span>
            </button>
          ))}
        </div>
        <label className="mt-3 flex h-12 items-center gap-2 rounded-2xl border border-line-strong bg-bg/60 px-4 focus-within:border-jamun/60">
          <Search size={18} className="shrink-0 text-faint" />
          <input
            autoFocus={desktop}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "strength" ? "Search: bench, lat pulldown, curl…" : "Search: treadmill, cycle, skipping…"}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="grid size-7 place-items-center rounded-full text-faint">
              <X size={15} />
            </button>
          )}
        </label>
        {tab === "strength" && (
          <Chips>
            <Pill active={!group} onClick={() => setGroup(null)}>All</Pill>
            {GROUPS.map((g) => (
              <Pill key={g.id} active={group === g.id} onClick={() => setGroup(group === g.id ? null : g.id)}>{g.label}</Pill>
            ))}
          </Chips>
        )}
      </div>

      <ul className="no-scrollbar mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-8">
        {(tab === "strength"
          ? lifts.map((ex) => ({ item: { kind: "lift" as const, refId: ex.id }, name: ex.name, meta: `${GROUP_LABEL[ex.group]} · ${equipLabel(ex.equip)}${recentIds.includes(ex.id) && !query && !group ? " · recent" : ""}` }))
          : cardio.map((a) => ({ item: { kind: "cardio" as const, refId: a.id }, name: a.name, meta: a.model === "met" ? "Sport / activity" : a.incline ? "Speed + incline" : "Speed" }))
        ).map(({ item, name, meta }) => {
          const on = picked.has(item.refId);
          const order = items.findIndex((x) => x.refId === item.refId) + 1;
          return (
            <li key={item.refId}>
              <button
                onClick={() => toggle(item)}
                aria-pressed={on}
                className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors ${on ? "bg-jamun/10" : "hover:bg-surface-2"}`}
              >
                <ItemThumb item={item} size={48} className="rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{name}</span>
                  <span className="block truncate text-xs text-muted">{meta}</span>
                </span>
                <motion.span
                  animate={on ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                  className={`grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-bold tabular ${on ? "border-jamun bg-jamun text-white" : "border-line-strong text-transparent"}`}
                >
                  {on ? order : <Plus size={14} className="text-faint" />}
                </motion.span>
              </button>
            </li>
          );
        })}
        {tab === "cardio" && !cardio.length && <p className="py-10 text-center text-sm text-muted">Nothing matches.</p>}
        {tab === "strength" && !lifts.length && <p className="py-10 text-center text-sm text-muted">No exercise matches. Try another name.</p>}
      </ul>
    </div>
  );
}

// ── small bits ──

function Chips({ children }: { children: React.ReactNode }) {
  // phones swipe sideways; desktop wraps (sideways scrolling is awkward with a mouse)
  return <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">{children}</div>;
}

function Pill({ children, onClick, active, tone }: { children: React.ReactNode; onClick: () => void; active?: boolean; tone?: "jamun" }) {
  const cls = active
    ? "border-cream bg-cream text-bg"
    : tone === "jamun"
      ? "border-jamun/50 bg-jamun/12 text-jamun"
      : "border-line-strong bg-surface-2 text-text hover:border-jamun/40";
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${cls}`}>
      {children}
    </motion.button>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{children}</p>
);
