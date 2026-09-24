"use client";

import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, ChevronLeft, Dumbbell, History, Minus, Plus, Scale, Search, Trash, X } from "lucide-react";
import { RollingNumber } from "@/components/RollingNumber";
import { DEFAULT_REST, REST_CHOICES, cardioBurn, liftBurn, type Person } from "@/lib/burn";
import { dayKey, dayLabel, parseDay } from "@/lib/dates";
import {
  EQUIPMENT, GROUPS, GROUP_LABEL, defaultKg, equipLabel, findActivities, findExercises, getActivity, getExercise, kgStep, loadSteps, muscleLabel, setsSummary,
} from "@/lib/exercises";
import { MicButton, NlConfirm, SignInHint, UnderstandRow, isSentence, useNlLog } from "@/components/log/NlLog";
import { mealForNow } from "@/lib/nutrition";
import { useStore, useUI } from "@/lib/store";
import type { Activity, Exercise, MuscleGroup, WorkSet, Workout } from "@/lib/types";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { lastTime, useDayWorkouts, usePerson } from "@/lib/useWorkouts";
import { Sheet } from "@/components/Sheet";
import { ActivityIcon, ExercisePhoto } from "./ExercisePhoto";

/**
 * Workout log sheet (D27). Phone: bottom sheet, library → detail. Desktop: centred modal; picking is two-pane
 * (library left, the chosen exercise's logger right) so a whole session is logged without navigating back and forth.
 */
export function WorkoutSheet() {
  const gym = useUI((s) => s.gym);
  const closeGym = useUI((s) => s.closeGym);
  return (
    <Sheet open={!!gym} onClose={closeGym} size={gym ? (gym.mode === "edit" ? "narrow" : "wide") : undefined}>
      {gym?.mode === "pick" && <PickFlow key="pick" initialTab={gym.tab} />}
      {gym?.mode === "edit" && <EditFlow key={gym.workoutId} workoutId={gym.workoutId} />}
    </Sheet>
  );
}

type Picked = { kind: "lift"; ex: Exercise } | { kind: "cardio"; a: Activity } | null;

