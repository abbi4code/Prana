"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Trophy } from "lucide-react";
import { Burst } from "@/components/Burst";
import { Medal } from "@/components/achievements/Medal";
import { TIER_NAME } from "@/lib/badges";
import { useCelebrations, type Celebration } from "@/lib/celebrate";
import { addDays, dayKey } from "@/lib/dates";
import { computeRecords, formatGain, formatPr, type PrHit } from "@/lib/records";
import { useStore, useUI } from "@/lib/store";
import { useBadges } from "@/lib/useBadges";
import { refInfo } from "@/lib/useRecords";

/**
 * Celebration banners (D36 PRs, D38 badges). One at a time at the top, so they never cover the bottom toast's Undo.
 * - PRs: a store watcher, so every way of logging (sheet, routine, "Add anything", voice) celebrates the same way.
 *   Only fresh logs count: not sync pulls, not reloads, and never the same log twice (undo → restore).
 * - Badges: compared with the ones already announced on this device (localStorage). The first run, and anything
 *   earned before yesterday (history pulled onto a new phone), is marked seen silently.
 * Tapping a banner opens Achievements.
 */
export function PrCelebration() {
  const queue = useCelebrations((s) => s.queue);
  const next = useCelebrations((s) => s.next);
  const head = queue[0];

  useEffect(() => {
    const seen = new Set<string>();
    return useStore.subscribe((s, prev) => {
      if (s.workouts === prev.workouts || !s.hydrated || !prev.hydrated) return;
      const before = new Set(prev.workouts.map((w) => w.id));
      const now = Date.now();
      const fresh = s.workouts.filter((w) => !before.has(w.id) && !seen.has(w.id) && now - w.createdAt < 20_000);
      if (!fresh.length) return;
      fresh.forEach((w) => seen.add(w.id));
      const rec = computeRecords(s.workouts, refInfo);
      const hits = fresh.flatMap((w) => rec.hitsByWorkout.get(w.id) ?? []);
      if (!hits.length) return;
      // after the logging toast has appeared, so the two don't land in the same frame
      setTimeout(() => {
        useCelebrations.getState().push({ kind: "pr", hits });
        navigator.vibrate?.([15, 60, 15, 60, 40]);
      }, 350);
    });
  }, []);

  useEffect(() => {
    if (!head) return;
    const t = setTimeout(next, 5200);
    return () => clearTimeout(t);
  }, [head, next]);

  const open = () => {
    const tab = head?.kind === "pr" ? "#records" : "";
    next();
    useUI.setState({ navTo: `/akhada?tab=awards${tab}` });
  };

  return (
    <>
      <BadgeWatcher />
      <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+var(--safe-top))] z-[56] flex justify-center px-4 lg:left-64">
        <AnimatePresence mode="wait">
          {head && (
            <motion.button
              key={head.id}
              onClick={open}
              aria-live="polite"
              initial={{ y: -110, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -80, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              className={`pointer-events-auto relative w-full max-w-sm rounded-[1.6rem] p-[1.5px] text-left shadow-2xl shadow-black/50 ${
                head.kind === "pr" ? "bg-gradient-to-br from-turmeric via-saffron to-chilli" : "bg-gradient-to-br from-jamun via-saffron to-turmeric"
              }`}
            >
              <Burst trigger={head.id} />
              <span className="relative flex items-center gap-3 overflow-hidden rounded-[1.5rem] bg-surface px-4 py-3">
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-turmeric/20 to-transparent"
                  initial={{ x: "-150%" }}
                  animate={{ x: "400%" }}
                  transition={{ duration: 1.3, delay: 0.35, ease: "easeInOut" }}
                />
                {head.kind === "pr" ? <PrBody hits={head.hits} /> : <BadgeBody c={head} />}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

function PrBody({ hits }: { hits: PrHit[] }) {
  // one line per exercise: its most meaningful record (hits arrive in PR_ORDER, so the first one wins)
  const byWorkout = new Map<string, PrHit>();
  for (const h of hits) if (!byWorkout.has(h.workoutId)) byWorkout.set(h.workoutId, h);
  const heads = [...byWorkout.values()];
  return (
    <>
      <motion.span
        initial={{ scale: 0.4, rotate: -30 }}
        animate={{ scale: [0.4, 1.2, 1], rotate: [-30, 12, -6, 0] }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-turmeric to-saffron text-on-accent shadow-[0_10px_28px_-8px_var(--color-saffron)]"
      >
        <Trophy size={24} strokeWidth={2.3} />
      </motion.span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-saffron">
          {heads.length > 1 ? `${heads.length} new personal records` : "New personal record"}
        </span>
        {heads.slice(0, 3).map((h) => (
          <span key={h.workoutId} className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold">{h.name}</span>
            <span className="shrink-0 font-display text-sm font-semibold tabular">{formatPr(h.kind, h)}</span>
            <span className="shrink-0 text-[11px] font-bold text-leaf tabular">{formatGain(h)}</span>
          </span>
        ))}
        {heads.length > 3 && <span className="block text-[11px] text-muted">+{heads.length - 3} more</span>}
      </span>
    </>
  );
}

function BadgeBody({ c }: { c: Extract<Celebration, { kind: "badge" }> }) {
  const top = c.unlocks[0];
  return (
    <>
      <motion.span initial={{ scale: 0.3, rotate: -40 }} animate={{ scale: [0.3, 1.15, 1], rotate: [-40, 10, 0] }} transition={{ duration: 0.8, delay: 0.1 }} className="relative">
        <Medal tier={top.tier ?? "special"} emoji={top.emoji} size={52} shine />
      </motion.span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-jamun">
          {c.unlocks.length > 1 ? `${c.unlocks.length} badges unlocked` : "Badge unlocked"}
        </span>
        {c.unlocks.slice(0, 3).map((u) => (
          <span key={u.id} className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold">{u.name}</span>
            <span className="shrink-0 text-[11px] font-bold text-muted">{u.tier == null ? "" : TIER_NAME[u.tier]}</span>
          </span>
        ))}
      </span>
    </>
  );
}

const SEEN = "prana-badges-seen";
const readSeen = (): Set<string> | null => {
  try {
    const v = localStorage.getItem(SEEN);
    return v ? new Set(JSON.parse(v) as string[]) : null;
  } catch {
    return null;
  }
};
const writeSeen = (ids: Iterable<string>) => {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...ids]));
  } catch {}
};

/** Announces badges earned since they were last seen on this device. */
function BadgeWatcher() {
  const hydrated = useStore((s) => s.hydrated);
  const { unlocks } = useBadges();
  useEffect(() => {
    if (!hydrated) return;
    // let rehydration, the first sync and a PR banner settle first
    const t = setTimeout(() => {
      const seen = readSeen();
      if (!seen) return writeSeen(unlocks.map((u) => u.id)); // first run: everything so far is old news
      const fresh = unlocks.filter((u) => !seen.has(u.id));
      if (!fresh.length) return;
      writeSeen([...seen, ...fresh.map((u) => u.id)]);
      const recent = fresh.filter((u) => u.date >= addDays(dayKey(), -1));
      if (recent.length) useCelebrations.getState().push({ kind: "badge", unlocks: recent });
    }, 900);
    return () => clearTimeout(t);
  }, [hydrated, unlocks]);
  return null;
}
