"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronsUpDown, Flame, Info, Minus, Plus, Trash } from "lucide-react";
import { RollingNumber } from "@/components/RollingNumber";
import { FoodIcon, categoryHue } from "@/components/FoodIcon";
import { getUnit } from "@/lib/foods";
import { MEALS, fmtQty, portion, qtyOptions } from "@/lib/nutrition";
import type { Food, Meal } from "@/lib/types";
import { PortionVisual } from "./PortionVisual";

type Props = {
  food: Food;
  initial: { unitId: string; qty: number; meal: Meal };
  confirmLabel: (meal: string) => string;
  onConfirm: (v: { unitId: string; qty: number; meal: Meal }) => void;
  onBack?: () => void;
  onDelete?: () => void;
};

export function FoodDetail({ food, initial, confirmLabel, onConfirm, onBack, onDelete }: Props) {
  const [unitId, setUnitId] = useState(initial.unitId);
  const [qty, setQty] = useState(initial.qty);
  const [meal, setMeal] = useState(initial.meal);

  const unit = getUnit(food, unitId);
  const opts = qtyOptions(unit.kind);
  const n = portion(food, unit, qty);
  const hue = categoryHue(food.cat);

  const pickUnit = (id: string) => {
    const u = getUnit(food, id);
    setUnitId(id);
    setQty(u.kind === "g" ? Math.round(n.grams / 10) * 10 || 100 : 1);
  };
  const step = (dir: 1 | -1) => setQty((q) => Math.max(opts.min, Math.round((q + dir * opts.step) * 100) / 100));

  // drag the portion art up/down to change the amount: one step per 22 px, a light tick each step
  const pan = useRef(0);
  const onPan = (_: unknown, info: { delta: { y: number } }) => {
    pan.current -= info.delta.y;
    while (Math.abs(pan.current) >= 22) {
      const dir = pan.current > 0 ? 1 : -1;
      pan.current -= dir * 22;
      step(dir);
      navigator.vibrate?.(4);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex items-center gap-3 pt-1">
          {onBack && (
            <button onClick={onBack} aria-label="Back" className="-ml-2 grid size-10 place-items-center rounded-full text-muted active:bg-surface-2">
              <ChevronLeft size={24} />
            </button>
          )}
          <motion.div layoutId={`food-icon-${food.id}`} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
            <FoodIcon cat={food.cat} size={40} />
          </motion.div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-semibold leading-tight">{food.name}</h2>
            {food.hi && <p className="text-sm text-muted">{food.hi}</p>}
          </div>
        </div>

        {(food.fried || food.conf === "low") && (
          <div className="mt-4 flex gap-2.5 rounded-2xl border border-saffron/25 bg-saffron/10 p-3 text-[13px] leading-snug text-cream/90">
            {food.fried ? <Flame size={17} className="mt-0.5 shrink-0 text-saffron" /> : <Info size={17} className="mt-0.5 shrink-0 text-saffron" />}
            <p>
              {food.fried
                ? "High estimate: the source counts all the frying oil, not just what the food absorbs. Real value is likely lower."
                : food.note ?? "Low-confidence value."}
            </p>
          </div>
        )}

        <motion.div
          data-vaul-no-drag
          onPan={onPan}
          onPanStart={() => (pan.current = 0)}
          whileTap={{ scale: 0.98 }}
          className="group relative mx-auto mt-2 h-44 w-64 cursor-ns-resize touch-none select-none"
          title="Drag up or down to change the amount"
        >
          <PortionVisual kind={unit.kind} qty={qty} grams={n.grams} hue={hue} />
          <span className="pointer-events-none absolute -right-6 top-1/2 flex -translate-y-1/2 flex-col items-center text-faint opacity-60 transition-opacity group-hover:opacity-100">
            <ChevronsUpDown size={18} />
          </span>
        </motion.div>

        <div className="text-center">
          <div className="font-display text-6xl font-semibold leading-none tracking-tight">
            {food.fried && <span className="text-4xl text-muted">~</span>}
            <RollingNumber value={n.kcal} />
          </div>
          <p className="mt-1 text-sm text-muted">
            kcal · {n.grams} g
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Macro label="Protein" value={n.p} color="var(--color-chilli)" />
          <Macro label="Carbs" value={n.c} color="var(--color-turmeric)" />
          <Macro label="Fat" value={n.f} color="var(--color-saffron)" />
        </div>

        <Label>Measure</Label>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {food.units.map((u) => (
            <Chip key={u.id} active={u.id === unitId} onClick={() => pickUnit(u.id)}>
              {u.kind === "g" ? "Grams" : cap(u.label.replace(/^1 /, ""))}
            </Chip>
          ))}
        </div>

        <Label>How much</Label>
        <div className="flex items-center gap-3">
          <StepButton onClick={() => step(-1)} aria-label="Less"><Minus size={20} /></StepButton>
          <div className="flex-1 text-center">
            {unit.kind === "g" ? (
              <input
                type="number"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(Math.max(0, Number(e.target.value)))}
                className="w-full bg-transparent text-center font-display text-4xl font-semibold outline-none"
              />
            ) : (
              <span className="font-display text-4xl font-semibold">{fmtQty(qty)}</span>
            )}
            <p className="text-xs text-muted">{unit.kind === "g" ? "grams" : unit.label.replace(/^1 /, "")}</p>
          </div>
          <StepButton onClick={() => step(1)} aria-label="More"><Plus size={20} /></StepButton>
        </div>
        <div className="mt-3 flex justify-center gap-2">
          {opts.picks.map((p) => (
            <Chip key={p} active={qty === p} onClick={() => setQty(p)} small>
              {unit.kind === "g" ? `${p} g` : fmtQty(p)}
            </Chip>
          ))}
        </div>

        <Label>Meal</Label>
        <div className="grid grid-cols-2 gap-2">
          {MEALS.map((m) => (
            <Chip key={m.id} active={meal === m.id} onClick={() => setMeal(m.id)}>
              {m.label}
            </Chip>
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] text-faint">
          {food.kcal} kcal / 100 g · source {SOURCE_LABEL[food.src] ?? food.src}
        </p>
      </div>

      <div className="flex gap-2 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        {onDelete && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onDelete}
            aria-label="Delete"
            className="grid size-14 place-items-center rounded-2xl bg-chilli/15 text-chilli"
          >
            <Trash size={20} />
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!qty}
          onClick={() => onConfirm({ unitId, qty, meal })}
          className="h-14 flex-1 rounded-2xl bg-gradient-to-r from-turmeric to-saffron text-base font-bold text-on-accent disabled:opacity-40"
        >
          {confirmLabel(MEALS.find((m) => m.id === meal)!.label)}
        </motion.button>
      </div>
    </div>
  );
}

function Macro({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5 text-center">
      <p className="font-display text-lg font-semibold tabular" style={{ color }}>
        {value == null ? "–" : `${Math.round(value)}g`}
      </p>
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  IFCT2017: "IFCT 2017", MFR_LABEL: "pack label", USDA: "USDA FoodData Central", DERIVED: "recipe from IFCT + USDA", USER: "your own food",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{children}</p>
);

function Chip({ active, small, children, onClick }: { active: boolean; small?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border font-semibold transition-colors ${
        small ? "px-4 py-1.5 text-sm" : "px-4 py-2.5 text-sm"
      } ${active ? "border-cream bg-cream text-bg" : "border-line-strong bg-surface-2 text-text"}`}
    >
      {children}
    </motion.button>
  );
}

function StepButton(props: React.ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      className="grid size-14 place-items-center rounded-full border border-line-strong bg-surface-2 text-text"
      {...props}
    />
  );
}
