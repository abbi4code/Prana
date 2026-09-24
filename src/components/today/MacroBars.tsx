"use client";

import { motion } from "motion/react";
import type { Goals } from "@/lib/types";

const MACROS = [
  { key: "p", label: "Protein", color: "var(--color-chilli)" },
  { key: "c", label: "Carbs", color: "var(--color-turmeric)" },
  { key: "f", label: "Fat", color: "var(--color-saffron)" },
] as const;

export function MacroBars({ totals, goals }: { totals: { p: number; c: number; f: number }; goals: Goals }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {MACROS.map(({ key, label, color }) => {
        const v = Math.round(totals[key]);
        const g = goals[key];
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color, boxShadow: `0 0 12px ${color}` }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((v / g) * 100, 100)}%` }}
                transition={{ type: "spring", stiffness: 70, damping: 18 }}
              />
            </div>
            <p className="mt-1.5 text-sm tabular">
              <span className="font-bold">{v}</span>
              <span className="text-muted"> / {g}g</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
