"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Search, TriangleAlert, X } from "lucide-react";
import { motion } from "motion/react";
import { ActivityIcon, ExercisePhoto } from "@/components/workout/ExercisePhoto";
import { findActivities, findExercises, getActivity, getExercise, kgStep } from "@/lib/exercises";
import { LOW_CONFIDENCE } from "@/lib/nl/match";
import type { CardioValues, LiftValues } from "@/lib/nl/workoutDraft";
import type { WorkoutCandidate } from "@/lib/nl/workoutMatch";
import type { ParsedWorkout } from "@/lib/nl/schema";

/** One workout on the confirm card; values are edited here, burn is computed by the parent. */
export type WorkoutRowState = {
  key: number;
  said: ParsedWorkout;
  cands: WorkoutCandidate[];
  confidence: number;
  pick: { kind: "lift" | "cardio"; id: string } | null;
  lift?: LiftValues;
  cardio?: CardioValues;
};

export function ConfirmWorkoutRow({ row, kcal, onPick, onLift, onCardio, onRemove }: {
  row: WorkoutRowState;
  kcal: number | null;
  onPick: (kind: "lift" | "cardio", id: string) => void;
  onLift: (v: LiftValues) => void;
  onCardio: (v: CardioValues) => void;
  onRemove: () => void;
}) {
  const [swapping, setSwapping] = useState(false);

  if (!row.pick)
    return (
      <>
        <div className="flex items-center gap-2">
          <TriangleAlert size={16} className="shrink-0 text-saffron" />
          <p className="min-w-0 flex-1 text-sm">
            Which exercise was <span className="font-semibold">“{row.said.name}”</span>? Pick it:
          </p>
          <RemoveButton onClick={onRemove} />
        </div>
        <WorkoutPicker initial={row.said.name === "gym workout" ? "" : row.said.name} onPick={onPick} />
      </>
    );

  const ex = row.pick.kind === "lift" ? getExercise(row.pick.id) : undefined;
  const act = row.pick.kind === "cardio" ? getActivity(row.pick.id) : undefined;
  const name = ex?.name ?? act?.name ?? row.said.name;
  const alts = row.cands.filter((c) => c.item.id !== row.pick!.id).slice(0, 3);
  const unsure = row.confidence < LOW_CONFIDENCE;
  const note = row.lift?.note ?? row.cardio?.note;

  return (
    <>
      <div className="flex items-center gap-3">
        {ex ? (
          <ExercisePhoto ex={ex} className="w-16 shrink-0 rounded-xl" />
        ) : (
          <span className="shrink-0"><ActivityIcon id={row.pick.id} size={40} /></span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          {row.said.name !== name.toLowerCase() && <p className="truncate text-xs text-faint">you said “{row.said.name}”</p>}
        </div>
        <span className="font-display text-lg font-semibold tabular text-jamun">{kcal == null ? "–" : `~${kcal}`}</span>
        <RemoveButton onClick={onRemove} />
      </div>

      {ex && row.lift && <LiftControls sets={row.lift.sets} timed={ex.load === "timed"} kgStepSize={kgStep(ex.equip)} external={ex.load !== "timed"} onChange={(sets) => onLift({ sets })} />}
      {act && row.cardio && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Stepper label="min" value={row.cardio.minutes} step={5} min={1} onChange={(minutes) => onCardio({ ...row.cardio!, minutes, note: undefined })} />
          {act.model !== "met" && row.cardio.speedKmh != null && (
            <Stepper label="km/h" value={row.cardio.speedKmh} step={0.5} min={1} onChange={(speedKmh) => onCardio({ ...row.cardio!, speedKmh })} />
          )}
        </div>
      )}

      {note && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-saffron">
          <TriangleAlert size={12} className="shrink-0" /> {note}
        </p>
      )}
      {(unsure || swapping) && alts.length > 0 && (
        <div className="mt-2.5">
          {unsure && !swapping && <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-saffron">Did you mean?</p>}
          <div className="flex flex-wrap gap-1.5">
            {alts.map((c) => (
              <button key={c.item.id} onClick={() => onPick(c.kind, c.item.id)} className="rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-semibold hover:border-jamun/60">
                {c.item.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {swapping ? (
        <WorkoutPicker initial={row.said.name} onPick={(k, id) => { onPick(k, id); setSwapping(false); }} onCancel={() => setSwapping(false)} />
      ) : (
        <button onClick={() => setSwapping(true)} className="mt-2 text-xs font-semibold text-muted underline-offset-2 hover:text-text hover:underline">
          Wrong exercise? Change it
        </button>
      )}
    </>
  );
}

/** Sets × reps × kg, same for every set (the workout sheet has per-set editing for finer control). */
function LiftControls({ sets, timed, kgStepSize, external, onChange }: {
  sets: LiftValues["sets"];
  timed: boolean;
  kgStepSize: number;
  external: boolean;
  onChange: (sets: LiftValues["sets"]) => void;
}) {
  const first = sets[0] ?? { reps: 10, kg: 0 };
  const setAll = (patch: Partial<(typeof sets)[number]>) => onChange(sets.map((s) => ({ ...s, ...patch })));
  const setCount = (n: number) => onChange(Array.from({ length: n }, (_, i) => ({ ...(sets[i] ?? first) })));
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Stepper label="sets" value={sets.length} step={1} min={1} onChange={setCount} />
      {timed ? (
        <Stepper label="sec" value={first.secs ?? 30} step={5} min={5} onChange={(secs) => setAll({ secs })} />
      ) : (
        <>
          <Stepper label="reps" value={first.reps} step={1} min={1} onChange={(reps) => setAll({ reps })} />
          {external && <Stepper label="kg" value={first.kg} step={kgStepSize} min={0} onChange={(kg) => setAll({ kg })} />}
        </>
      )}
    </div>
  );
}

function Stepper({ label, value, step, min, onChange }: { label: string; value: number; step: number; min: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="flex items-center gap-1.5">
      <StepBtn onClick={() => set(value - step)} label={`Less ${label}`}><Minus size={13} /></StepBtn>
      <span className="min-w-8 text-center text-sm font-bold tabular">{value}</span>
      <StepBtn onClick={() => set(value + step)} label={`More ${label}`}><Plus size={13} /></StepBtn>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function StepBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={onClick} aria-label={label} className="grid size-7 place-items-center rounded-full border border-line-strong text-muted hover:text-text">
      {children}
    </motion.button>
  );
}

const RemoveButton = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} aria-label="Remove" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:text-chilli">
    <X size={16} />
  </button>
);

/** Inline search over exercises + cardio for swapping or choosing on the confirm card. */
function WorkoutPicker({ initial, onPick, onCancel }: { initial: string; onPick: (kind: "lift" | "cardio", id: string) => void; onCancel?: () => void }) {
  const [q, setQ] = useState(initial);
  const results = useMemo(() => {
    const lifts = findExercises(q, { group: null, sub: null, equip: null }).slice(0, 4).map((e) => ({ kind: "lift" as const, id: e.id, name: e.name }));
    const cardio = findActivities(q).slice(0, q ? 3 : 0).map((a) => ({ kind: "cardio" as const, id: a.id, name: a.name }));
    return [...cardio, ...lifts];
  }, [q]);
  return (
    <div className="mt-2 rounded-xl border border-line-strong bg-surface p-1.5">
      <label className="flex items-center gap-2 px-1.5 py-1">
        <Search size={14} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="bench press, running, yoga…" className="w-full bg-transparent text-sm outline-none placeholder:text-faint" />
        {onCancel && <button onClick={onCancel} aria-label="Cancel" className="text-muted"><X size={14} /></button>}
      </label>
      {results.map((r) => (
        <button key={`${r.kind}-${r.id}`} onClick={() => onPick(r.kind, r.id)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-surface-2">
          <span className={`rounded-md px-1.5 text-[10px] font-bold uppercase ${r.kind === "cardio" ? "bg-sky/15 text-sky" : "bg-jamun/15 text-jamun"}`}>{r.kind === "cardio" ? "cardio" : "lift"}</span>
          <span className="truncate">{r.name}</span>
        </button>
      ))}
      {!results.length && <p className="px-2 py-1 text-xs text-faint">No match. Try another word.</p>}
    </div>
  );
}
