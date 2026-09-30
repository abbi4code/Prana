"use client";

// "Add anything" (D29): one search box for food AND workouts, opened from the Today bar, / or ⌘K.
// - typing searches both catalogs; the section that fits the words better comes first
// - a sentence goes to the AI parser (signed-in), same pipeline and confirm card as the two log sheets
// - "+" on a row adds exactly what the row shows (usual portion / last session); rows with nothing to
//   repeat open the detail instead, so one tap never logs numbers the user hasn't seen

import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronRight, History, Plus, Search, X } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { Sheet } from "@/components/Sheet";
import { ActivityIcon, ExercisePhoto } from "@/components/workout/ExercisePhoto";
import { CardioDetail, LiftDetail } from "@/components/workout/WorkoutSheet";
import { DEFAULT_REST, cardioBurn, type Person } from "@/lib/burn";
import { dayKey, dayLabel } from "@/lib/dates";
import { exerciseBurn, getActivity, getExercise, matchWorkout, searchWorkouts, setsSummary, type WorkoutHit } from "@/lib/exercises";
import { STARTER_IDS, getFood, getUnit, matchFood, searchFoods } from "@/lib/foods";
import { MEALS, fmtQty, mealForNow, portion } from "@/lib/nutrition";
import { mealKcal } from "@/lib/thali";
import { useStore, useUI } from "@/lib/store";
import type { Activity, Exercise, Food, Meal, SavedMeal, Workout } from "@/lib/types";
import { useIsDesktop } from "@/lib/useMediaQuery";
import { usePerson } from "@/lib/useWorkouts";
import { CreateFood } from "./CreateFood";
import { FoodDetail } from "./FoodDetail";
import { MissingFood, useSearchMiss } from "./MissingFood";
import { MicButton, NlConfirm, SignInHint, UnderstandRow, isSentence, looksLikeFoodName, useNlLog } from "./NlLog";

// the sheet registers its mic here so the Today bar can start listening inside the same tap
// (iPhone browsers only allow the microphone from a user gesture)
let startVoice: (() => void) | null = null;

/** Open "Add anything"; `voice` starts listening straight away. */
export function openQuickAdd(voice = false) {
  useUI.getState().openQuick();
  if (voice) startVoice?.();
}

/** Always mounted (AppShell) so the voice hook exists before the sheet opens. */
export function QuickAddSheet() {
  const open = useUI((s) => s.quick);
  const closeQuick = useUI((s) => s.closeQuick);
  const [query, setQuery] = useState("");
  const nl = useNlLog(setQuery);
  const { start, abort } = nl.speech;

  // every opening starts fresh (query + AI draft); the key remounts the flow's own state
  const [session, setSession] = useState({ open, n: 0 });
  if (session.open !== open) {
    setSession({ open, n: open ? session.n + 1 : session.n });
    if (open) {
      if (!nl.speech.listening) setQuery("");
      nl.setDraft(null);
    }
  }

  useEffect(() => {
    startVoice = () => {
      setQuery("");
      start();
    };
    return () => {
      startVoice = null;
    };
  }, [start]);

  const close = () => {
    abort();
    closeQuick();
  };

  return (
    <Sheet open={open} onClose={close}>
      <QuickFlow key={session.n} query={query} setQuery={setQuery} nl={nl} onClose={close} />
    </Sheet>
  );
}

type Nl = ReturnType<typeof useNlLog>;
type Last = { unitId: string; qty: number };
type Picked = { kind: "food"; food: Food } | { kind: "lift"; ex: Exercise } | { kind: "cardio"; a: Activity } | null;
type Recent = { kind: "food"; food: Food; at: number } | (WorkoutHit & { at: number });
type Added = { name: string; kcal: number; workout: boolean };

