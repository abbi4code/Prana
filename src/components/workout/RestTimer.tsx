"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Timer, X } from "lucide-react";
import { useRest } from "@/lib/restTimer";

// Floating rest countdown (D40): a pill at the top of the screen, above sheets, so it never covers the set rows or the
// Log button. Ends with a vibration, a short beep and "Go · next set", then gets out of the way.

const DONE_MS = 3500;

export function RestTimer() {
  const endsAt = useRest((s) => s.endsAt);
  const total = useRest((s) => s.total);
  const label = useRest((s) => s.label);
  const [now, setNow] = useState(0);
  const fired = useRef<number | null>(null);

  // the saved timer comes back after a reload (store rehydrates on the client only, so server HTML matches)
  useEffect(() => {
    void useRest.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [endsAt]);

  const left = endsAt && now ? endsAt - now : null;
  const over = left != null && left <= 0;

  // once per timer: buzz + beep, then clear after a moment
  useEffect(() => {
    if (!over || !endsAt || fired.current === endsAt) return;
    fired.current = endsAt;
    if (Date.now() - endsAt < 60_000) {
      navigator.vibrate?.([180, 90, 180]);
      beep();
    }
    const t = setTimeout(() => useRest.getState().stop(), Date.now() - endsAt < 60_000 ? DONE_MS : 0);
    return () => clearTimeout(t);
  }, [over, endsAt]);

  // desktop: the tab title counts down too
  useEffect(() => {
    if (left == null || over) return;
    const base = document.title.replace(/^\(\d+:\d\d\) /, "");
    document.title = `(${fmt(left)}) ${base}`;
    return () => {
      document.title = document.title.replace(/^\(\d+:\d\d\) /, "");
    };
  }, [left, over]);

  const pct = left != null && total ? Math.min(1, Math.max(0, left / (total * 1000))) : 0;
  const R = 11, C = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      {endsAt && left != null && (
        <motion.div
          key="rest"
          initial={{ y: -60, opacity: 0, scale: 0.9, x: "-50%" }}
          animate={{ y: 0, opacity: 1, scale: 1, x: "-50%" }}
          exit={{ y: -60, opacity: 0, x: "-50%" }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          role="timer"
          aria-live="polite"
          data-float-ui
          // a modal sheet turns pointer events off outside itself; the timer must stay tappable above it
          aria-label={over ? "Rest over" : `Rest ${fmt(left)} left`}
          className={`pointer-events-auto fixed left-1/2 top-[calc(var(--safe-top)+0.6rem)] z-[80] flex max-w-[calc(100vw-1.5rem)] items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-2 shadow-[0_14px_40px_-12px_rgb(0_0_0/0.6)] backdrop-blur-xl transition-colors ${
            over ? "border-leaf/50 bg-leaf/20" : "border-line-strong bg-surface/90"
          }`}
        >
          <span className={`relative grid size-9 shrink-0 place-items-center rounded-full ${over ? "bg-leaf text-bg" : "bg-jamun/15 text-jamun"}`}>
            {!over && (
              <svg width="28" height="28" className="absolute -rotate-90" aria-hidden>
                <circle cx="14" cy="14" r={R} fill="none" strokeWidth="2.5" style={{ stroke: "rgb(var(--ink) / 0.12)" }} />
                <circle cx="14" cy="14" r={R} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ stroke: "var(--color-jamun)", transition: "stroke-dashoffset 0.25s linear" }} />
              </svg>
            )}
            <Timer size={over ? 17 : 13} strokeWidth={2.5} />
          </span>
          <span className="min-w-0">
            <span className={`block font-display text-lg font-semibold leading-none tabular ${over ? "text-leaf" : ""}`}>{over ? "Go!" : fmt(left)}</span>
            <span className="block max-w-[11rem] truncate text-[11px] text-muted">{over ? "Rest over · next set" : label ?? "Rest"}</span>
          </span>
          {!over && (
            <span className="ml-1 flex items-center gap-1">
              <Pill onClick={() => useRest.getState().add(-15)} label="15 seconds less">−15</Pill>
              <Pill onClick={() => useRest.getState().add(15)} label="15 seconds more">+15</Pill>
            </span>
          )}
          <button onClick={() => useRest.getState().stop()} aria-label={over ? "Dismiss" : "Skip rest"} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Pill({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <motion.button whileTap={{ scale: 0.88 }} onClick={onClick} aria-label={label} className="h-8 rounded-full bg-surface-2 px-2.5 text-xs font-bold tabular text-text hover:bg-surface-3">
      {children}
    </motion.button>
  );
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Two short tones (WebAudio, no sound file). Browsers only allow it after a tap, which ticking the set was. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.22].forEach((at, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = i ? 1046 : 784; // G5 → C6
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.2);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {}
}
