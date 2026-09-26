"use client";

import { useId } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { failText, type AdminFail } from "@/lib/admin/api";
import { addDays, parseDay } from "@/lib/dates";

// Building blocks for the admin panel (D51), in the app's own language: cards, spice tokens, display numbers.

export type Tone = "turmeric" | "saffron" | "chilli" | "leaf" | "sky" | "jamun" | "brass" | "muted";
// literal class names so Tailwind sees them
export const TONE: Record<Tone, { text: string; bg: string; soft: string; from: string }> = {
  turmeric: { text: "text-turmeric", bg: "bg-turmeric", soft: "bg-turmeric/12", from: "from-turmeric/25" },
  saffron: { text: "text-saffron", bg: "bg-saffron", soft: "bg-saffron/12", from: "from-saffron/25" },
  chilli: { text: "text-chilli", bg: "bg-chilli", soft: "bg-chilli/12", from: "from-chilli/25" },
  leaf: { text: "text-leaf", bg: "bg-leaf", soft: "bg-leaf/12", from: "from-leaf/25" },
  sky: { text: "text-sky", bg: "bg-sky", soft: "bg-sky/12", from: "from-sky/25" },
  jamun: { text: "text-jamun", bg: "bg-jamun", soft: "bg-jamun/12", from: "from-jamun/25" },
  brass: { text: "text-brass", bg: "bg-brass", soft: "bg-brass/12", from: "from-brass/25" },
  muted: { text: "text-muted", bg: "bg-muted", soft: "bg-surface-2", from: "from-surface-3" },
};

