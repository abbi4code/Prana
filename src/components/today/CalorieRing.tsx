"use client";

import { motion } from "motion/react";
import { CountUp } from "@/components/CountUp";

export function CalorieRing({ eaten, goal }: { eaten: number; goal: number }) {
  const size = 232, stroke = 18, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = goal ? Math.min(eaten / goal, 1) : 0;
  const over = eaten > goal;
  const left = Math.abs(goal - eaten);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={over ? "#ff5a6e" : "#f6c343"} />
            <stop offset="1" stopColor={over ? "#ff8a3d" : "#ff8a3d"} />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {/* tick marks, like a brass dial */}
        {Array.from({ length: 60 }, (_, i) => (
          <line
            key={i}
            x1={size / 2}
            y1={2}
            x2={size / 2}
            y2={i % 5 ? 5 : 8}
            stroke="rgb(255 236 214 / 0.14)"
            strokeWidth={1.5}
            transform={`rotate(${i * 6} ${size / 2} ${size / 2})`}
          />
        ))}
        <circle cx={size / 2} cy={size / 2} r={r - 6} fill="none" stroke="rgb(255 236 214 / 0.06)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r - 6} fill="none" stroke="url(#ring)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }} filter="url(#glow)" opacity={0.55}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r - 6} fill="none" stroke="url(#ring)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={left} className={`font-display text-[3.6rem] font-semibold leading-none tracking-tight ${over ? "text-chilli" : ""}`} />
        <p className="mt-1.5 text-sm font-medium text-muted">{over ? "kcal over" : "kcal left"}</p>
      </div>
    </div>
  );
}