function PickFlow({ initialTab }: { initialTab: "strength" | "cardio" }) {
  const date = useUI((s) => s.date) ?? dayKey();
  const closeGym = useUI((s) => s.closeGym);
  const workouts = useStore((s) => s.workouts);
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked>(null);
  const [added, setAdded] = useState(0);
  const desktop = useIsDesktop();
  // natural-language logging (nl-logging.md): "bench 3x10 60kg aur 20 min treadmill" → confirm card
  const nl = useNlLog(setQuery);
  const sentenceLike = isSentence(query);

  const list = useMemo(() => findExercises(query, { group, sub, equip }), [query, group, sub, equip]);
  const activities = useMemo(() => findActivities(query), [query]);
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Exercise[] = [];
    for (const w of [...workouts].sort((a, b) => b.createdAt - a.createdAt)) {
      if (w.kind !== "lift" || seen.has(w.refId)) continue;
      seen.add(w.refId);
      const ex = getExercise(w.refId);
      if (ex) out.push(ex);
      if (out.length >= 8) break;
    }
    return out;
  }, [workouts]);

  const done = () => {
    setPicked(null);
    setAdded((n) => n + 1);
  };

  if (nl.draft)
    return (
      <>
        <Drawer.Title className="sr-only">Check and log</Drawer.Title>
        <NlConfirm draft={nl.draft} initialMeal={mealForNow()} date={date} onBack={() => nl.setDraft(null)} onDone={closeGym} />
      </>
    );

  // desktop shows the detail beside the library (embedded: no second dialog title)
  const detail =
    picked?.kind === "lift" ? <LiftDetail key={picked.ex.id} ex={picked.ex} date={date} embedded={desktop} onBack={() => setPicked(null)} onDone={done} />
    : picked?.kind === "cardio" ? <CardioDetail key={picked.a.id} a={picked.a} date={date} embedded={desktop} onBack={() => setPicked(null)} onDone={done} />
    : null;
  if (detail && !desktop) return detail;
  const isPicked = (id: string) => (picked?.kind === "lift" ? picked.ex.id : picked?.a.id) === id;

  const groupDef = GROUPS.find((g) => g.id === group);
  const browsing = !query && !group && !equip;

  const library = (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Add to workout</Drawer.Title>
      <div className="shrink-0 px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">{dayLabel(date)}</p>
            <h2 className="font-display text-2xl font-semibold">Add to workout</h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={closeGym}
            className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold ${added ? "bg-cream text-bg" : "border border-line-strong text-muted"}`}
          >
            {added ? <><Check size={16} /> Done · {added}</> : <><X size={16} /> Close</>}
          </motion.button>
        </div>

        <div className="mt-4 flex rounded-2xl border border-line-strong bg-surface-2 p-1">
          {(["strength", "cardio"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${tab === t ? "text-bg" : "text-muted hover:text-text"}`}
            >
              {tab === t && <motion.span layoutId="gym-tab" className="absolute inset-0 rounded-xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
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
            placeholder={
              nl.speech.listening ? "Listening… what did you do?"
              : nl.signedIn ? (tab === "strength" ? "bench 3x10 60kg, or search…" : "30 min treadmill, or search…")
              : tab === "strength" ? "Search: bench, lat pulldown, dand…" : "Search: treadmill, cricket, yoga…"
            }
            enterKeyHint={nl.signedIn && sentenceLike ? "go" : "search"}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing || !nl.signedIn || !sentenceLike) return;
              e.preventDefault();
              void nl.understand(query, "text");
            }}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
          />
          {query && !nl.speech.listening && (
            <button onClick={() => setQuery("")} aria-label="Clear search" className="grid size-7 place-items-center rounded-full text-faint">
              <X size={15} />
            </button>
          )}
          <MicButton speech={nl.speech} onStart={() => setQuery("")} accent="jamun" />
        </label>
        {sentenceLike && (nl.signedIn ? (
          <div className="mt-2">
            <UnderstandRow text={query.trim()} busy={nl.busy} desktop={desktop} what="workout" onClick={() => void nl.understand(query, "text")} />
          </div>
        ) : (
          <div className="mt-2"><SignInHint what="a whole workout" /></div>
        ))}

        {tab === "strength" && (
          <>
            <ChipRow>
              <Chip active={!group} onClick={() => { setGroup(null); setSub(null); }}>All</Chip>
              {GROUPS.map((g) => (
                <Chip key={g.id} active={group === g.id} onClick={() => { setGroup(group === g.id ? null : g.id); setSub(null); }}>{g.label}</Chip>
              ))}
            </ChipRow>
            <AnimatePresence initial={false}>
              {groupDef?.subs && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <ChipRow>
                    {groupDef.subs.map((s) => (
                      <Chip key={s} small tone="jamun" active={sub === s} onClick={() => setSub(sub === s ? null : s)}>{muscleLabel(s)}</Chip>
                    ))}
                  </ChipRow>
                </motion.div>
              )}
            </AnimatePresence>
            <ChipRow>
              {EQUIPMENT.map((e) => (
                <Chip key={e.id} small active={equip === e.id} onClick={() => setEquip(equip === e.id ? null : e.id)}>{e.label}</Chip>
              ))}
            </ChipRow>
          </>
        )}
      </div>

      <div className="no-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {tab === "strength" ? (
          <>
            {browsing && recent.length > 0 && (
              <>
                <SectionLabel icon={<History size={13} />}>Recent</SectionLabel>
                <div className="no-scrollbar -mx-5 mb-2 flex gap-3 overflow-x-auto px-5 pb-1">
                  {recent.map((ex) => (
                    <button key={ex.id} onClick={() => setPicked({ kind: "lift", ex })} className="w-32 shrink-0 text-left">
                      <ExercisePhoto ex={ex} className={`rounded-2xl ${isPicked(ex.id) ? "ring-2 ring-jamun" : ""}`} />
                      <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug">{ex.name}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
            <SectionLabel>
              {list.length} {sub ? muscleLabel(sub).toLowerCase() : group ? GROUP_LABEL[group].toLowerCase() : ""} exercise{list.length === 1 ? "" : "s"}
            </SectionLabel>
            {list.length ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {list.map((ex, i) => (
                  <motion.button
                    key={ex.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setPicked({ kind: "lift", ex })}
                    className={`overflow-hidden rounded-2xl border bg-surface-2 text-left transition-colors hover:border-jamun/50 ${
                      isPicked(ex.id) ? "border-jamun ring-2 ring-jamun/40" : "border-line"
                    }`}
                  >
                    <ExercisePhoto ex={ex} />
                    <div className="px-3 pb-3 pt-2">
                      <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{ex.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {GROUP_LABEL[ex.group]}{ex.sub ? ` · ${muscleLabel(ex.sub)}` : ""} · {equipLabel(ex.equip)}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted">No exercise matches. Try another name or clear a filter.</p>
            )}
          </>
        ) : (
          <ul className="space-y-1">
            {activities.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setPicked({ kind: "cardio", a })}
                  className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2 active:bg-surface-2 ${isPicked(a.id) ? "bg-surface-2 ring-2 ring-jamun/50" : ""}`}
                >
                  <ActivityIcon id={a.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {a.model === "met" ? a.options.map((o) => o.label).slice(0, 3).join(" · ") : a.incline ? "Speed + incline" : "Speed"}
                    </span>
                  </span>
                  <Plus size={18} className="text-faint" />
                </button>
              </li>
            ))}
            {!activities.length && <p className="py-10 text-center text-sm text-muted">Nothing matches.</p>}
          </ul>
        )}
      </div>
    </div>
  );

  if (!desktop) return library;
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-h-0 border-r border-line">{library}</div>
      <div className="min-h-0">{detail ?? <SessionPane date={date} />}</div>
    </div>
  );
}

/** Desktop right pane before anything is picked: today's session so far, tap one to edit it. */
function SessionPane({ date }: { date: string }) {
  const { day, kcal, minutes } = useDayWorkouts(date);
  const editWorkout = useUI((s) => s.editWorkout);
  return (
    <div className="flex h-full min-h-0 flex-col px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{dayLabel(date)}&apos;s session</p>
      <p className="mt-1 font-display text-5xl font-semibold text-jamun">
        <span className="text-2xl">~</span>
        <RollingNumber value={kcal} />
        <span className="ml-1.5 text-base font-medium text-muted">kcal · {minutes} min</span>
      </p>
      {day.length ? (
        <ul className="no-scrollbar mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pb-6">
          <AnimatePresence initial={false}>
            {day.map((w) => {
              const ex = w.kind === "lift" ? getExercise(w.refId) : undefined;
              return (
                <motion.li key={w.id} layout initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
                  <button onClick={() => editWorkout(w.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2">
                    {ex ? <ExercisePhoto ex={ex} className="w-14 shrink-0 rounded-xl" /> : <ActivityIcon id={w.refId} size={40} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{w.name}</span>
                      <span className="block truncate text-xs text-muted tabular">{w.kind === "lift" ? setsSummary(w, ex) : `${Math.round(w.minutes)} min`}</span>
                    </span>
                    <span className="font-display font-semibold tabular text-jamun">~{w.kcal}</span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="grid flex-1 place-items-center pb-16 text-center">
          <div>
            <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-jamun/12 text-jamun">
              <Dumbbell size={30} />
            </span>
            <p className="mt-4 font-display text-xl font-semibold">Pick an exercise</p>
            <p className="mx-auto mt-1 max-w-64 text-sm text-muted">Its photos, your last sets and the burn estimate open here. Log it, then pick the next.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EditFlow({ workoutId }: { workoutId: string }) {
  const w = useStore((s) => s.workouts.find((x) => x.id === workoutId));
  const closeGym = useUI((s) => s.closeGym);
  if (!w) return null;
  if (w.kind === "lift") {
    const ex = getExercise(w.refId);
    return ex ? <LiftDetail ex={ex} date={w.date} initial={w} onDone={closeGym} /> : null;
  }
  const a = getActivity(w.refId);
  return a ? <CardioDetail a={a} date={w.date} initial={w} onDone={closeGym} /> : null;
}

// ── Strength ──

const fresh = (ex: Exercise): WorkSet[] =>
  Array.from({ length: 3 }, () => (ex.load === "timed" ? { reps: 1, kg: 0, secs: 30 } : { reps: 10, kg: defaultKg(ex) }));

export function LiftDetail({ ex, date, initial, embedded, onBack, onDone }: { ex: Exercise; date: string; initial?: Workout; embedded?: boolean; onBack?: () => void; onDone: () => void }) {
  const workouts = useStore((s) => s.workouts);
  const addWorkout = useStore((s) => s.addWorkout);
  const updateWorkout = useStore((s) => s.updateWorkout);
  const showToast = useUI((s) => s.showToast);
  const markFresh = useUI((s) => s.markFresh);
  const p = usePerson(date);
  const last = useMemo(() => lastTime(workouts, ex.id, date, initial?.id), [workouts, ex.id, date, initial?.id]);

  const [sets, setSets] = useState<WorkSet[]>(() => initial?.sets ?? last?.sets?.map((s) => ({ ...s })) ?? fresh(ex));
  const [rest, setRest] = useState(initial?.restSec ?? last?.restSec ?? DEFAULT_REST);
  const [intense, setIntense] = useState(initial?.intense ?? false);
  const [steps, setSteps] = useState<string[] | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const est = p ? liftBurn(ex, sets, rest, intense, p) : null;
  const timed = ex.load === "timed";
  const kgLabel = ex.load === "assisted" ? "assist kg" : ex.load === "bodyweight" ? "+ kg" : "kg";
  const step = kgStep(ex.equip);

  const patch = (i: number, v: Partial<WorkSet>) => setSets((list) => list.map((s, j) => (j === i ? { ...s, ...v } : s)));

  const save = () => {
    if (!est || !sets.length) return;
    const data = { kind: "lift" as const, refId: ex.id, name: ex.name, sets, restSec: rest, intense, minutes: est.minutes, met: est.met, kcal: est.kcal };
    if (initial) {
      updateWorkout(initial.id, data);
      showToast(`Updated ${ex.name}`);
    } else {
      const id = addWorkout({ date, ...data });
      markFresh(id);
      navigator.vibrate?.(12);
      showToast(`Logged ${ex.name} · ~${est.kcal} kcal`, { label: "Undo", run: () => useStore.getState().removeWorkout(id) });
    }
    onDone();
  };

  const toggleSteps = async () => {
    setShowSteps((v) => !v);
    if (!steps) setSteps(await loadSteps(ex.id));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!embedded && <Drawer.Title className="sr-only">{ex.name}</Drawer.Title>}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="relative">
          <ExercisePhoto ex={ex} animate className="rounded-3xl" />
          {onBack && (
            <button onClick={onBack} aria-label={embedded ? "Close" : "Back"} className="absolute left-2 top-2 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
              {embedded ? <X size={20} /> : <ChevronLeft size={22} />}
            </button>
          )}
          {initial && <DeleteButton workout={initial} onDone={onDone} />}
        </div>

        <h2 className="mt-4 font-display text-2xl font-semibold leading-tight">{ex.name}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(ex.muscles.length ? ex.muscles : [ex.sub ?? ex.group]).map((m) => (
            <span key={m} className="rounded-full bg-jamun/15 px-2.5 py-1 text-xs font-semibold text-jamun">{muscleLabel(m)}</span>
          ))}
          {ex.also.slice(0, 3).map((m) => (
            <span key={m} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">{muscleLabel(m)}</span>
          ))}
          <span className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-muted">{equipLabel(ex.equip)}</span>
        </div>

        {last && !initial && (
          <p className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
            <History size={14} className="shrink-0 text-jamun" />
            <span className="truncate">
              Last time ({parseDay(last.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}): <span className="font-semibold text-text">{setsSummary(last, ex)}</span>
            </span>
          </p>
        )}

        <Label>Sets</Label>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {sets.map((s, i) => (
              <motion.li
                key={i}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-muted tabular">{i + 1}</span>
                {timed ? (
                  <NumStepper label="sec" value={s.secs ?? 30} step={5} min={5} onChange={(v) => patch(i, { secs: v })} />
                ) : (
                  <>
                    <NumStepper label={kgLabel} value={s.kg} step={step} min={0} decimal onChange={(v) => patch(i, { kg: v })} />
                    <span className="text-faint">×</span>
                    <NumStepper label="reps" value={s.reps} step={1} min={1} onChange={(v) => patch(i, { reps: v })} />
                  </>
                )}
                <button
                  onClick={() => setSets((list) => list.filter((_, j) => j !== i))}
                  disabled={sets.length === 1}
                  aria-label={`Remove set ${i + 1}`}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:text-chilli disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setSets((list) => [...list, { ...(list.at(-1) ?? fresh(ex)[0]) }])}
          className="mt-2 flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong text-sm font-semibold text-muted hover:border-jamun/50 hover:text-jamun"
        >
          <Plus size={16} /> Add set
        </motion.button>

        <Label>Rest between sets</Label>
        <div className="flex gap-2">
          {REST_CHOICES.map((r) => (
            <Chip key={r} small active={rest === r} onClick={() => setRest(r)}>{r < 120 ? `${r} s` : `${r / 60} min`}</Chip>
          ))}
        </div>

        <Label>Pace</Label>
        <div className="flex gap-2">
          <Chip small active={!intense} onClick={() => setIntense(false)}>Normal</Chip>
          <Chip small active={intense} onClick={() => setIntense(true)}>Intense · supersets, short rest</Chip>
        </div>

        {ex.photo && (
          <button onClick={toggleSteps} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm font-semibold">
            How to do it
            <ChevronDown size={18} className={`text-muted transition-transform ${showSteps ? "rotate-180" : ""}`} />
          </button>
        )}
        <AnimatePresence initial={false}>
          {showSteps && steps && (
            <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {steps.map((t, i) => (
                <li key={i} className="flex gap-3 px-1 pt-3 text-sm leading-relaxed text-muted">
                  <span className="font-display font-semibold text-jamun">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </motion.ol>
          )}
        </AnimatePresence>
      </div>

      <Footer p={p} est={est} label={initial ? "Save changes" : "Log exercise"} onSave={save} disabled={!sets.length} />
    </div>
  );
}

// ── Cardio ──

export function CardioDetail({ a, date, initial, embedded, onBack, onDone }: { a: Activity; date: string; initial?: Workout; embedded?: boolean; onBack?: () => void; onDone: () => void }) {
  const addWorkout = useStore((s) => s.addWorkout);
  const updateWorkout = useStore((s) => s.updateWorkout);
  const showToast = useUI((s) => s.showToast);
  const markFresh = useUI((s) => s.markFresh);
  const p = usePerson(date);

  const [minutes, setMinutes] = useState(initial?.minutes ?? 30);
  const [speed, setSpeed] = useState(initial?.speedKmh ?? a.start?.speed ?? 5);
  const [incline, setIncline] = useState(initial?.inclinePct ?? a.start?.incline ?? 0);
  const [option, setOption] = useState(initial?.optionCode ?? a.options[0]?.code);

  const v = { minutes, speedKmh: a.model === "met" ? undefined : speed, inclinePct: a.incline ? incline : a.model === "met" ? undefined : 0, optionCode: a.model === "met" ? option : undefined };
  const est = p ? cardioBurn(a, v, p) : null;
  const pace = a.model === "run" && speed > 0 ? 60 / speed : null;

  const save = () => {
    if (!est) return;
    const data = { kind: "cardio" as const, refId: a.id, name: a.name, ...v, minutes, met: est.met, kcal: est.kcal };
    if (initial) {
      updateWorkout(initial.id, data);
      showToast(`Updated ${a.name}`);
    } else {
      const id = addWorkout({ date, ...data });
      markFresh(id);
      navigator.vibrate?.(12);
      showToast(`Logged ${a.name} · ~${est.kcal} kcal`, { label: "Undo", run: () => useStore.getState().removeWorkout(id) });
    }
    onDone();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!embedded && <Drawer.Title className="sr-only">{a.name}</Drawer.Title>}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex items-center gap-3 pt-1">
          {onBack && (
            <button onClick={onBack} aria-label="Back" className="-ml-2 grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
              {embedded ? <X size={22} /> : <ChevronLeft size={24} />}
            </button>
          )}
          <ActivityIcon id={a.id} size={52} />
          <h2 className="min-w-0 flex-1 font-display text-2xl font-semibold leading-tight">{a.name}</h2>
          {initial && <DeleteButton workout={initial} onDone={onDone} inline />}
        </div>

        <Label>Minutes</Label>
        <BigStepper value={minutes} step={5} min={1} max={600} unit="min" onChange={setMinutes} />
        <div className="mt-3 flex gap-2">
          {[10, 20, 30, 45, 60].map((m) => (
            <Chip key={m} small active={minutes === m} onClick={() => setMinutes(m)}>{m}</Chip>
          ))}
        </div>

        {a.model !== "met" && (
          <>
            <Label>Speed</Label>
            <BigStepper value={speed} step={0.5} min={1} max={25} unit="km/h" decimal onChange={setSpeed} />
            {pace && <p className="mt-2 text-center text-xs text-muted">≈ {Math.floor(pace)}:{String(Math.round((pace % 1) * 60)).padStart(2, "0")} min per km</p>}
            {a.incline && (
              <>
                <Label>Incline</Label>
                <BigStepper value={incline} step={0.5} min={0} max={30} unit="%" decimal onChange={setIncline} />
              </>
            )}
          </>
        )}

        {a.model === "met" && a.options.length > 1 && (
          <>
            <Label>How hard</Label>
            <div className="flex flex-wrap gap-2">
              {a.options.map((o) => (
                <Chip key={o.code} small active={option === o.code} onClick={() => setOption(o.code)}>{o.label}</Chip>
              ))}
            </div>
          </>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-faint">
          {a.model === "met"
            ? `Compendium of Physical Activities 2024, code ${option}.`
            : `ACSM ${a.model === "walk" ? "walking" : "running"} equation from your speed${a.incline ? " and incline" : ""}.`}{" "}
          Only calories above your resting burn are counted, because your food goal already includes those.
        </p>
      </div>

      <Footer p={p} est={est} label={initial ? "Save changes" : `Log ${a.model === "met" ? "activity" : "cardio"}`} onSave={save} />
    </div>
  );
}

// ── Shared bits ──

function Footer({ p, est, label, onSave, disabled }: { p: Person | null; est: { kcal: number; minutes: number } | null; label: string; onSave: () => void; disabled?: boolean }) {
  return (
    <div className="shrink-0 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
      {!p ? (
        <WeightPrompt />
      ) : (
        <>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Estimated burn</p>
              <p className="font-display text-3xl font-semibold text-jamun">
                <span className="text-xl">~</span>
                <RollingNumber value={est?.kcal ?? 0} />
                <span className="ml-1 text-base font-medium text-muted">kcal</span>
              </p>
            </div>
            <p className="pb-1 text-right text-xs text-muted tabular">
              {Math.round(est?.minutes ?? 0)} min
              <br />
              {p.personal ? `for ${p.kg} kg` : <span className="text-faint">add age + height in Me for a personal estimate</span>}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onSave}
            disabled={disabled}
            className="h-13 w-full rounded-2xl bg-gradient-to-r from-jamun to-chilli py-3.5 font-bold text-white shadow-[0_10px_30px_-10px_var(--color-jamun)] disabled:opacity-40"
          >
            {label}
          </motion.button>
        </>
      )}
    </div>
  );
}

/** Burn needs a body weight; we never guess one. Logs today's weight (same as Progress). */
function WeightPrompt() {
  const logWeight = useStore((s) => s.logWeight);
  const [kg, setKg] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = parseFloat(kg);
        if (v > 20 && v < 300) logWeight(dayKey(), Math.round(v * 10) / 10);
      }}
    >
      <p className="flex items-center gap-2 text-sm text-muted">
        <Scale size={16} className="text-jamun" /> Burn depends on body weight. What do you weigh?
      </p>
      <div className="flex gap-2">
        <input
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          inputMode="decimal"
          placeholder="Weight in kg"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line-strong bg-bg/60 px-4 outline-none placeholder:text-faint focus:border-jamun/60"
        />
        <motion.button whileTap={{ scale: 0.95 }} className="h-12 rounded-2xl bg-cream px-5 font-bold text-bg">Save</motion.button>
      </div>
    </form>
  );
}

function DeleteButton({ workout, onDone, inline }: { workout: Workout; onDone: () => void; inline?: boolean }) {
  const removeWorkout = useStore((s) => s.removeWorkout);
  const restoreWorkout = useStore((s) => s.restoreWorkout);
  const showToast = useUI((s) => s.showToast);
  return (
    <button
      onClick={() => {
        removeWorkout(workout.id);
        showToast(`Removed ${workout.name}`, { label: "Undo", run: () => restoreWorkout(workout) });
        onDone();
      }}
      aria-label={`Delete ${workout.name}`}
      className={
        inline
          ? "grid size-10 place-items-center rounded-full text-faint hover:bg-chilli/10 hover:text-chilli"
          : "absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:text-chilli"
      }
    >
      <Trash size={17} />
    </button>
  );
}

/** Compact −/value/+ used in each set row. Typing works too. */
function NumStepper({ label, value, step, min, decimal, onChange }: { label: string; value: number; step: number; min: number; decimal?: boolean; onChange: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  const bump = (dir: 1 | -1) => onChange(Math.max(min, Math.round((value + dir * step) * 10) / 10));
  return (
    <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-line-strong bg-surface-2">
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => bump(-1)} aria-label={`Less ${label}`} className="grid h-11 w-8 shrink-0 place-items-center text-muted">
        <Minus size={15} />
      </motion.button>
      <label className="min-w-0 flex-1 text-center">
        <input
          value={text ?? String(value)}
          inputMode={decimal ? "decimal" : "numeric"}
          onFocus={(e) => { setText(String(value)); e.target.select(); }}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v) && v >= min) onChange(Math.round(v * 10) / 10);
          }}
          onBlur={() => setText(null)}
          aria-label={label}
          className="w-full bg-transparent text-center font-display text-lg font-semibold leading-none outline-none tabular"
        />
        <span className="block text-[9px] font-bold uppercase tracking-wider text-faint">{label}</span>
      </label>
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => bump(1)} aria-label={`More ${label}`} className="grid h-11 w-8 shrink-0 place-items-center text-muted">
        <Plus size={15} />
      </motion.button>
    </div>
  );
}

function BigStepper({ value, step, min, max, unit, decimal, onChange }: { value: number; step: number; min: number; max: number; unit: string; decimal?: boolean; onChange: (v: number) => void }) {
  const bump = (dir: 1 | -1) => onChange(Math.min(max, Math.max(min, Math.round((value + dir * step) * 10) / 10)));
  return (
    <div className="flex items-center justify-between gap-4">
      <motion.button whileTap={{ scale: 0.88 }} onClick={() => bump(-1)} aria-label={`Less ${unit}`} className="grid size-14 place-items-center rounded-full border border-line-strong bg-surface-2">
        <Minus size={22} />
      </motion.button>
      <p className="font-display text-4xl font-semibold tabular">
        {decimal ? value.toFixed(1) : value}
        <span className="ml-1.5 text-base font-medium text-muted">{unit}</span>
      </p>
      <motion.button whileTap={{ scale: 0.88 }} onClick={() => bump(1)} aria-label={`More ${unit}`} className="grid size-14 place-items-center rounded-full border border-line-strong bg-surface-2">
        <Plus size={22} />
      </motion.button>
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  // phones swipe the row sideways; desktop wraps it (sideways scrolling is awkward with a mouse)
  return <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">{children}</div>;
}

function Chip({ active, small, tone, children, onClick }: { active: boolean; small?: boolean; tone?: "jamun"; children: React.ReactNode; onClick: () => void }) {
  const on = tone === "jamun" ? "border-jamun bg-jamun text-white" : "border-cream bg-cream text-bg";
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border font-semibold transition-colors ${small ? "px-3.5 py-1.5 text-[13px]" : "px-4 py-2 text-sm"} ${
        active ? on : "border-line-strong bg-surface-2 text-text"
      }`}
    >
      {children}
    </motion.button>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{children}</p>
);

const SectionLabel = ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
  <p className="mb-2 mt-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{icon}{children}</p>
);