function QuickFlow({ query, setQuery, nl, onClose }: { query: string; setQuery: (q: string) => void; nl: Nl; onClose: () => void }) {
  const date = useUI((s) => s.date) ?? dayKey();
  const showToast = useUI((s) => s.showToast);
  const entries = useStore((s) => s.entries);
  const workouts = useStore((s) => s.workouts);
  const savedMeals = useStore((s) => s.savedMeals);
  const p = usePerson(date);
  const desktop = useIsDesktop();
  const input = useRef<HTMLInputElement>(null);

  const [meal, setMeal] = useState<Meal>(mealForNow);
  const [picked, setPicked] = useState<Picked>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [added, setAdded] = useState<Added[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  // what the user usually has: last portion per food, last session per exercise, and both merged by recency
  const { lastFood, lastWork, recent } = useMemo(() => {
    const lastFood = new Map<string, Last>();
    const lastWork = new Map<string, Workout>();
    const recent: Recent[] = [];
    for (const e of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
      if (lastFood.has(e.foodId)) continue;
      lastFood.set(e.foodId, { unitId: e.unitId, qty: e.qty });
      const food = getFood(e.foodId);
      if (food) recent.push({ kind: "food", food, at: e.createdAt });
    }
    for (const w of [...workouts].sort((a, b) => b.createdAt - a.createdAt)) {
      if (w.date > date || lastWork.has(w.refId)) continue;
      lastWork.set(w.refId, w);
      const ex = w.kind === "lift" ? getExercise(w.refId) : undefined;
      const a = w.kind === "cardio" ? getActivity(w.refId) : undefined;
      if (ex) recent.push({ kind: "lift", item: ex, at: w.createdAt });
      if (a) recent.push({ kind: "cardio", item: a, at: w.createdAt });
    }
    return { lastFood, lastWork, recent: recent.sort((a, b) => b.at - a.at).slice(0, 10) };
  }, [entries, workouts, date]);

  const q = query.trim();
  const foods = useMemo(() => (q ? searchFoods(q, 8) : []), [q]);
  const works = useMemo(() => (q ? searchWorkouts(q, 6) : []), [q]);
  // "curl" is a workout, "dal" is food: the typo-tolerant matchers (nl-logging.md) say which fits better
  const workoutFirst = useMemo(() => {
    if (!foods.length || !works.length) return !foods.length;
    return (matchWorkout(q, 1)[0]?.score ?? 0) > (matchFood(q, 1)[0]?.score ?? 0);
  }, [q, foods.length, works.length]);
  const sentenceLike = isSentence(query);
  // closing on a search that matched no food and no exercise = a missing food (D54)
  const foodName = !sentenceLike || looksLikeFoodName(query);
  useSearchMiss(q, foods.length + works.length > 0, nl.signedIn && !foodName);

  const portionOf = (f: Food) => lastFood.get(f.id) ?? { unitId: f.du, qty: 1 };

  const done = (a: Added, key?: string) => {
    setAdded((list) => [...list, a]);
    navigator.vibrate?.(12);
    if (key) {
      setFlash(key);
      setTimeout(() => setFlash((k) => (k === key ? null : k)), 1200);
    }
    if (q) setQuery("");
    if (desktop) input.current?.focus();
  };

  const addFood = (f: Food) => {
    const { unitId, qty } = portionOf(f);
    useStore.getState().addEntry(f.id, unitId, qty, meal, date);
    const e = useStore.getState().entries.at(-1);
    if (!e || e.foodId !== f.id) return;
    useUI.getState().markFresh(e.id);
    done({ name: f.name, kcal: e.kcal, workout: false }, `food-${f.id}`);
    const label = MEALS.find((m) => m.id === meal)?.label ?? meal;
    showToast(`Added ${portionText(f, unitId, qty)} ${f.name} to ${label}`, { label: "Undo", run: () => useStore.getState().removeEntry(e.id) });
  };

  const repeatWorkout = (hit: WorkoutHit) => {
    const last = lastWork.get(hit.item.id);
    const data = last && p ? repeatData(hit, last, p) : null;
    if (!data) return setPicked(hit.kind === "lift" ? { kind: "lift", ex: hit.item } : { kind: "cardio", a: hit.item });
    const id = useStore.getState().addWorkout({ date, ...data });
    useUI.getState().markFresh(id);
    done({ name: hit.item.name, kcal: data.kcal, workout: true }, `${hit.kind}-${hit.item.id}`);
    showToast(`Logged ${hit.item.name} · ~${data.kcal} kcal`, { label: "Undo", run: () => useStore.getState().removeWorkout(id) });
  };

  const logThali = (m: SavedMeal) => {
    const ids = useStore.getState().logSavedMeal(m.id, meal, date);
    ids.forEach((id) => useUI.getState().markFresh(id));
    done({ name: m.name, kcal: mealKcal(m), workout: false }, `thali-${m.id}`);
    showToast(`Logged ${m.name}`, { label: "Undo", run: () => ids.forEach((id) => useStore.getState().removeEntry(id)) });
  };

  const open = (hit: WorkoutHit) => setPicked(hit.kind === "lift" ? { kind: "lift", ex: hit.item } : { kind: "cardio", a: hit.item });
  // after a detail screen saved: its newest workout is the one just logged
  const workoutSaved = () => {
    const w = useStore.getState().workouts.at(-1);
    setPicked(null);
    if (w) done({ name: w.name, kcal: w.kcal, workout: true });
  };

  if (nl.draft)
    return (
      <>
        <Drawer.Title className="sr-only">Check and log</Drawer.Title>
        <NlConfirm draft={nl.draft} initialMeal={meal} date={date} onBack={() => nl.setDraft(null)} onDone={onClose} />
      </>
    );

  if (creating !== null)
    return (
      <>
        <Drawer.Title className="sr-only">Create a food</Drawer.Title>
        <CreateFood initialName={creating} onBack={() => setCreating(null)} onCreated={(food) => { setCreating(null); setPicked({ kind: "food", food }); }} />
      </>
    );

  if (picked?.kind === "food") {
    const f = picked.food;
    return (
      <>
        <Drawer.Title className="sr-only">{f.name}</Drawer.Title>
        <FoodDetail
          food={f}
          initial={{ ...portionOf(f), meal }}
          confirmLabel={(m) => `Add to ${m}`}
          onBack={() => setPicked(null)}
          onConfirm={(v) => {
            useStore.getState().addEntry(f.id, v.unitId, v.qty, v.meal, date);
            const e = useStore.getState().entries.at(-1);
            if (e) useUI.getState().markFresh(e.id);
            setMeal(v.meal);
            setPicked(null);
            done({ name: f.name, kcal: e?.kcal ?? 0, workout: false });
          }}
        />
      </>
    );
  }
  if (picked?.kind === "lift") return <LiftDetail ex={picked.ex} date={date} onBack={() => setPicked(null)} onDone={workoutSaved} />;
  if (picked?.kind === "cardio") return <CardioDetail a={picked.a} date={date} onBack={() => setPicked(null)} onDone={workoutSaved} />;

  const foodRow = (f: Food) => {
    const { unitId, qty } = portionOf(f);
    return (
      <AddRow
        key={`food-${f.id}`}
        tone="food"
        icon={<FoodIcon cat={f.cat} size={42} />}
        title={f.name}
        sub={portionText(f, unitId, qty)}
        kcal={portion(f, getUnit(f, unitId), qty).kcal}
        flashed={flash === `food-${f.id}`}
        onOpen={() => setPicked({ kind: "food", food: f })}
        onAdd={() => addFood(f)}
        addLabel={`Add ${f.name}`}
      />
    );
  };
  const workoutRow = (hit: WorkoutHit) => {
    const last = lastWork.get(hit.item.id);
    const data = last && p ? repeatData(hit, last, p) : null;
    const key = `${hit.kind}-${hit.item.id}`;
    return (
      <AddRow
        key={key}
        tone="workout"
        icon={hit.kind === "lift" ? <ExercisePhoto ex={hit.item} className="w-[42px] shrink-0 rounded-xl" /> : <ActivityIcon id={hit.item.id} size={42} />}
        title={hit.item.name}
        sub={last ? <><History size={11} className="inline -mt-px" /> {workoutText(hit, last)}</> : hit.kind === "cardio" ? "Cardio · set time and pace" : "Set sets, reps and weight"}
        kcal={data ? `~${data.kcal}` : null}
        flashed={flash === key}
        onOpen={() => open(hit)}
        // nothing to repeat (or no body weight yet for the burn): open the detail instead of guessing
        onAdd={data ? () => repeatWorkout(hit) : undefined}
        addLabel={`Log ${hit.item.name} again`}
      />
    );
  };

  const foodSection = foods.length > 0 && <Section key="food" title="Food">{foods.map(foodRow)}</Section>;
  const workSection = works.length > 0 && <Section key="work" title="Workout">{works.map(workoutRow)}</Section>;
  const starterFoods = STARTER_IDS.slice(0, 5).map(getFood).filter(Boolean) as Food[];
  const starterWork: WorkoutHit[] = [
    { kind: "cardio", item: getActivity("outdoor-walk")! },
    { kind: "lift", item: getExercise("push-up")! },
    { kind: "lift", item: getExercise("barbell-bench-press")! },
  ].filter((h) => h.item) as WorkoutHit[];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Add food or workout</Drawer.Title>
      <div className="shrink-0 px-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">{dayLabel(date)}</p>
            <h2 className="font-display text-2xl font-semibold">Add anything</h2>
          </div>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onClose}
            className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold ${added.length ? "bg-leaf text-bg" : "border border-line-strong text-muted"}`}
          >
            {added.length ? <><Check size={16} /> Done · {added.length}</> : <><X size={16} /> Close</>}
          </motion.button>
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-line-strong bg-bg/60 px-4 py-3 focus-within:border-turmeric/60">
          <Search size={19} className="shrink-0 text-muted" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={nl.speech.listening ? "Listening… what did you eat or do?" : nl.signedIn ? "dal, bench press, or “2 roti aur 30 min walk”" : "Search food or exercise…"}
            className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-faint"
            autoComplete="off"
            autoFocus={desktop}
            enterKeyHint={nl.signedIn && sentenceLike ? "go" : "search"}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (nl.signedIn && sentenceLike) return void nl.understand(query, "text");
              // Enter opens the best match to check, it never logs blind
              const firstWork = works[0], firstFood = foods[0];
              if (workoutFirst && firstWork) open(firstWork);
              else if (firstFood) setPicked({ kind: "food", food: firstFood });
            }}
          />
          {query && !nl.speech.listening && (
            <button onClick={() => setQuery("")} aria-label="Clear" className="text-muted">
              <X size={18} />
            </button>
          )}
          <MicButton speech={nl.speech} onStart={() => setQuery("")} />
        </label>

        {/* food goes to this meal; workouts ignore it */}
        <div className="no-scrollbar -mx-5 mt-3 flex items-center gap-1.5 overflow-x-auto px-5">
          <span className="shrink-0 pr-1 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Food in</span>
          {MEALS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMeal(m.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${meal === m.id ? "bg-cream text-bg" : "bg-surface-2 text-muted"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {added.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
              {added.map((a, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${a.workout ? "bg-jamun/15 text-jamun" : "bg-leaf/15 text-leaf"}`}
                >
                  <Check size={13} /> {a.name} · {a.workout ? `~${a.kcal}` : a.kcal}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1.5rem+var(--safe-bottom))]">
        {q ? (
          <>
            {sentenceLike && (nl.signedIn ? (
              <UnderstandRow text={q} busy={nl.busy} desktop={desktop} what="words" onClick={() => void nl.understand(query, "text")} />
            ) : (
              <SignInHint what="food and workouts" />
            ))}
            {workoutFirst ? <>{workSection}{foodSection}</> : <>{foodSection}{workSection}</>}
            {/* "create it" only when the words could be a food: not for a sentence (unless it reads like one dish), not when only exercises matched */}
            {(!(nl.signedIn && sentenceLike) || foodName) && (foods.length > 0 || !works.length) && (
              <MissingFood
                query={q}
                empty={!foods.length && !works.length}
                emptyText={nl.signedIn ? <>No food or exercise called “{q}”. Ask us to add the food, or add it yourself:</> : <>No food or exercise called “{q}”. Try another name, or add the food yourself:</>}
                createLabel={`Create “${q}” as a food`}
                onCreate={() => setCreating(q)}
              />
            )}
          </>
        ) : (
          <>
            {savedMeals.length > 0 && (
              <div className="mt-3">
                <SectionTitle>My thalis · one tap logs all of it</SectionTitle>
                <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
                  {savedMeals.map((m) => (
                    <motion.button
                      key={m.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => logThali(m)}
                      className="flex shrink-0 items-center gap-2 rounded-full border border-line-strong bg-surface-2 py-1.5 pl-3.5 pr-1.5 text-sm font-semibold hover:border-turmeric/50"
                    >
                      {m.name}
                      <span className="text-xs font-normal text-muted tabular">{mealKcal(m)}</span>
                      <span className={`grid size-7 place-items-center rounded-full ${flash === `thali-${m.id}` ? "bg-leaf text-bg" : "bg-turmeric/15 text-turmeric"}`}>
                        {flash === `thali-${m.id}` ? <Check size={14} /> : <Plus size={14} />}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            {recent.length > 0 ? (
              <Section title="Again? One tap adds it">
                {recent.map((r) => (r.kind === "food" ? foodRow(r.food) : workoutRow(r)))}
              </Section>
            ) : (
              <>
                <Section title="Popular food">{starterFoods.map(foodRow)}</Section>
                <Section title="Popular workouts">{starterWork.map(workoutRow)}</Section>
              </>
            )}
            {nl.signedIn && (
              <p className="px-2 pt-4 text-center text-xs text-faint">
                Tip: say it all at once, like “2 roti, dal aur 30 min walk”.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Values to log a workout again exactly as last time, with the burn recomputed for today's body weight. */
function repeatData(hit: WorkoutHit, last: Workout, p: Person) {
  if (hit.kind === "lift") {
    if (!last.sets?.length) return null;
    const rest = last.restSec ?? DEFAULT_REST;
    const intense = last.intense ?? false;
    const est = exerciseBurn(hit.item, last.sets, rest, intense, p);
    return { kind: "lift" as const, refId: hit.item.id, name: hit.item.name, sets: last.sets.map((s) => ({ ...s })), restSec: rest, intense, minutes: est.minutes, met: est.met, kcal: est.kcal, ...(est.burn ? { burn: est.burn } : {}) };
  }
  const v = { minutes: last.minutes, speedKmh: last.speedKmh, inclinePct: last.inclinePct, optionCode: last.optionCode };
  const est = cardioBurn(hit.item, v, p);
  return { kind: "cardio" as const, refId: hit.item.id, name: hit.item.name, ...v, met: est.met, kcal: est.kcal };
}

/** "1 katori (150 ml)", "2 × chapati", "150 g" (same wording as the meal cards). */
function portionText(f: Food, unitId: string, qty: number) {
  if (unitId === "g") return `${qty} g`;
  const label = getUnit(f, unitId).label;
  return qty === 1 ? label : `${fmtQty(qty)} × ${label.replace(/^1 /, "")}`;
}

function workoutText(hit: WorkoutHit, last: Workout) {
  if (hit.kind === "lift") return `${last.sets?.length ?? 0} sets · ${setsSummary(last, hit.item)}`;
  const opt = hit.item.options.find((o) => o.code === last.optionCode)?.label;
  return [`${Math.round(last.minutes)} min`, last.speedKmh ? `${last.speedKmh} km/h` : opt].filter(Boolean).join(" · ");
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{children}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <SectionTitle>{title}</SectionTitle>
      <ul>{children}</ul>
    </div>
  );
}

/** Tap the row to check/adjust first; tap + to add it as shown. */
function AddRow({ tone, icon, title, sub, kcal, flashed, onOpen, onAdd, addLabel }: {
  tone: "food" | "workout";
  icon: React.ReactNode;
  title: string;
  sub: React.ReactNode;
  kcal: number | string | null;
  flashed: boolean;
  onOpen: () => void;
  onAdd?: () => void;
  addLabel: string;
}) {
  const accent = tone === "food" ? "bg-turmeric/15 text-turmeric hover:bg-turmeric/25" : "bg-jamun/15 text-jamun hover:bg-jamun/25";
  return (
    <li className="flex items-center gap-1 rounded-2xl pr-1 hover:bg-surface-2">
      <motion.button whileTap={{ scale: 0.98 }} onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2.5 text-left">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block truncate text-[13px] text-muted">{sub}</span>
        </span>
        {kcal != null && (
          <span className="flex items-baseline gap-1">
            <span className={`font-display font-semibold tabular ${tone === "workout" ? "text-jamun" : ""}`}>{kcal}</span>
            <span className="text-xs text-muted">kcal</span>
          </span>
        )}
        {!onAdd && <ChevronRight size={18} className="shrink-0 text-faint" />}
      </motion.button>
      {onAdd && (
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onAdd}
          aria-label={addLabel}
          className={`grid size-10 shrink-0 place-items-center rounded-full transition-colors ${flashed ? "bg-leaf text-bg" : accent}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={flashed ? "ok" : "add"} initial={{ scale: 0.4, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.4 }}>
              {flashed ? <Check size={18} strokeWidth={2.8} /> : <Plus size={18} strokeWidth={2.6} />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      )}
    </li>
  );
}
