"use client";

import { useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChevronsLeftRight, ImagePlus, Info, Lock, Plus, Ruler, Trash, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { dayKey, parseDay } from "@/lib/dates";
import { addPhoto, deletePhoto, usePhotos } from "@/lib/photos";
import { useStore } from "@/lib/store";
import type { MeasureSite, Measurement } from "@/lib/types";

// Progress → Body (D39): tape measurements (synced) and progress photos (this device only).

const short = (k: string) => parseDay(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Measuring spots. Waist and hips follow the WHO protocol (Waist circumference and waist–hip ratio, WHO expert
 * consultation 2008); the others are the usual tape spots. Only the waist gets a colour for its trend: smaller is
 * better there (waist-to-height below), while arms, chest, thighs etc. depend on your goal.
 */
const SITES: { id: MeasureSite; label: string; tip: string }[] = [
  { id: "waist", label: "Waist", tip: "Midway between your lowest rib and the top of your hip bone, after a normal breath out." },
  { id: "hips", label: "Hips", tip: "Around the widest part of your buttocks." },
  { id: "chest", label: "Chest", tip: "Across the nipple line, arms relaxed at your sides." },
  { id: "arms", label: "Arms", tip: "Widest part of the upper arm, relaxed." },
  { id: "thighs", label: "Thighs", tip: "Widest part of the thigh, standing." },
  { id: "neck", label: "Neck", tip: "Just below the Adam's apple." },
];
/** Waist-to-height boundary: Ashwell, Gunn & Gibson, Obes Rev 2012 (meta-analysis, 14 countries incl. Asian studies). */
const WHTR_LIMIT = 0.5;

// ── Measurements ──

export function MeasurementsCard() {
  const list = useStore((s) => s.measurements);
  const heightCm = useStore((s) => s.profile?.heightCm ?? null);
  const deleteMeasurement = useStore((s) => s.deleteMeasurement);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(false);

  // per site: its points over time (only days it was measured)
  const series = useMemo(() => {
    const out = new Map<MeasureSite, { date: string; cm: number }[]>();
    for (const m of list) for (const s of SITES) if (m.cm[s.id] != null) out.set(s.id, [...(out.get(s.id) ?? []), { date: m.date, cm: m.cm[s.id]! }]);
    return out;
  }, [list]);
  const tracked = SITES.filter((s) => series.has(s.id));
  const waist = series.get("waist")?.at(-1)?.cm;
  const whtr = waist && heightCm ? Math.round((waist / heightCm) * 100) / 100 : null;
  const last = list.at(-1);

  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <Ruler size={14} className="text-brass" /> Measurements
          </p>
          <p className="mt-1 text-sm text-muted">{last ? `Last measured ${last.date === dayKey() ? "today" : short(last.date)}` : "Waist, arms and more, in cm"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setInfo(!info)} aria-expanded={info} aria-label="About these numbers" className={`grid size-8 place-items-center rounded-full ${info ? "bg-surface-2 text-text" : "text-faint hover:text-muted"}`}>
            <Info size={16} />
          </button>
          <motion.button whileTap={{ scale: 0.94 }} onClick={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-cream px-3.5 text-xs font-bold text-bg">
            <Plus size={14} strokeWidth={2.6} /> {last?.date === dayKey() ? "Edit today" : "Add"}
          </motion.button>
        </div>
      </div>

      {tracked.length ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {tracked.map((s) => (
              <SiteTile key={s.id} label={s.label} points={series.get(s.id)!} colour={s.id === "waist"} />
            ))}
          </div>
          {whtr != null && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
              <span className="text-muted">Waist ÷ height</span>
              <span className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold tabular">{whtr.toFixed(2)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${whtr < WHTR_LIMIT ? "bg-leaf/15 text-leaf" : "bg-saffron/15 text-saffron"}`}>
                  {whtr < WHTR_LIMIT ? `under ${WHTR_LIMIT}` : `${WHTR_LIMIT} or more`}
                </span>
              </span>
            </div>
          )}
          <ul className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
            {[...list].reverse().slice(0, 8).map((m) => (
              <li key={m.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-3 pr-1.5 text-xs">
                <span className="text-muted">{short(m.date)}</span>
                <span className="font-semibold">{Object.keys(m.cm).length} spots</span>
                <button onClick={() => deleteMeasurement(m.id)} aria-label={`Remove measurements from ${short(m.date)}`} className="grid size-5 place-items-center rounded-full text-faint hover:text-chilli">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-4 grid flex-1 place-items-center rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center hover:bg-surface-2/60">
          <span>
            <Ruler size={26} className="mx-auto text-faint" />
            <span className="mt-2 block text-sm text-muted">The tape shows changes the scale can hide. Add your first measurements.</span>
          </span>
        </button>
      )}

      <AnimatePresence initial={false}>
        {info && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="mt-3 rounded-2xl bg-surface-2 p-3.5 text-xs leading-relaxed text-muted">
              Waist and hips are measured the WHO way (2008). Waist ÷ height: a meta-analysis of studies from 14 countries (Ashwell et al. 2012) found it
              flags heart and diabetes risk better than BMI, with {WHTR_LIMIT} as the boundary for men and women. Only the waist trend is coloured: for arms, chest
              or thighs, bigger or smaller depends on your goal. Changes are since your first measurement of that spot. Synced to your account.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <MeasureSheet open={open} onClose={() => setOpen(false)} latest={last} />
    </section>
  );
}

function SiteTile({ label, points, colour }: { label: string; points: { date: string; cm: number }[]; colour: boolean }) {
  const now = points.at(-1)!, first = points[0];
  const d = Math.round((now.cm - first.cm) * 10) / 10;
  const tone = !d ? "text-muted" : !colour ? "text-muted" : d < 0 ? "text-leaf" : "text-saffron";
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-display text-2xl font-semibold leading-none tabular">
          {fmt(now.cm)}
          <span className="text-xs font-medium text-muted"> cm</span>
        </p>
        <Spark points={points.map((p) => p.cm)} colour={colour ? (d <= 0 ? "var(--color-leaf)" : "var(--color-saffron)") : "var(--color-brass)"} />
      </div>
      <p className={`mt-1 truncate text-[11px] font-semibold tabular ${tone}`}>
        {points.length > 1 ? (d ? `${d > 0 ? "↑" : "↓"} ${fmt(Math.abs(d))} cm since ${short(first.date)}` : `same as ${short(first.date)}`) : "first entry"}
      </p>
    </div>
  );
}

/** Tiny trend line (last 8 points). */
function Spark({ points, colour }: { points: number[]; colour: string }) {
  const p = points.slice(-8);
  if (p.length < 2) return null;
  const min = Math.min(...p), max = Math.max(...p), span = max - min || 1;
  const xy = p.map((v, i) => `${(i / (p.length - 1)) * 44 + 2},${18 - ((v - min) / span) * 14}`).join(" ");
  return (
    <svg width="48" height="22" aria-hidden className="shrink-0">
      <polyline points={xy} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: colour }} />
    </svg>
  );
}

function MeasureSheet({ open, onClose, latest }: { open: boolean; onClose: () => void; latest?: Measurement }) {
  return (
    <Sheet open={open} onClose={onClose} size={open ? "narrow" : undefined}>
      {open && <MeasureForm onClose={onClose} latest={latest} />}
    </Sheet>
  );
}

function MeasureForm({ onClose, latest }: { onClose: () => void; latest?: Measurement }) {
  const saveMeasurement = useStore((s) => s.saveMeasurement);
  const today = dayKey();
  const editing = latest?.date === today ? latest : undefined;
  const [vals, setVals] = useState<Partial<Record<MeasureSite, string>>>(() =>
    Object.fromEntries(Object.entries(editing?.cm ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [tip, setTip] = useState<MeasureSite | null>("waist");
  const parsed = Object.fromEntries(
    Object.entries(vals).map(([k, v]) => [k, parseFloat(v ?? "")]).filter(([, v]) => Number.isFinite(v) && (v as number) >= 10 && (v as number) <= 250),
  ) as Partial<Record<MeasureSite, number>>;
  const count = Object.keys(parsed).length;

  const save = () => {
    if (!count) return;
    saveMeasurement({ id: editing?.id ?? `measure-${crypto.randomUUID()}`, date: today, cm: parsed, createdAt: editing?.createdAt ?? Date.now() });
    navigator.vibrate?.(12);
    onClose();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Measurements</Drawer.Title>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Today</p>
        <h2 className="font-display text-2xl font-semibold">Measurements</h2>
        <p className="mt-1 text-sm text-muted">In cm, with a soft tape. Fill only the spots you measure. Same spot, same time of day each time.</p>
        <ul className="mt-4 space-y-2">
          {SITES.map((s) => {
            const prev = latest && !editing ? latest.cm[s.id] : undefined;
            return (
              <li key={s.id} className="rounded-2xl border border-line-strong bg-surface-2/50">
                <label className="flex items-center gap-3 px-4 py-2.5">
                  <button type="button" onClick={() => setTip(tip === s.id ? null : s.id)} className="w-20 shrink-0 text-left text-sm font-semibold">
                    {s.label}
                  </button>
                  <input
                    value={vals[s.id] ?? ""}
                    onChange={(e) => setVals({ ...vals, [s.id]: e.target.value.replace(/[^\d.]/g, "") })}
                    onFocus={() => setTip(s.id)}
                    inputMode="decimal"
                    placeholder={prev ? `last ${fmt(prev)}` : "–"}
                    aria-label={`${s.label} in cm`}
                    className="min-w-0 flex-1 bg-transparent text-right font-display text-xl font-semibold outline-none tabular placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-faint"
                  />
                  <span className="w-6 text-sm text-muted">cm</span>
                </label>
                <AnimatePresence initial={false}>
                  {tip === s.id && (
                    <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 text-xs text-muted">
                      <span className="block pb-3">{s.tip}</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={save}
          disabled={!count}
          className="h-14 w-full rounded-2xl bg-gradient-to-r from-turmeric to-saffron font-bold text-on-accent disabled:opacity-40"
        >
          {count ? `Save ${count} ${count === 1 ? "measurement" : "measurements"}` : "Enter a measurement"}
        </motion.button>
      </div>
    </div>
  );
}

// ── Progress photos (this device only) ──

export function PhotosCard() {
  const photos = usePhotos();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<[string | null, string | null]>([null, null]);

  const list = photos ?? [];
  // compare: the two picked, else first vs latest
  const a = list.find((p) => p.id === pick[0]) ?? list[0];
  const b = list.find((p) => p.id === pick[1]) ?? (list.length > 1 ? list.at(-1) : undefined);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      await addPhoto(f, dayKey());
      setPick([null, null]);
    } catch {
      setError("Couldn't save that photo on this device.");
    }
    setBusy(false);
  };
  const choose = (id: string) => {
    // first tap = before, second = after; a third starts over
    if (!pick[0] || (pick[0] && pick[1])) setPick([id, null]);
    else if (id !== pick[0]) setPick([pick[0], id]);
  };

  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <Camera size={14} className="text-brass" /> Progress photos
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <Lock size={12} /> Only on this device, never uploaded
          </p>
        </div>
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => input.current?.click()} disabled={busy || photos == null} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-cream px-3.5 text-xs font-bold text-bg disabled:opacity-50">
          <ImagePlus size={14} strokeWidth={2.4} /> {busy ? "Saving…" : "Add"}
        </motion.button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      {error && <p className="mt-2 text-xs text-chilli">{error}</p>}

      {photos == null ? (
        <div className="skeleton mt-4 h-64" />
      ) : !list.length ? (
        <button onClick={() => input.current?.click()} className="mt-4 grid flex-1 place-items-center rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center hover:bg-surface-2/60">
          <span>
            <Camera size={26} className="mx-auto text-faint" />
            <span className="mt-2 block text-sm text-muted">Same light, same spot, same pose each time, and the changes jump out. Your photos stay on this phone.</span>
          </span>
        </button>
      ) : (
        <>
          {a && b ? (
            <Compare before={a} after={b} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob URL
            <img src={list[0].url} alt={`Progress photo, ${short(list[0].date)}`} className="mx-auto mt-4 aspect-[3/4] w-full max-w-[19rem] rounded-2xl object-cover" />
          )}
          <p className="mt-2 text-center text-[11px] text-faint">{list.length > 1 ? "Tap two photos to compare them" : "Add another photo later to compare"}</p>
          <ul className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
            {[...list].reverse().map((p) => {
              const role = p.id === a?.id ? "Before" : p.id === b?.id ? "After" : null;
              return (
                <li key={p.id} className="relative shrink-0">
                  <button onClick={() => choose(p.id)} aria-pressed={!!role} className={`block overflow-hidden rounded-xl ring-2 transition-shadow ${role ? "ring-turmeric" : "ring-transparent"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL */}
                    <img src={p.url} alt={`Progress photo, ${short(p.date)}`} className="h-20 w-15 object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-[10px] font-semibold text-white">{short(p.date)}</span>
                  </button>
                  <button onClick={() => void deletePhoto(p.id)} aria-label={`Delete photo from ${short(p.date)}`} className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border border-line-strong bg-surface text-faint hover:text-chilli">
                    <Trash size={11} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Before / after with a draggable divider. */
function Compare({ before, after }: { before: { url: string; date: string }; after: { url: string; date: string } }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={box}
      data-vaul-no-drag
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
      className="relative mx-auto mt-4 aspect-[3/4] w-full max-w-[19rem] cursor-ew-resize touch-none select-none overflow-hidden rounded-2xl bg-surface-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL */}
      <img src={after.url} alt={`After, ${short(after.date)}`} className="absolute inset-0 size-full object-cover" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL */}
      <img src={before.url} alt={`Before, ${short(before.date)}`} className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} draggable={false} />
      <span className="absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgb(0_0_0/0.5)]" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-lg">
          <ChevronsLeftRight size={18} />
        </span>
      </span>
      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">Before · {short(before.date)}</span>
      <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">After · {short(after.date)}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before and after"
        className="sr-only"
      />
    </div>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
