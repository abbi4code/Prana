"use client";

import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FoodIcon } from "@/components/FoodIcon";
import { fmtQty } from "@/lib/nutrition";
import { resolveItems } from "@/lib/thali";
import type { ThaliItem } from "@/lib/types";

/**
 * A steel thali with the meal's items placed around the rim (and in the middle when there's just one).
 * Items drop in with a spring; quantity badges show anything other than 1.
 */
export function ThaliPlate({ items, size = 240, badges = true }: { items: ThaliItem[]; size?: number; badges?: boolean }) {
  const uid = useId();
  const resolved = resolveItems(items);
  const shown = resolved.slice(0, 8);
  const extra = resolved.length - shown.length;
  const icon = Math.round(size * (shown.length === 1 ? 0.42 : shown.length > 5 ? 0.25 : 0.3));
  const ring = size * (shown.length > 5 ? 0.31 : 0.27);

  const pos = (i: number) => {
    if (shown.length === 1) return { x: 0, y: 0 };
    const a = -Math.PI / 2 - Math.PI / 5 + (i / shown.length) * Math.PI * 2;
    return { x: Math.cos(a) * ring, y: Math.sin(a) * ring };
  };

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id={`steel${uid}`} cx="0.38" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#f4f6f8" />
            <stop offset="0.55" stopColor="#c7cdd3" />
            <stop offset="1" stopColor="#8b949c" />
          </radialGradient>
          <radialGradient id={`well${uid}`} cx="0.42" cy="0.36" r="0.8">
            <stop offset="0" stopColor="#e9edf0" />
            <stop offset="1" stopColor="#aeb6bd" />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy="53" rx="47" ry="45" fill="#000" opacity="0.25" />
        <circle cx="50" cy="50" r="47" fill={`url(#steel${uid})`} />
        <circle cx="50" cy="50" r="40" fill={`url(#well${uid})`} />
        <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.6" />
        <path d="M18,32 A37,37 0 0 1 40,14" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>

      <AnimatePresence>
        {shown.map(({ item, food }, i) => {
          const { x, y } = pos(i);
          return (
            <motion.div
              key={`${item.foodId}-${i}`}
              layout
              className="absolute"
              style={{ left: size / 2 - icon / 2, top: size / 2 - icon / 2 }}
              initial={{ x, y: y - 40, opacity: 0, scale: 0.4 }}
              animate={{ x, y, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              <FoodIcon cat={food.cat} size={icon} bare />
              {badges && item.qty !== 1 && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-cream px-1.5 text-[11px] font-bold leading-5 text-bg shadow">
                  {fmtQty(item.qty)}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {extra > 0 && (
        <span className="absolute bottom-[8%] right-[8%] rounded-full bg-cream px-2 text-xs font-bold leading-6 text-bg">+{extra}</span>
      )}
    </div>
  );
}
