"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Minus, Plus, Search, Trash, X } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { RollingNumber } from "@/components/RollingNumber";
import { getFood, getUnit, searchFoods } from "@/lib/foods";
import { MEALS, fmtQty, qtyOptions } from "@/lib/nutrition";
import { useStore } from "@/lib/store";
import { newThaliId, resolveItems, thaliTotals } from "@/lib/thali";
import type { Meal, ThaliItem } from "@/lib/types";
import { ThaliPlate } from "./ThaliPlate";

type Props = {
  thaliId?: string;
  prefill?: ThaliItem[];
  slot: Meal;
  onBack: () => void;
  onSaved: (name: string) => void;
};

/** Build or edit a saved meal on an illustrated thali. */
export function ThaliBuilder({ thaliId, prefill, slot, onBack, onSaved }: Props) {
  const existing = useStore((s) => s.savedMeals.find((m) => m.id === thaliId));
  const saveMeal = useStore((s) => s.saveMeal);
  const deleteSavedMeal = useStore((s) => s.deleteSavedMeal);

  const [name, setName] = useState(existing?.name ?? "");
  const [meal, setMeal] = useState<Meal>(existing?.meal ?? slot);
  const [items, setItems] = useState<ThaliItem[]>(existing?.items ?? prefill ?? []);
  const [query, setQuery] = useState<string | null>(items.length ? null : "");

  const totals = thaliTotals(items);
  const rows = resolveItems(items);
  const results = useMemo(() => (query ? searchFoods(query, 12) : []), [query]);

  const update = (i: number, patch: Partial<ThaliItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addFood = (foodId: string) => {
    const food = getFood(foodId)!;
    setItems((xs) => [...xs, { foodId, unitId: food.du, qty: 1 }]);
    setQuery(null);
    navigator.vibrate?.(8);
  };

  const valid = name.trim().length > 0 && items.length > 0;
  const save = () => {
    if (!valid) return;
    saveMeal({ id: existing?.id ?? newThaliId(), name: name.trim(), meal, items, createdAt: existing?.createdAt ?? Date.now() });
    onSaved(name.trim());
  };

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex items-center gap-2 pt-1">
          <button onClick={onBack} aria-label="Back" className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="font-display text-xl font-semibold leading-tight">{existing ? "Edit thali" : "New thali"}</h2>
            <p className="text-sm text-muted">A meal you eat often, logged in one tap</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-5">
          <ThaliPlate items={items} size={168} />
          <div className="min-w-0">
            <p className="font-display text-4xl font-semibold leading-none">
              <RollingNumber value={totals.kcal} />
            </p>
            <p className="mt-1 text-sm text-muted">kcal</p>
            <p className="mt-3 text-xs leading-relaxed text-muted tabular">
              <span className="text-chilli">P {Math.round(totals.p)}g</span> · <span className="text-turmeric">C {Math.round(totals.c)}g</span> ·{" "}
              <span className="text-saffron">F {Math.round(totals.f)}g</span>
            </p>
          </div>
        </div>

        <label className="mt-5 block rounded-2xl border border-line-strong bg-surface-2 px-3 py-2 focus-within:border-turmeric/60">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-faint">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Office lunch, Sunday breakfast…"
            className="w-full bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-faint"
          />
        </label>

        <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Usually for</p>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {MEALS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMeal(m.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${meal === m.id ? "bg-cream text-bg" : "bg-surface-2 text-muted"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="mb-1 mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">On the thali</p>
        <ul>
          <AnimatePresence initial={false}>
            {rows.map(({ item, food, unit, n }, i) => {
              const opts = qtyOptions(unit.kind);
              return (
                <motion.li
                  key={`${item.foodId}-${i}`}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 py-2">
                    <FoodIcon cat={food.cat} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{food.name}</p>
                      <select
                        value={unit.id}
                        onChange={(e) => {
                          const u = getUnit(food, e.target.value);
                          update(i, { unitId: u.id, qty: u.kind === "g" ? 100 : 1 });
                        }}
                        className="max-w-full truncate bg-transparent text-xs text-muted outline-none"
                      >
                        {food.units.map((u) => (
                          <option key={u.id} value={u.id}>{u.kind === "g" ? "grams" : u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Step onClick={() => update(i, { qty: Math.max(opts.min, Math.round((item.qty - opts.step) * 100) / 100) })} label="Less"><Minus size={14} /></Step>
                      <span className="w-9 text-center text-sm font-bold tabular">{unit.kind === "g" ? `${item.qty}g` : fmtQty(item.qty)}</span>
                      <Step onClick={() => update(i, { qty: Math.round((item.qty + opts.step) * 100) / 100 })} label="More"><Plus size={14} /></Step>
                    </div>
                    <span className="w-10 text-right font-display text-sm font-semibold tabular">{n.kcal}</span>
                    <button onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove ${food.name}`} className="grid size-8 place-items-center rounded-full text-faint hover:text-chilli">
                      <X size={15} />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        {query === null ? (
          <button
            onClick={() => setQuery("")}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-3 py-3 text-sm font-semibold text-muted transition-colors hover:border-turmeric/50 hover:text-text"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-surface-2 text-turmeric"><Plus size={17} /></span>
            Add food to the thali
          </button>
        ) : (
          <div className="mt-2 rounded-2xl border border-line-strong bg-bg/40 p-2">
            <label className="flex items-center gap-2 px-2 py-1.5">
              <Search size={16} className="text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="roti, dal, rice…"
                className="w-full bg-transparent outline-none placeholder:text-faint"
              />
              {items.length > 0 && (
                <button onClick={() => setQuery(null)} aria-label="Close search" className="text-muted"><X size={16} /></button>
              )}
            </label>
            <ul>
              {results.map((f) => (
                <li key={f.id}>
                  <button onClick={() => addFood(f.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2">
                    <FoodIcon cat={f.cat} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.name}</span>
                    <Plus size={16} className="text-turmeric" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        {existing && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              deleteSavedMeal(existing.id);
              onBack();
            }}
            aria-label="Delete thali"
            className="grid size-14 place-items-center rounded-2xl bg-chilli/15 text-chilli"
          >
            <Trash size={20} />
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!valid}
          onClick={save}
          className="h-14 flex-1 rounded-2xl bg-gradient-to-r from-turmeric to-saffron text-base font-bold text-on-accent disabled:opacity-40"
        >
          {existing ? "Save changes" : "Save thali"}
        </motion.button>
      </div>
    </div>
  );
}

function Step({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={onClick} aria-label={label} className="grid size-7 place-items-center rounded-full border border-line-strong text-muted hover:text-text">
      {children}
    </motion.button>
  );
}
