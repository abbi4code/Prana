"use client";

import { useId } from "react";
import { motion } from "motion/react";

// Badge medal (Achievements): a hexagon in the tier's metal, the badge emoji in the middle.
// Locked: dim, with your progress traced around the edge in jamun.

/** Metal per tier: bronze, silver, gold (turmeric → saffron), diamond (sky → jamun). "special" = one-off badges. */
const METAL: Record<string, [string, string]> = {
  "0": ["var(--color-bronze)", "color-mix(in oklab, var(--color-bronze) 55%, black)"],
  "1": ["var(--color-silver)", "color-mix(in oklab, var(--color-silver) 50%, black)"],
  "2": ["var(--color-turmeric)", "var(--color-saffron)"],
  "3": ["var(--color-sky)", "var(--color-jamun)"],
  special: ["var(--color-saffron)", "var(--color-chilli)"],
};
export const TIER_TEXT = ["text-bronze", "text-silver", "text-turmeric", "text-sky"] as const;
export const TIER_BG = ["bg-bronze", "bg-silver", "bg-turmeric", "bg-gradient-to-r from-sky to-jamun"] as const;

const hex = (r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
const OUTER = hex(43);
const INNER = hex(33);
const RING = `M ${hex(47).split(" ").join(" L ")} Z`;

export function Medal({ tier, emoji, size = 72, progress = 0, shine = false, className = "" }: {
  /** 0–3 = bronze…diamond, "special" = one-off badge, null = locked */
  tier: number | "special" | null;
  emoji: string;
  size?: number;
  /** locked only: 0–1, traced around the edge */
  progress?: number;
  /** sweep a highlight across once (just unlocked, detail view) */
  shine?: boolean;
  className?: string;
}) {
  const id = useId();
  const locked = tier === null;
  const [a, b] = locked ? ["var(--color-surface-3)", "var(--color-surface-2)"] : METAL[String(tier)];
  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      {!locked && (
        <span aria-hidden className="absolute inset-[12%] rounded-full opacity-45 blur-xl" style={{ background: a }} />
      )}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: a }} />
            <stop offset="100%" style={{ stopColor: b }} />
          </linearGradient>
          <clipPath id={`${id}-c`}>
            <polygon points={OUTER} />
          </clipPath>
        </defs>
        {/* metal rim: a thick rounded stroke gives the hexagon soft corners */}
        <polygon points={OUTER} strokeWidth="7" strokeLinejoin="round" style={{ fill: `url(#${id}-m)`, stroke: `url(#${id}-m)` }} />
        <polygon points={INNER} strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--color-surface)", stroke: "rgb(255 255 255 / 0.28)", opacity: locked ? 0.9 : 0.92 }} />
        {!locked && <polygon points={hex(40)} fill="none" strokeWidth="1" style={{ stroke: "rgb(255 255 255 / 0.35)" }} />}
        {locked && progress > 0 && (
          <motion.path
            d={RING}
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: "var(--color-jamun)" }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: Math.min(1, progress) }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}
        {shine && !locked && (
          <g clipPath={`url(#${id}-c)`}>
            <motion.rect
              y="-20" width="26" height="140" rx="4" fill="white" opacity="0.35" transform="rotate(20 50 50)"
              initial={{ x: -60 }} animate={{ x: 140 }} transition={{ duration: 1.1, delay: 0.25, ease: "easeInOut" }}
            />
          </g>
        )}
      </svg>
      <span className={`relative leading-none ${locked ? "opacity-35 grayscale" : ""}`} style={{ fontSize: size * 0.36 }}>
        {emoji}
      </span>
    </span>
  );
}
