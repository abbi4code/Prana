"use client";

import { motion } from "motion/react";

const DIGITS = "0123456789".split("");
const spring = { type: "spring", stiffness: 140, damping: 20, mass: 0.8 } as const;

/**
 * Odometer-style number: each digit is a 0–9 strip that rolls to its value.
 * Digits are keyed from the right, so 999 → 1,000 adds a column instead of re-rolling every digit.
 */
export function RollingNumber({ value, className = "" }: { value: number; className?: string }) {
  const text = Math.round(value).toLocaleString("en-IN");
  const chars = text.split("");
  return (
    <span className={`inline-flex tabular leading-none ${className}`} aria-label={text} role="img">
      {chars.map((ch, i) => {
        const key = chars.length - i;
        return /\d/.test(ch) ? <Digit key={key} d={Number(ch)} /> : <span key={`s${key}`} aria-hidden>{ch}</span>;
      })}
    </span>
  );
}

function Digit({ d }: { d: number }) {
  return (
    <span className="relative inline-block h-[1.1em] overflow-hidden" aria-hidden>
      {/* invisible sizer keeps the column exactly one digit wide */}
      <span className="invisible">0</span>
      <motion.span className="absolute inset-x-0 top-0 flex flex-col" initial={false} animate={{ y: `${-d * 1.1}em` }} transition={spring}>
        {DIGITS.map((n) => (
          <span key={n} className="flex h-[1.1em] items-center justify-center">{n}</span>
        ))}
      </motion.span>
    </span>
  );
}
