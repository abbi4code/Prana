"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

const COLORS = ["var(--color-turmeric)", "var(--color-saffron)", "var(--color-chilli)", "var(--color-leaf)", "var(--color-sky)"];

/** Particle burst from the centre of its (relative) parent. Re-fires whenever `trigger` changes (0 = never). */
export function Burst({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  return (
    <span key={trigger} aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
        const r = 44 + (i % 3) * 16;
        return (
          <motion.span
            key={i}
            className="absolute size-2 rounded-full"
            style={{ background: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, scale: [0.4, 1.2, 0.6], opacity: [1, 1, 0] }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </span>
  );
}

/**
 * Counts how often `value` rises past `goal` while the component is mounted.
 * `scope` (e.g. the selected day) resets the comparison, so switching days never fires it.
 */
export function useGoalHits(value: number, goal: number, scope: string, onHit?: () => void) {
  const prev = useRef<{ v: number; scope: string } | null>(null);
  const [hits, setHits] = useState(0);
  const cb = useRef(onHit);
  useEffect(() => {
    cb.current = onHit;
  });
  useEffect(() => {
    const p = prev.current;
    prev.current = { v: value, scope };
    if (p && p.scope === scope && goal > 0 && p.v < goal && value >= goal) {
      const t = setTimeout(() => {
        setHits((h) => h + 1);
        cb.current?.();
        navigator.vibrate?.([10, 40, 10]);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [value, goal, scope]);
  return hits;
}
