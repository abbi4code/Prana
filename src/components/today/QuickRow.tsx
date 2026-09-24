"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Coffee, GlassWater, Minus, Plus } from "lucide-react";
import { useStore } from "@/lib/store";

const CHAI_ID = "hot-tea";
const WATER_GOAL = 8;

/** One-tap chai counter + water tracker. */
export function QuickRow({ date }: { date: string }) {
  const entries = useStore((s) => s.entries);
  const chai = useMemo(() => entries.filter((e) => e.date === date && e.foodId === CHAI_ID), [entries, date]);
  const water = useStore((s) => s.water[date] ?? 0);
  const addEntry = useStore((s) => s.addEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const addWater = useStore((s) => s.addWater);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card p-4">
        <div className="flex items-center gap-2 text-muted">
          <Coffee size={16} className="text-brass" />
          <span className="text-xs font-bold uppercase tracking-wider">Chai</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <motion.span key={chai.length} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-4xl font-semibold leading-none">
            {chai.length}
          </motion.span>
          <div className="flex gap-1.5">
            {chai.length > 0 && (
              <Round onClick={() => removeEntry(chai.at(-1)!.id)} label="Remove a chai"><Minus size={16} /></Round>
            )}
            <Round primary onClick={() => { addEntry(CHAI_ID, "cup", 1, "snacks", date); navigator.vibrate?.(10); }} label="Add a chai">
              <Plus size={18} />
            </Round>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{chai.length === 1 ? "cup" : "cups"} · {chai.reduce((t, e) => t + e.kcal, 0)} kcal</p>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 text-muted">
          <GlassWater size={16} className="text-sky-300" />
          <span className="text-xs font-bold uppercase tracking-wider">Water</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-display text-4xl font-semibold leading-none">
            {water}
            <span className="text-lg text-faint">/{WATER_GOAL}</span>
          </span>
          <div className="flex gap-1.5">
            {water > 0 && <Round onClick={() => addWater(date, -1)} label="Remove a glass"><Minus size={16} /></Round>}
            <Round primary onClick={() => { addWater(date, 1); navigator.vibrate?.(10); }} label="Add a glass">
              <Plus size={18} />
            </Round>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {Array.from({ length: WATER_GOAL }, (_, i) => (
            <motion.span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              animate={{ backgroundColor: i < water ? "#7dd3fc" : "rgb(255 236 214 / 0.1)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Round({ children, onClick, label, primary }: { children: React.ReactNode; onClick: () => void; label: string; primary?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      aria-label={label}
      className={`grid size-9 place-items-center rounded-full ${primary ? "bg-cream text-bg" : "border border-line-strong text-muted"}`}
    >
      {children}
    </motion.button>
  );
}
