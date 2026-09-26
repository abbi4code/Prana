"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gift, Sparkles, X } from "lucide-react";
import { dayKey } from "@/lib/dates";
import { useWrapped } from "@/lib/useWrapped";
import { bannerWeek, weekLabel } from "@/lib/wrapped";
import { WrappedViewer } from "./WrappedViewer";

// Ways into Weekly Wrapped (engagement.md): a banner on Today when a week has just been wrapped, and a card on
// Progress with every wrapped week. "Seen" is a per-device convenience (localStorage), nothing is synced.

const SEEN_KEY = "prana-wrapped-seen";
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
const markSeen = (week: string) => {
  try {
    localStorage.setItem(SEEN_KEY, week);
  } catch {}
};

/** Today: "Your week, wrapped" from Sunday 6 pm until Tuesday, until opened or dismissed. */
export function WrappedBanner() {
  const { weeks, wrap } = useWrapped();
  const [week, setWeek] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // the clock and localStorage are read after mount (render stays pure; SSR markup matches)
  useEffect(() => {
    const t = setTimeout(() => setWeek(bannerWeek(dayKey(), new Date().getHours(), readSeen())), 0);
    return () => clearTimeout(t);
  }, []);

  const show = week && weeks.includes(week) ? week : null;
  const w = show ? wrap(show) : null;
  const dismiss = () => {
    if (show) markSeen(show);
    setWeek(null);
  };

  return (
    <>
      <AnimatePresence initial={false}>
        {w && (
          <motion.section
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="card relative mb-4 flex items-center gap-3 overflow-hidden p-4 lg:mb-6">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-saffron opacity-25 blur-3xl" />
              <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-turmeric to-saffron text-on-accent">
                <Gift size={22} />
              </span>
              <button onClick={() => { markSeen(w.from); setOpen(w.from); }} className="relative min-w-0 flex-1 text-left">
                <p className="font-display text-[17px] font-semibold leading-tight">Your week, wrapped</p>
                <p className="line-clamp-2 text-sm leading-snug text-muted">
                  {w.persona.emoji} {w.persona.title} · {weekLabel(w.from)}
                </p>
              </button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { markSeen(w.from); setOpen(w.from); }}
                className="relative h-10 shrink-0 rounded-xl bg-gradient-to-r from-turmeric to-saffron px-4 text-sm font-bold text-on-accent"
              >
                Open
              </motion.button>
              <button onClick={dismiss} aria-label="Not now" className="relative grid size-8 shrink-0 place-items-center rounded-full text-faint hover:text-text">
                <X size={16} />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence>{open && <WrappedViewer week={open} onClose={() => { setOpen(null); setWeek(null); }} />}</AnimatePresence>
    </>
  );
}

/** Progress: the latest wrapped week, plus earlier ones. */
export function WrappedCard() {
  const { weeks, wrap } = useWrapped();
  const [open, setOpen] = useState<string | null>(null);
  if (!weeks.length) return null;
  const [latest, ...older] = weeks;
  const w = wrap(latest);

  return (
    <section className="card relative overflow-hidden p-5">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-saffron opacity-[0.16] blur-3xl" />
      <div className="relative flex items-center gap-2">
        <Sparkles size={16} className="text-turmeric" />
        <h2 className="font-display text-lg font-semibold">Weekly Wrapped</h2>
      </div>
      <button
        onClick={() => setOpen(latest)}
        className="relative mt-3 flex w-full items-center gap-4 rounded-2xl bg-surface-2 p-4 text-left transition-colors hover:bg-surface-3"
      >
        <span className="text-4xl" aria-hidden>{w.persona.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted">{weekLabel(latest)}</span>
          <span className="block font-display text-2xl font-semibold leading-tight">{w.persona.title}</span>
          <span className="block truncate text-sm text-muted">
            {w.food.onTarget}/7 on target{w.training?.workoutDays ? ` · ${w.training.workoutDays} workout days` : ""}{w.prs.length ? ` · ${w.prs.length} PR${w.prs.length === 1 ? "" : "s"}` : ""}
          </span>
        </span>
        <span className="h-10 shrink-0 rounded-xl bg-gradient-to-r from-turmeric to-saffron px-4 py-2.5 text-sm font-bold text-on-accent">Open</span>
      </button>
      {older.length > 0 && (
        <div className="relative mt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Earlier weeks</p>
          <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
            {older.map((wk) => (
              <button
                key={wk}
                onClick={() => setOpen(wk)}
                className="shrink-0 rounded-full border border-line-strong px-3.5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                {weekLabel(wk)}
              </button>
            ))}
          </div>
        </div>
      )}
      <AnimatePresence>{open && <WrappedViewer week={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </section>
  );
}
