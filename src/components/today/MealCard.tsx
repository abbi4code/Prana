"use client";

import { AnimatePresence, motion } from "motion/react";
import { Copy, Plus } from "lucide-react";
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
  const openEdit = useUI((s) => s.openEdit);
  const copyMeal = useStore((s) => s.copyMeal);
  const kcal = entries.reduce((t, e) => t + e.kcal, 0);

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <h3 className="font-display text-lg font-semibold">{label}</h3>
          <p className="text-xs text-muted tabular">{entries.length ? `${kcal.toLocaleString("en-IN")} kcal` : "Nothing yet"}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => openAdd(meal)}
          aria-label={`Add to ${label}`}
          className="grid size-10 place-items-center rounded-full border border-line-strong bg-surface-2 text-text transition-colors hover:border-turmeric/50 hover:text-turmeric"
        >
          <Plus size={20} />
        </motion.button>
      </header>

      <ul className="px-2 pb-2">
        <AnimatePresence initial={false}>
          {entries.map((e) => {
            const food = getFood(e.foodId);
            return (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <button onClick={() => openEdit(e.id)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2 active:bg-surface-2">
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
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {!entries.length && yesterday.length > 0 && (
        <button
          onClick={() => copyMeal(prevDate, date, meal)}
          className="mx-4 mb-4 flex w-[calc(100%-2rem)] items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 py-2.5 text-left text-[13px] text-muted hover:bg-surface-2 active:bg-surface-2"
        >
          <Copy size={15} className="shrink-0 text-turmeric" />
          <span className="truncate">
            Same as yesterday: {yesterday.map((e) => e.name).join(", ")}
          </span>
        </button>
      )}
    </section>
  );
}
