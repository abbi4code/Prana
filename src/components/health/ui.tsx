"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, ExternalLink } from "lucide-react";
import { SOURCES, type SourceId } from "@/lib/health/sources";

// Shared bits of the Health tab (D55): card header, source note, risk rows. Numbers always carry their source.

import type { Tone } from "@/lib/health/tone";
export type { Tone };
export const TEXT: Record<Tone, string> = {
  leaf: "text-leaf", turmeric: "text-turmeric", saffron: "text-saffron", chilli: "text-chilli", sky: "text-sky", jamun: "text-jamun", brass: "text-brass", muted: "text-muted",
};
export const BG: Record<Tone, string> = {
  leaf: "bg-leaf/15", turmeric: "bg-turmeric/15", saffron: "bg-saffron/15", chilli: "bg-chilli/15", sky: "bg-sky/15", jamun: "bg-jamun/15", brass: "bg-brass/15", muted: "bg-surface-3",
};
export const FILL: Record<Tone, string> = {
  leaf: "var(--color-leaf)", turmeric: "var(--color-turmeric)", saffron: "var(--color-saffron)", chilli: "var(--color-chilli)", sky: "var(--color-sky)", jamun: "var(--color-jamun)", brass: "var(--color-brass)", muted: "var(--color-muted)",
};

export function CardHead({ icon, label, right, sub }: { icon: React.ReactNode; label: string; right?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">{icon} {label}</p>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** "Source" chip that opens the citation, who was studied and whether Indians were included. */
export function SourceNote({ ids, note, className = "" }: { ids: SourceId[]; note?: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const list = [...new Set(ids)].map((id) => SOURCES[id]);
  return (
    <div className={className}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex max-w-full items-center gap-1.5 rounded-full py-1 text-left text-[11px] font-semibold text-faint hover:text-muted">
        <BookOpen size={12} className="shrink-0" />
        <span className="min-w-0 truncate">{list.length > 2 ? `${list[0].cite} + ${list.length - 1} more studies` : list.map((s) => s.cite).join(" · ")}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-1 space-y-2 rounded-2xl bg-surface-2 p-3.5 text-xs leading-relaxed text-muted">
              {note && <p>{note}</p>}
              {list.map((s) => (
                <div key={s.full}>
                  <p className="text-text/80">{s.full}</p>
                  <p className="mt-0.5">
                    {s.who}
                    {s.india === "yes" ? " · Indian data" : s.india === "partly" ? " · includes Indian / South Asian data" : " · no Indian data"}
                  </p>
                  <a href={s.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-semibold text-turmeric">
                    Read the study <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A relative risk as people read it: "+48 %" below 3×, "7.7×" above (a "+670 %" is hard to picture). */
export function riskText(rr: number) {
  if (rr >= 3) return `${rr >= 10 ? Math.round(rr) : rr.toFixed(1)}×`;
  const pct = Math.round((rr - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}
export const timesText = (rr: number) => `${rr >= 10 ? Math.round(rr) : rr.toFixed(rr >= 3 ? 1 : 2)}×`;

export function riskTone(rr: number): Tone {
  return rr < 1.25 ? "turmeric" : rr < 2 ? "saffron" : "chilli";
}

/** One disease: name, the rise vs a non-smoker, the published range, a bar on a log scale (1× → 30×). */
export function RiskRow({ name, rr, lo, hi, measure, capped, sub, onClick, active, vs = "a non-smoker's" }: {
  name: string; rr: number; lo?: number; hi?: number; measure?: "risk" | "odds" | "death rate"; capped?: boolean; sub?: string;
  onClick?: () => void; active?: boolean;
  /** who it's compared with */
  vs?: string;
}) {
  // a published range that includes 1× means no clear difference: say so instead of a +/− that reads as real
  const unclear = lo != null && hi != null && lo <= 1 && hi >= 1;
  const tone: Tone = unclear ? "muted" : riskTone(rr);
  const w = unclear ? 2 : Math.max(4, Math.min(100, (Math.log(rr) / Math.log(30)) * 100));
  const what = measure === "death rate" ? "death rate" : measure === "odds" ? "odds" : "risk";
  return (
    <button onClick={onClick} className={`block w-full rounded-2xl px-3 py-2.5 text-left transition-colors ${active ? "bg-surface-2" : "hover:bg-surface-2/60"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
        <span className={`shrink-0 font-semibold tabular ${unclear ? "text-xs" : "font-display text-lg"} ${TEXT[tone]}`}>
          {unclear ? "no clear change" : `${capped ? "≥ " : ""}${riskText(rr)}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <motion.div className="h-full rounded-full" style={{ background: FILL[tone] }} initial={false} animate={{ width: `${w}%` }} transition={{ type: "spring", stiffness: 260, damping: 30 }} />
      </div>
      <p className="mt-1 truncate text-[11px] text-muted tabular">
        {timesText(rr)} {vs} {what}
        {lo && hi ? ` · range ${lo.toFixed(2)}–${hi.toFixed(2)}` : ""}
        {sub ? ` · ${sub}` : ""}
      </p>
    </button>
  );
}

/** Empty / "needs" state inside a card. */
export function Needs({ items, children }: { items: { label: string; action?: React.ReactNode }[]; children?: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-4">
      {children && <p className="text-sm text-muted">{children}</p>}
      <ul className="mt-2 space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{i.label}</span>
            {i.action}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const pill = "inline-flex h-8 items-center gap-1.5 rounded-full bg-cream px-3 text-xs font-bold text-bg";
export const ghostPill = "inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-muted hover:text-text";
