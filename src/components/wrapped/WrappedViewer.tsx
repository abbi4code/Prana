"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { firstName } from "@/components/today/Greeting";
import { useAuth } from "@/lib/auth";
import { useWrapped } from "@/lib/useWrapped";
import { weekLabel } from "@/lib/wrapped";
import { buildCards } from "./WrappedCards";

/** Time per card before it moves on by itself (not on the last card, and never with reduced motion). */
const CARD_MS = 6500;
const SWIPE_PX = 50;
const TAP_MS = 350;
/** desktop arrows sit just outside the 9:16 frame (frame height = min(90dvh, 880px)) */
const ARROW_OFFSET = "calc(50% - min(45dvh, 440px) * 9 / 16 - 4.5rem)";

/**
 * Weekly Wrapped as stories (engagement.md). Phone: full screen. Desktop: a 9:16 frame with arrows.
 * Tap right = next, tap left third = back, swipe, hold to pause; ← → Esc on a keyboard.
 */
export function WrappedViewer({ week, onClose }: { week: string; onClose: () => void }) {
  const { wrap } = useWrapped();
  const name = useAuth((s) => firstName(s.user));
  const w = useMemo(() => wrap(week), [wrap, week]);
  const cards = useMemo(() => buildCards(w, name), [w, name]);
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const last = index === cards.length - 1;
  const playing = !reduce && !held && !hidden && !last;

  const go = (d: number) => {
    const next = index + d;
    if (next < 0) return;
    if (next >= cards.length) return onClose();
    setDir(d);
    setIndex(next);
  };
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });

  // keyboard, tab visibility, background scroll, focus (returned to the opener on close)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goRef.current(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goRef.current(-1); }
    };
    const onVis = () => setHidden(document.visibilityState !== "visible");
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return; // buttons on a card (Share) are just buttons
    down.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    setHeld(true);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    setHeld(false);
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - d.y)) return go(dx < 0 ? 1 : -1);
    if (performance.now() - d.t > TAP_MS) return; // a hold was a pause, not a tap
    const rect = e.currentTarget.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width * 0.3 ? -1 : 1);
  };

  const card = cards[index];

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[52] flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Weekly Wrapped, ${weekLabel(w.from)}`}
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg outline-none lg:aspect-[9/16] lg:h-[min(90dvh,880px)] lg:w-auto lg:rounded-[2rem] lg:border lg:border-line-strong lg:shadow-2xl lg:shadow-black/60"
      >
        {/* spice glow behind the card, colour per card */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full blur-3xl"
          animate={{ backgroundColor: card.glow, opacity: 0.22 }}
          transition={{ duration: 0.6 }}
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 size-[22rem] rounded-full bg-jamun opacity-[0.12] blur-3xl" />

        {/* progress: one bar per card */}
        <div className="relative z-10 flex gap-1.5 px-4 pt-[calc(0.9rem+var(--safe-top))]">
          {cards.map((c, i) => (
            <div key={c.id} className="h-1 flex-1 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.18)]">
              <div
                key={i === index ? `run-${index}` : c.id}
                className="h-full origin-left rounded-full bg-text"
                style={
                  i < index
                    ? { transform: "scaleX(1)" }
                    : i === index && !last && !reduce
                      ? { animation: `wrapped-fill ${CARD_MS}ms linear forwards`, animationPlayState: playing ? "running" : "paused" }
                      : { transform: i === index ? "scaleX(1)" : "scaleX(0)" }
                }
                onAnimationEnd={() => i === index && go(1)}
              />
            </div>
          ))}
        </div>
        <div className="relative z-10 flex items-center justify-between px-4 pt-3">
          <p className="text-xs font-semibold text-muted">{weekLabel(w.from)}</p>
          <button onClick={onClose} aria-label="Close Wrapped" className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text">
            <X size={20} />
          </button>
        </div>

        <div
          className="relative z-10 min-h-0 flex-1 touch-pan-y select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { down.current = null; setHeld(false); }}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={card.id}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute inset-0 overflow-y-auto px-7 pb-[calc(1.75rem+var(--safe-bottom))] pt-4 no-scrollbar"
              aria-live="polite"
            >
              {card.body}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* desktop arrows beside the frame */}
      <button
        onClick={() => go(-1)}
        disabled={index === 0}
        aria-label="Previous card"
        style={{ left: ARROW_OFFSET }}
        className="absolute top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-surface text-text disabled:opacity-30 lg:grid"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={() => go(1)}
        aria-label={last ? "Close" : "Next card"}
        style={{ right: ARROW_OFFSET }}
        className="absolute top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-surface text-text lg:grid"
      >
        <ChevronRight size={22} />
      </button>
    </motion.div>,
    document.body,
  );
}
