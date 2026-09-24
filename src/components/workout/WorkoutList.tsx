"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { Trash } from "lucide-react";
import { getActivity, getExercise, setsSummary } from "@/lib/exercises";
import { useStore, useUI } from "@/lib/store";
import type { Workout } from "@/lib/types";
import { ActivityIcon, ExercisePhoto } from "./ExercisePhoto";

/** A day's exercises and cardio. Tap to edit; swipe left to delete (with undo), like meal rows. */
export function WorkoutList({ workouts }: { workouts: Workout[] }) {
  const removeWorkout = useStore((s) => s.removeWorkout);
  const restoreWorkout = useStore((s) => s.restoreWorkout);
  const showToast = useUI((s) => s.showToast);

  const remove = (w: Workout) => {
    removeWorkout(w.id);
    navigator.vibrate?.(15);
    showToast(`Removed ${w.name}`, { label: "Undo", run: () => restoreWorkout(w) });
  };

  return (
    <ul className="px-2 pb-2">
      <AnimatePresence initial={false}>
        {workouts.map((w) => (
          <motion.li key={w.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}>
            <Row w={w} onDelete={() => remove(w)} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

const DELETE_AT = -88;

function Row({ w, onDelete }: { w: Workout; onDelete: () => void }) {
  const editWorkout = useUI((s) => s.editWorkout);
  const fresh = useUI((s) => s.fresh.includes(w.id));
  const clearFresh = useUI((s) => s.clearFresh);
  const x = useMotionValue(0);
  const binOpacity = useTransform(x, [-10, DELETE_AT], [0, 1]);
  const binScale = useTransform(x, [-10, DELETE_AT, DELETE_AT - 30], [0.6, 1, 1.15]);
  const faceOpacity = useTransform(x, [0, -6], [0, 1]);
  const dragged = useRef(false);
  const ex = w.kind === "lift" ? getExercise(w.refId) : undefined;
  const act = w.kind === "cardio" ? getActivity(w.refId) : undefined;
  const option = act?.options.find((o) => o.code === w.optionCode);

  const detail =
    w.kind === "lift"
      ? `${w.sets?.length ?? 0} set${w.sets?.length === 1 ? "" : "s"} · ${setsSummary(w, ex)}`
      : [`${Math.round(w.minutes)} min`, w.speedKmh ? `${w.speedKmh} km/h` : null, w.inclinePct ? `${w.inclinePct}% incline` : null, act && act.options.length > 1 ? option?.label : null]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <motion.div style={{ opacity: binOpacity }} className="absolute inset-0 flex items-center justify-end rounded-2xl bg-chilli/15 pr-5 text-chilli">
        <motion.span style={{ scale: binScale }}>
          <Trash size={18} />
        </motion.span>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        dragSnapToOrigin
        dragDirectionLock
        style={{ x, touchAction: "pan-y" }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          if (info.offset.x < DELETE_AT) onDelete();
          setTimeout(() => (dragged.current = false), 0);
        }}
        className="relative"
      >
        <motion.span aria-hidden style={{ opacity: faceOpacity }} className="pointer-events-none absolute inset-0 rounded-2xl bg-surface-2" />
        {fresh && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl bg-jamun/25"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.4, delay: 0.35, ease: "easeOut" }}
            onAnimationComplete={() => clearFresh(w.id)}
          />
        )}
        <button
          onClick={() => !dragged.current && editWorkout(w.id)}
          className="relative flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2 active:bg-surface-2"
        >
          {ex ? <ExercisePhoto ex={ex} className="w-16 shrink-0 rounded-xl" /> : <ActivityIcon id={w.refId} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{w.name}</p>
            <p className="truncate text-xs text-muted tabular">{detail}</p>
          </div>
          <span className="font-display font-semibold tabular text-jamun">
            <span className="text-muted">~</span>
            {w.kcal}
          </span>
        </button>
      </motion.div>
    </div>
  );
}
