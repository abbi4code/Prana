"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChartLine, House, Plus, UserRound } from "lucide-react";
import { useUI } from "@/lib/store";
import { mealForNow } from "@/lib/nutrition";

export const NAV_TABS = [
  { href: "/", label: "Today", icon: House },
  { href: "/progress", label: "Progress", icon: ChartLine },
  { href: "/me", label: "Me", icon: UserRound },
] as const;

export function BottomNav() {
  const path = usePathname();
  const openAdd = useUI((s) => s.openAdd);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(0.9rem+var(--safe-bottom))] lg:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center md:max-w-lg justify-between gap-3 px-4">
        <nav className="flex flex-1 items-center gap-1 rounded-full border border-line-strong bg-surface/80 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          {NAV_TABS.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-semibold transition-colors ${
                  active ? "text-bg" : "text-muted"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-cream"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon size={17} strokeWidth={2.2} className="relative" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => openAdd(mealForNow())}
          aria-label="Log food"
          className="grid size-[3.6rem] shrink-0 place-items-center rounded-full bg-gradient-to-br from-turmeric to-saffron text-on-accent shadow-[0_10px_30px_-6px_rgb(255_138_61/0.6)]"
        >
          <Plus size={28} strokeWidth={2.6} />
        </motion.button>
      </div>
    </div>
  );
}