// ── formatting ──
export const nf = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? "–" : n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
export const shortDay = (k: string) => parseDay(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const longDay = (k: string) => parseDay(k).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "never";
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} d ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return `${Math.floor(d / 365)} y ago`;
}
export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
/** Every day from..to (inclusive), filled from a sparse list. */
export function fillDays<T extends { day: string }>(from: string, to: string, rows: T[], empty: (day: string) => T): T[] {
  const by = new Map(rows.map((r) => [r.day, r]));
  const out: T[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(by.get(d) ?? empty(d));
  return out;
}

/** SVG gradient ids must be unique per chart and safe inside url(#…). */
export const useSvgId = (prefix: string) => `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

/** Recharts axis props shared by every chart. */
export const AXIS = { tick: { fontSize: 11 }, axisLine: false, tickLine: false } as const;

// ── layout ──
export function Panel({ title, icon, hint, right, className = "", children }: {
  title: string; icon?: React.ReactNode; hint?: string; right?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`card flex min-w-0 flex-col p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">{icon}{title}</p>
          {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4 flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

export function Stat({ label, value, unit, sub, tone = "turmeric", delta, icon, delay = 0 }: {
  label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode; tone?: Tone;
  /** now vs the previous period of the same length */
  delta?: { now: number; prev: number; invert?: boolean }; icon?: React.ReactNode; delay?: number;
}) {
  const change = delta && delta.prev > 0 ? Math.round(((delta.now - delta.prev) / delta.prev) * 100) : delta && delta.now > 0 ? null : undefined;
  const good = delta && (delta.invert ? delta.now <= delta.prev : delta.now >= delta.prev);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 26 }}
      className={`card relative min-w-0 overflow-hidden bg-gradient-to-br ${TONE[tone].from} to-transparent p-4 lg:p-5`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
        {icon && <span className={TONE[tone].text}>{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold leading-none tabular lg:text-[2.1rem]">
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-semibold text-muted">{unit}</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {change !== undefined && (
          <span className={`rounded-full px-1.5 py-0.5 font-bold tabular ${change === null ? "bg-leaf/15 text-leaf" : good ? "bg-leaf/15 text-leaf" : "bg-chilli/15 text-chilli"}`}>
            {change === null ? "new" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}%`}
          </span>
        )}
        {sub}
      </div>
    </motion.div>
  );
}

/** Pill switch (the app's cream pill that slides between options). */
export function Segmented<T extends string | number>({ value, options, onChange, id, size = "sm" }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; id: string; size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex shrink-0 rounded-full border border-line-strong bg-surface-2 p-0.5 text-xs font-semibold">
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`relative rounded-full ${size === "md" ? "px-3.5 py-1.5" : "px-2.5 py-1"} transition-colors ${value === o.v ? "text-bg" : "text-muted hover:text-text"}`}
        >
          {value === o.v && <motion.span layoutId={id} className="absolute inset-0 rounded-full bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative whitespace-nowrap">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Ranked list with a bar behind each row (top foods, exercises, reasons…). */
export function BarList({ items, tone = "turmeric", empty = "Nothing yet", max: scale }: {
  items: { key: string; label: React.ReactNode; value: number; display?: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; href?: string }[];
  tone?: Tone; empty?: string;
  /** shared scale when one list is split into columns */
  max?: number;
}) {
  if (!items.length) return empty ? <Empty text={empty} /> : null;
  const max = Math.max(scale ?? 0, ...items.map((i) => i.value), 1);
  return (
    <ol className="space-y-1.5">
      {items.map((it, i) => {
        const row = (
          <>
            <motion.span
              aria-hidden
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, (it.value / max) * 100)}%` }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 120, damping: 22 }}
              className={`absolute inset-y-0 left-0 rounded-xl ${TONE[tone].soft}`}
            />
            <span className="relative flex min-w-0 flex-1 items-center gap-2.5">
              {it.icon}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{it.label}</span>
                {it.sub && <span className="block truncate text-[11px] text-muted">{it.sub}</span>}
              </span>
            </span>
            <span className="relative shrink-0 font-display text-base font-semibold tabular">{it.display ?? nf(it.value)}</span>
          </>
        );
        return (
          <li key={it.key}>
            {it.href ? (
              <Link href={it.href} className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2 transition-colors hover:bg-surface-2">{row}</Link>
            ) : (
              <div className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2">{row}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** One bar split into parts with a legend (on / under / over, verified / not…). */
export function SplitBar({ parts, unit = "" }: { parts: { label: string; value: number; tone: Tone }[]; unit?: string }) {
  const total = parts.reduce((t, p) => t + p.value, 0);
  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-surface-3">
        {total > 0 &&
          parts.map((p, i) =>
            p.value > 0 ? (
              <motion.span
                key={p.label}
                initial={{ width: 0 }}
                animate={{ width: `${(p.value / total) * 100}%` }}
                transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 110, damping: 20 }}
                className={`${TONE[p.tone].bg} h-full first:rounded-l-full last:rounded-r-full`}
                title={`${p.label}: ${p.value}`}
              />
            ) : null,
          )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-muted">
            <span className={`size-2.5 rounded-full ${TONE[p.tone].bg}`} />
            {p.label}
            <span className="font-semibold text-text tabular">{nf(p.value)}{unit}</span>
            {total > 0 && <span className="text-faint tabular">{pct(p.value, total)}%</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Progress ring (retention, verified share). */
export function Ring({ value, tone, size = 92, children }: { value: number | null; tone: Tone; size?: number; children?: React.ReactNode }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" style={{ stroke: "rgb(var(--ink) / 0.08)" }} />
        <motion.circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.15 }}
          style={{ stroke: `var(--color-${tone === "muted" ? "muted" : tone})` }}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

export function ChartTip({ active, payload, label, unit = "", labelFmt = shortDay }: {
  active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string; payload?: Record<string, unknown> }[];
  label?: string | number; unit?: string; labelFmt?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-xl">
      {label != null && <p className="mb-1 text-muted">{typeof label === "string" && /^\d{4}-\d\d-\d\d$/.test(label) ? labelFmt(label) : label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="flex items-center gap-1.5 font-semibold">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto pl-3 tabular">{nf(p.value ?? 0, 1)}{unit}</span>
        </p>
      ))}
    </div>
  );
}

export function Empty({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center">
      <div>
        {icon && <div className="mx-auto mb-2 w-fit text-faint">{icon}</div>}
        <p className="text-sm text-muted">{text}</p>
      </div>
    </div>
  );
}

export function ErrorState({ reason, onRetry }: { reason: AdminFail; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-chilli/12 text-chilli"><AlertTriangle size={22} /></span>
      <p className="max-w-sm text-sm text-muted">{failText(reason)}</p>
      {onRetry && reason !== "forbidden" && reason !== "not_found" && (
        <button onClick={onRetry} className="flex h-9 items-center gap-1.5 rounded-full bg-cream px-4 text-xs font-bold text-bg">
          <RefreshCw size={13} /> Try again
        </button>
      )}
    </div>
  );
}

export function PanelSkeleton({ tiles = 4, panels = 4 }: { tiles?: number; panels?: number }) {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: tiles }, (_, i) => <div key={i} className="skeleton h-28" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {Array.from({ length: panels }, (_, i) => <div key={i} className="skeleton h-72" />)}
      </div>
    </div>
  );
}

/** "Open" affordance for a row that links somewhere. */
export const Chevron = () => <ChevronRight size={16} className="shrink-0 text-faint" />;

/** Avatar from a Google photo URL, else the first letter. */
export function UserAvatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- Google avatar, remote host not worth configuring for next/image
    <img src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full ring-2 ring-line-strong" style={{ width: size, height: size }} />
  ) : (
    <span style={{ width: size, height: size, fontSize: size * 0.42 }} className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brass/40 to-surface-3 font-display font-semibold">
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
