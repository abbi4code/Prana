"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Building2, X } from "lucide-react";
import { snoozeNearby } from "@/lib/gym/nearby";
import { useUI } from "@/lib/store";
import { useActiveVisit } from "./GymCard";

/**
 * "Looks like you're at Gold's Gym. Start workout?" (D30 phase 4). Shown when the on-phone nearby check finds
 * you inside your gym's radius. One tap opens the Workout tab and runs the normal check-in (server-verified).
 */
export function NearbyBanner() {
  const nearby = useUI((s) => s.nearby);
  const active = useActiveVisit();
  const path = usePathname();
  const show = !!nearby && !active && path !== "/login" && !path.startsWith("/auth/");

  const start = () => {
    if (!nearby) return;
    snoozeNearby(nearby.gymId);
    useUI.setState({ navTo: "/workout", autoCheckIn: true });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+var(--safe-top))] z-[45] flex justify-center px-4 lg:left-64 lg:justify-end lg:px-8">
      <AnimatePresence>
        {show && nearby && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-3xl border border-jamun/40 bg-surface/95 p-3 pr-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            <span aria-hidden className="pointer-events-none absolute -left-8 -top-10 size-32 rounded-full bg-jamun opacity-25 blur-2xl" />
            <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-jamun to-chilli text-white">
              <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                <Building2 size={20} />
              </motion.span>
            </span>
            <div className="relative min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-jamun">Looks like you&apos;re at</p>
              <p className="truncate text-[15px] font-bold leading-tight">{nearby.name}</p>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={start} className="relative h-10 shrink-0 rounded-2xl bg-cream px-3.5 text-sm font-bold text-bg">
              Check in
            </motion.button>
            <button onClick={() => snoozeNearby(nearby.gymId)} aria-label="Not now" className="relative grid size-9 shrink-0 place-items-center rounded-full text-faint hover:text-text">
              <X size={17} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
