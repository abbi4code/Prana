"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChartLine, Dumbbell, House, Plus, Swords, UserRound } from "lucide-react";
import { useUI } from "@/lib/store";
import { mealForNow } from "@/lib/nutrition";

/** `short` is the phone label (only the active tab shows it, and five must fit beside the + button). */
export const NAV_TABS = [
  { href: "/", label: "Today", short: "Today", icon: House },
  { href: "/workout", label: "Workout", short: "Workout", icon: Dumbbell },
  { href: "/progress", label: "Progress", short: "Progress", icon: ChartLine },
  { href: "/akhada", label: "Akhada", short: "Akhada", icon: Swords },
  { href: "/me", label: "Me", short: "Me", icon: UserRound },
] as const;

/** A tab is active on its page and its sub-pages (/akhada/c/…), except Today ("/") which matches only itself. */
export const isActive = (path: string, href: string) => path === href || (href !== "/" && path.startsWith(`${href}/`));

export function BottomNav() {
  const path = usePathname();
  const openAdd = useUI((s) => s.openAdd);
  const openGym = useUI((s) => s.openGym);
  // on the Workout tab the + logs exercise; everywhere else it logs food
  const gym = path === "/workout";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[calc(0.9rem+var(--safe-bottom))] lg:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center md:max-w-lg justify-between gap-3 px-4">
        <nav className="flex flex-1 items-center gap-1 rounded-full border border-line-strong bg-surface/80 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          {NAV_TABS.map(({ href, label, short, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={`relative flex items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-semibold transition-[color,flex-grow] duration-300 md:flex-1 ${
                  active ? "flex-[1.9] text-bg" : "flex-1 text-muted"
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
                {/* five tabs + the round button don't fit with labels on a phone: only the active tab shows its name */}
                <span className={`relative ${active ? "" : "hidden md:inline"}`}>{short}</span>
              </Link>
            );
          })}
        </nav>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => (gym ? openGym("strength") : openAdd(mealForNow()))}
          aria-label={gym ? "Log exercise" : "Log food"}
          className={`grid size-[3.6rem] shrink-0 place-items-center rounded-full bg-gradient-to-br transition-shadow ${
            gym
              ? "from-jamun to-chilli text-white shadow-[0_10px_30px_-6px_var(--color-jamun)]"
              : "from-turmeric to-saffron text-on-accent shadow-[0_10px_30px_-6px_rgb(255_138_61/0.6)]"
          }`}
        >
          <Plus size={28} strokeWidth={2.6} />
        </motion.button>
      </div>
    </div>
  );
}
