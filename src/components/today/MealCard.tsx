"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { BookmarkPlus, Copy, Plus, Trash, Zap } from "lucide-react";
import { ThaliPlate } from "@/components/thali/ThaliPlate";
import { mealKcal } from "@/lib/thali";
import { FoodIcon } from "@/components/FoodIcon";
import { getFood } from "@/lib/foods";
import { fmtQty } from "@/lib/nutrition";
import { useStore, useUI } from "@/lib/store";
import type { Entry, Meal } from "@/lib/types";

export function MealCard({ meal, label, entries, yesterday, date, prevDate }: {
  meal: Meal;
  label: string;
  entries: Entry[];
  yesterday: Entry[];
  date: string;
  prevDate: string;
}) {
  const openAdd = useUI((s) => s.openAdd);
  const copyMeal = useStore((s) => s.copyMeal);
  const removeEntry = useStore((s) => s.removeEntry);
  const restoreEntry = useStore((s) => s.restoreEntry);
  const showToast = useUI((s) => s.showToast);
  const openThali = useUI((s) => s.openThali);
  const allSaved = useStore((s) => s.savedMeals);
  const logSavedMeal = useStore((s) => s.logSavedMeal);
  const saved = allSaved.filter((m) => m.meal === meal);
  const kcal = entries.reduce((t, e) => t + e.kcal, 0);

  const logThali = (id: string, name: string) => {
    const ids = logSavedMeal(id, meal, date);
    ids.forEach((x) => useUI.getState().markFresh(x));
    navigator.vibrate?.(12);
    showToast(`Logged ${name}`, { label: "Undo", run: () => ids.forEach((x) => removeEntry(x)) });
  };

  const remove = (e: Entry) => {
    removeEntry(e.id);
    navigator.vibrate?.(15);
    showToast(`Removed ${e.name}`, { label: "Undo", run: () => restoreEntry(e) });
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <h3 className="font-display text-lg font-semibold">{label}</h3>
          <p className="text-xs text-muted tabular">{entries.length ? `${kcal.toLocaleString("en-IN")} kcal` : "Nothing yet"}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {entries.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => openThali({ slot: meal, prefill: entries.map((e) => ({ foodId: e.foodId, unitId: e.unitId, qty: e.qty })) })}
              aria-label={`Save ${label} as a thali`}
              title="Save as a thali"
              className="grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-turmeric"
            >
              <BookmarkPlus size={18} />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => openAdd(meal)}
            aria-label={`Add to ${label}`}
            className="grid size-10 place-items-center rounded-full border border-line-strong bg-surface-2 text-text transition-colors hover:border-turmeric/50 hover:text-turmeric"
          >
            <Plus size={20} />
          </motion.button>
        </div>
      </header>

      <ul className="px-2 pb-2">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
            >
              <EntryRow entry={e} onDelete={() => remove(e)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {!entries.length && saved.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {saved.map((m) => (
            <motion.button
              key={m.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => logThali(m.id, m.name)}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-line-strong bg-surface-2 py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-turmeric/50"
            >
              <ThaliPlate items={m.items} size={34} badges={false} />
              <span>
                <span className="flex items-center gap-1 text-[13px] font-semibold"><Zap size={12} className="text-turmeric" />{m.name}</span>
                <span className="block text-[11px] text-muted tabular">{mealKcal(m)} kcal</span>
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {!entries.length && yesterday.length > 0 && (
        <button
          onClick={() => copyMeal(prevDate, date, meal)}
          className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 py-2.5 text-left text-[13px] text-muted hover:bg-surface-2 active:bg-surface-2"
        >
          <Copy size={15} className="shrink-0 text-turmeric" />
          <span className="truncate">Same as yesterday: {yesterday.map((e) => e.name).join(", ")}</span>
        </button>
      )}
    </section>
  );
}

const DELETE_AT = -88; // px of left swipe that deletes

/** Tap to edit; swipe left to delete (with undo). New items glow once. */
function EntryRow({ entry: e, onDelete }: { entry: Entry; onDelete: () => void }) {
  const openEdit = useUI((s) => s.openEdit);
  const fresh = useUI((s) => s.fresh.includes(e.id));
  const clearFresh = useUI((s) => s.clearFresh);
  const food = getFood(e.foodId);
  const x = useMotionValue(0);
  const binOpacity = useTransform(x, [-10, DELETE_AT], [0, 1]);
  const binScale = useTransform(x, [-10, DELETE_AT, DELETE_AT - 30], [0.6, 1, 1.15]);
  // the row only needs an opaque face while it slides over the red bin
  const faceOpacity = useTransform(x, [0, -6], [0, 1]);
  const dragged = useRef(false);

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
            className="pointer-events-none absolute inset-0 rounded-2xl bg-turmeric/25"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.4, delay: 0.35, ease: "easeOut" }}
            onAnimationComplete={() => clearFresh(e.id)}
          />
        )}
        <button
          onClick={() => !dragged.current && openEdit(e.id)}
          className="relative flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2 active:bg-surface-2"
        >
          {food && <FoodIcon cat={food.cat} size={38} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{e.name}</p>
            <p className="truncate text-xs text-muted">
              {e.unitId === "g" ? `${e.qty} g` : `${fmtQty(e.qty)} × ${e.unitLabel.replace(/^1 /, "")}`}
            </p>
          </div>
          <span className="font-display font-semibold tabular">
            {food?.fried && <span className="text-muted">~</span>}
            {e.kcal}
          </span>
        </button>
      </motion.div>
    </div>
  );
}
