"use client";

import { useId } from "react";
import { motion } from "motion/react";
import type { UnitKind } from "@/lib/types";

const spring = { type: "spring", stiffness: 180, damping: 20 } as const;

/** Illustrated portion: a brass katori that fills (and heaps past 1), a glass, or a stack of pieces. */
export function PortionVisual({ kind, qty, grams, hue }: { kind: UnitKind; qty: number; grams: number; hue: string }) {
  if (kind === "glass" || kind === "cup") return <Glass level={Math.min(qty, 1)} extra={qty} hue={hue} />;
  if (kind === "piece" || kind === "pack") return <Pieces qty={qty} hue={hue} />;
  // grams/spoons have no natural vessel; show them as a katori level (a katori ≈ 150 g)
  const level = kind === "katori" || kind === "bowl" || kind === "plate" ? qty : grams / 150;
  return <Katori level={level} hue={hue} />;
}

function Katori({ level, hue }: { level: number; hue: string }) {
  const uid = useId(); // several katoris can be on one page; SVG ids must be unique
  const id = (n: string) => `${n}${uid}`;
  const fill = Math.max(0.08, Math.min(level, 1));
  const heap = Math.max(0, Math.min(level - 1, 1.5)); // heaped above the rim
  const depth = 1 - fill;
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id("brass")} x1="0" x2="1">
          <stop offset="0" stopColor="#7a4f1f" />
          <stop offset="0.28" stopColor="#e9c27a" />
          <stop offset="0.5" stopColor="#b98535" />
          <stop offset="0.78" stopColor="#f6d796" />
          <stop offset="1" stopColor="#6b431a" />
        </linearGradient>
        <radialGradient id={id("food")} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor={hue} stopOpacity="1" />
          <stop offset="1" stopColor={hue} stopOpacity="0.55" />
        </radialGradient>
        <clipPath id={id("mouth")}>
          <ellipse cx="110" cy="56" rx="88" ry="15" />
        </clipPath>
      </defs>

      <ellipse cx="110" cy="138" rx="70" ry="8" fill="black" opacity="0.45" />
      {/* inside of the bowl */}
      <ellipse cx="110" cy="56" rx="88" ry="15" fill="#2a1a0c" />
      <g clipPath={`url(#${id("mouth")})`}>
        <motion.ellipse
          cx="110"
          fill={`url(#${id("food")})`}
          initial={false}
          animate={{ cy: 56 + depth * 22, rx: 88 - depth * 26, ry: 15 - depth * 4 }}
          transition={spring}
        />
      </g>
      {/* heap above the rim */}
      <motion.path
        d="M22,56 Q110,-40 198,56 Q110,72 22,56 Z"
        fill={`url(#${id("food")})`}
        style={{ transformBox: "fill-box", originY: 0.85 }}
        initial={false}
        // a visible mound from ½ extra katori up to a full heap at 2½
        animate={{ scaleY: heap > 0 ? 0.35 + 0.65 * (heap / 1.5) : 0 }}
        transition={spring}
      />
      {/* outer wall */}
      <path d="M22,56 C24,108 62,132 110,132 C158,132 196,108 198,56 C170,72 50,72 22,56 Z" fill={`url(#${id("brass")})`} />
      <path d="M40,78 C60,112 92,122 110,122" stroke="#fff5d6" strokeOpacity="0.35" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="110" cy="56" rx="88" ry="15" fill="none" stroke={`url(#${id("brass")})`} strokeWidth="5" />
    </svg>
  );
}

function Glass({ level, extra, hue }: { level: number; extra: number; hue: string }) {
  const uid = useId();
  const id = (n: string) => `${n}${uid}`;
  const top = 20, bottom = 136;
  const y = bottom - (bottom - top) * Math.max(0.06, level);
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <clipPath id={id("glass")}>
          <path d="M70,20 L150,20 L140,136 L80,136 Z" />
        </clipPath>
        <linearGradient id={id("drink")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hue} stopOpacity="0.95" />
          <stop offset="1" stopColor={hue} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="140" rx="46" ry="6" fill="black" opacity="0.45" />
      <g clipPath={`url(#${id("glass")})`}>
        <rect x="60" y="0" width="100" height="150" style={{ fill: "rgb(var(--ink) / 0.05)" }} />
        <motion.rect x="60" width="100" height="150" fill={`url(#${id("drink")})`} initial={false} animate={{ y }} transition={spring} />
      </g>
      <path d="M70,20 L150,20 L140,136 L80,136 Z" fill="none" style={{ stroke: "rgb(var(--ink) / 0.55)" }} strokeWidth="3" strokeLinejoin="round" />
      <path d="M82,34 L88,120" stroke="white" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
      {extra > 1 && (
        <text x="176" y="40" style={{ fill: "var(--color-text)" }} fontSize="22" fontWeight="700">×{extra}</text>
      )}
    </svg>
  );
}

function Pieces({ qty, hue }: { qty: number; hue: string }) {
  const n = Math.min(Math.ceil(qty), 8);
  const partial = qty % 1;
  const base = 96 + (n - 1) * 5.5; // keep the stack vertically centred
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full overflow-visible" aria-hidden>
      <ellipse cx="110" cy={base + 16} rx="80" ry="8" fill="black" opacity="0.45" />
      {Array.from({ length: n }, (_, i) => {
        const isPartial = i === n - 1 && partial > 0;
        return (
          <motion.g
            key={i}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...spring, delay: i * 0.03 }}
          >
            <ellipse
              cx="110"
              cy={base - i * 11}
              rx="72"
              ry="20"
              fill={hue}
              fillOpacity={isPartial ? 0.35 : 0.9 - i * 0.04}
              style={{ stroke: "var(--color-bg)" }}
              strokeOpacity="0.5"
              strokeWidth="2"
              strokeDasharray={isPartial ? "6 6" : undefined}
            />
          </motion.g>
        );
      })}
    </svg>
  );
}
