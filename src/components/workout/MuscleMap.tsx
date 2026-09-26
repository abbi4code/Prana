"use client";

import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info, PersonStanding } from "lucide-react";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { getExercise, muscleLabel } from "@/lib/exercises";
import { BAND_HIGH, BAND_LOW, MUSCLES, band, weeklySets, type Muscle } from "@/lib/muscles";
import { useStore } from "@/lib/store";

// "Muscles this week" (D41): front + back body whose muscles light up by weekly sets (fractional counting, Schoenfeld
// bands), plus a slim bar per trained muscle. Hover / tap a muscle in either place to highlight it in both.

type Shape = { m: Muscle; d: string };

/** Rows shown on a narrow card before "Show all". */
const SHORT_LIST = 6;

// Stylised figures on a 100 × 220 grid (x = 50 is the middle). Left-side shapes are mirrored for the right side.
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(100 - Number(x)).toFixed(2)} ${y}`);
const pair = (m: Muscle, d: string): Shape[] => [{ m, d }, { m, d: mirror(d) }];
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
/** Ellipses are mirrored by their centre (mirror() would also flip the radii). */
const pairE = (m: Muscle, cx: number, cy: number, rx: number, ry: number): Shape[] => [{ m, d: ellipse(cx, cy, rx, ry) }, { m, d: ellipse(100 - cx, cy, rx, ry) }];

const SILHOUETTE = [
  ellipse(50, 16, 10.5, 11.5),
  "M 44.5 26 L 55.5 26 L 56 34 L 44 34 Z",
  "M 30 37 Q 50 31 70 37 L 73 64 Q 71 90 66 110 L 34 110 Q 29 90 27 64 Z",
  "M 34 106 L 66 106 L 68 122 Q 50 129 32 122 Z",
  ...pair("chest", "M 27 40 Q 19 43 17.5 60 L 15 92 Q 15.5 98 21 97 L 26.5 70 Z").map((s) => s.d),
  ...pair("chest", "M 15 92 Q 10 110 11 120 Q 14 124 17 120 L 21 97 Z").map((s) => s.d),
  ...pair("chest", "M 32.5 120 Q 31 150 34.5 172 L 36 212 Q 41 216 46 212 L 47 172 Q 49.5 150 49.5 124 Z").map((s) => s.d),
];

const FRONT: Shape[] = [
  { m: "traps", d: "M 42 34 Q 50 31 58 34 L 55 39 Q 50 37.5 45 39 Z" },
  ...pairE("shoulders", 26.5, 44, 7.5, 8.5),
  ...pair("chest", "M 49.3 42 Q 38 40 32.5 47.5 Q 31.5 58 38 62 Q 46 64 49.3 60 Z"),
  ...pair("biceps", "M 22.5 53 Q 26.5 56 25.5 66 Q 24 76 20 75 Q 17.5 70 18.5 62 Q 19.5 54 22.5 53 Z"),
  ...pair("forearms", "M 18.5 82 Q 21.5 86 19.5 98 Q 17 110 14 108 Q 12 100 14 90 Q 15.5 83 18.5 82 Z"),
  { m: "abdominals", d: "M 43.5 66 h 6 v 8 h -6 Z M 50.5 66 h 6 v 8 h -6 Z M 43.5 76 h 6 v 8 h -6 Z M 50.5 76 h 6 v 8 h -6 Z M 43.8 86 h 5.7 v 8 h -5.7 Z M 50.5 86 h 5.7 v 8 h -5.7 Z M 44.5 96 L 55.5 96 L 53.5 107 L 46.5 107 Z" },
  ...pair("abductors", "M 31.5 111 Q 34.5 109.5 35.5 116 L 33.5 128 Q 30.5 121 31.5 111 Z"),
  ...pair("quadriceps", "M 33.5 124 Q 39.5 120 45 124.5 L 46 160 Q 40 168 35.5 161 Q 32.5 144 33.5 124 Z"),
  ...pair("adductors", "M 46 125 Q 49 124 49.5 128 L 49 148 Q 46.5 142 46 134 Z"),
  ...pairE("calves", 40.5, 189, 4.5, 12),
];

const BACK: Shape[] = [
  { m: "middle back", d: "M 43 58 Q 50 64 57 58 L 56 82 Q 50 85 44 82 Z" },
  { m: "traps", d: "M 50 30 L 63 38 Q 58 50 50 61 Q 42 50 37 38 Z" },
  ...pairE("shoulders", 26.5, 44, 7.5, 8.5),
  ...pair("lats", "M 34 52 Q 30 70 38 93 L 43.5 89 L 43.5 62 Q 39 59 34 52 Z"),
  ...pair("lower back", "M 43.5 86 L 49.5 86 L 49.5 106 L 43.5 106 Z"),
  ...pair("triceps", "M 21.5 52 Q 25.5 55 25 66 Q 24 77 20 76 Q 17 71 18 62 Q 18.5 53 21.5 52 Z"),
  ...pair("forearms", "M 18.5 82 Q 21.5 86 19.5 98 Q 17 110 14 108 Q 12 100 14 90 Q 15.5 83 18.5 82 Z"),
  ...pair("abductors", "M 32 104 Q 36 102.5 38 108 L 35 114 Q 32 110 32 104 Z"),
  ...pair("glutes", "M 34 110 Q 42 106 49.4 110 L 49 126 Q 41 132 34 124 Z"),
  ...pair("hamstrings", "M 34 130 Q 41 127 47 130.5 L 46 164 Q 40 170 36 164 Q 33 148 34 130 Z"),
  ...pair("calves", "M 36 176 Q 41 172 46 176 Q 47.5 192 42 205 Q 36.5 196 36 176 Z"),
];

export function MuscleMap({ date }: { date: string }) {
  const workouts = useStore((s) => s.workouts);
  const [sel, setSel] = useState<Muscle | null>(null);
  const [info, setInfo] = useState(false);
  // narrow cards (phones) list the top few muscles; wide ones have room for all beside the figures
  const [all, setAll] = useState(false);
  const monday = addDays(date, -((parseDay(date).getDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  const thisWeek = dayKey() >= monday && dayKey() <= sunday;

  const sets = useMemo(() => weeklySets(workouts, monday, sunday, getExercise), [workouts, monday, sunday]);
  const trained = MUSCLES.filter((m) => (sets.get(m) ?? 0) > 0).sort((a, b) => (sets.get(b) ?? 0) - (sets.get(a) ?? 0));
  const untrained = MUSCLES.filter((m) => !(sets.get(m) ?? 0));
  const top = trained.filter((m) => band(sets.get(m) ?? 0) === 3).length;
  const scale = Math.max(15, ...trained.map((m) => sets.get(m) ?? 0));
  const selSets = sel ? sets.get(sel) ?? 0 : 0;

  return (
    <section className="card @container relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <PersonStanding size={14} className="text-jamun" /> Muscles {thisWeek ? "this week" : `· week of ${parseDay(monday).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {trained.length
              ? <><span className="font-semibold text-text">{trained.length}</span> trained{top ? <> · <span className="font-semibold text-text">{top}</span> at {BAND_HIGH}+ sets</> : null}</>
              : "Log a lift and the muscles you train light up here."}
          </p>
        </div>
        <button
          onClick={() => setInfo(!info)}
          aria-expanded={info}
          aria-label="How sets are counted"
          className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${info ? "bg-surface-2 text-text" : "text-faint hover:text-muted"}`}
        >
          <Info size={16} />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-5 @[34rem]:flex-row @[34rem]:items-start @[34rem]:gap-7">
        <div className="shrink-0 @[34rem]:w-64">
          <div className="grid grid-cols-2 gap-2">
            <Figure label="Front" shapes={FRONT} sets={sets} sel={sel} onSel={setSel} />
            <Figure label="Back" shapes={BACK} sets={sets} sel={sel} onSel={setSel} />
          </div>
          <p className="mt-2 h-4 text-center text-xs tabular" aria-live="polite">
            {sel ? (
              <><span className="font-semibold text-text">{muscleLabel(sel)}</span> <span className="text-muted">· {fmtSets(selSets)} {selSets === 1 ? "set" : "sets"}</span></>
            ) : (
              <span className="text-faint">Tap a muscle</span>
            )}
          </p>
          <Legend />
        </div>

        <div className="min-w-0 flex-1">
          {trained.length > 0 && (
            <ul className="space-y-2.5">
              {trained.map((m, i) => {
                const n = sets.get(m) ?? 0;
                return (
                  <li
                    key={m}
                                        onMouseEnter={() => setSel(m)}
                    onMouseLeave={() => setSel(null)}
                    onClick={() => setSel(sel === m ? null : m)}
                    className={`cursor-default grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-lg transition-opacity ${!all && i >= SHORT_LIST ? "hidden @[34rem]:grid" : "grid"} ${sel && sel !== m ? "opacity-50" : ""}`}
                  >
                    <span className="truncate text-sm font-medium">{muscleLabel(m)}</span>
                    <span className="relative h-2 rounded-full bg-surface-3">
                      <motion.span
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: band(n) === 3 ? "linear-gradient(90deg, var(--color-jamun), var(--color-chilli))" : "var(--color-jamun)", opacity: band(n) === 1 ? 0.45 : 1 }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(1, n / scale) * 100}%` }}
                        transition={{ type: "spring", stiffness: 80, damping: 18 }}
                      />
                      {/* the 10-set mark */}
                      <span aria-hidden className="absolute -top-1 bottom-[-4px] w-px bg-text/35" style={{ left: `${(BAND_HIGH / scale) * 100}%` }} />
                    </span>
                    <span className="text-right font-display text-sm font-semibold tabular">{fmtSets(n)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {trained.length > SHORT_LIST && (
            <button onClick={() => setAll(!all)} className="mt-3 text-xs font-bold text-jamun @[34rem]:hidden">
              {all ? "Show fewer" : `Show all ${trained.length}`}
            </button>
          )}
          {trained.length > 0 && untrained.length > 0 && (
            <p className="mt-4 text-xs leading-relaxed text-faint">
              <span className="font-semibold text-muted">Not yet:</span> {untrained.map((m) => muscleLabel(m)).join(", ")}
            </p>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {info && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="mt-4 rounded-2xl bg-surface-2 p-3.5 text-xs leading-relaxed text-muted">
              Each set counts 1 for the muscles an exercise targets and ½ for the ones that assist (e.g. bench press: chest 1,
              triceps and shoulders ½), the &quot;fractional&quot; count that best predicted growth in Pelland et al. 2025. Shades follow Schoenfeld et al.
              2017: under {BAND_LOW}, {BAND_LOW}–{BAND_HIGH - 1} and {BAND_HIGH}+ sets a week, where more sets meant more growth. The line on each bar marks {BAND_HIGH} sets.
              Monday to Sunday; cardio isn&apos;t counted.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Figure({ label, shapes, sets, sel, onSel }: {
  label: string; shapes: Shape[]; sets: Map<Muscle, number>; sel: Muscle | null; onSel: (m: Muscle | null) => void;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className="text-center">
      <svg viewBox="0 0 100 220" className="mx-auto h-auto w-full max-w-[8.5rem] overflow-visible" role="img" aria-label={`${label} of the body`}>
        <defs>
          <linearGradient id={`${id}-hot`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--color-jamun)" }} />
            <stop offset="1" style={{ stopColor: "var(--color-chilli)" }} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        {SILHOUETTE.map((d, i) => (
          <path key={i} d={d} style={{ fill: "rgb(var(--ink) / 0.05)", stroke: "rgb(var(--ink) / 0.09)" }} strokeWidth={0.6} />
        ))}
        {/* glow under muscles in the top band */}
        {shapes.filter((s) => band(sets.get(s.m) ?? 0) === 3).map((s, i) => (
          <path key={`g${i}`} d={s.d} fill={`url(#${id}-hot)`} filter={`url(#${id}-glow)`} opacity={0.55} />
        ))}
        {shapes.map((s, i) => {
          const b = band(sets.get(s.m) ?? 0);
          const on = sel === s.m;
          return (
            <motion.path
              key={i}
              d={s.d}
              fill={b === 3 ? `url(#${id}-hot)` : undefined}
              style={{
                fill: b === 3 ? undefined : b === 0 ? "rgb(var(--ink) / 0.1)" : "var(--color-jamun)",
                stroke: on ? "var(--color-text)" : "transparent",
              }}
              strokeWidth={1.2}
              initial={false}
              animate={{ opacity: b === 0 ? 1 : b === 1 ? 0.45 : b === 2 ? 0.8 : 1 }}
              onMouseEnter={() => onSel(s.m)}
              onMouseLeave={() => onSel(null)}
              onClick={() => onSel(on ? null : s.m)}
              className="cursor-pointer transition-[stroke] duration-150"
            >
              <title>{`${muscleLabel(s.m)}: ${fmtSets(sets.get(s.m) ?? 0)} sets`}</title>
            </motion.path>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}

function Legend() {
  const sw = (style: React.CSSProperties) => <span aria-hidden className="inline-block size-2.5 rounded-sm" style={style} />;
  return (
    <p className="mt-3 flex items-center justify-center gap-3 text-[11px] text-muted tabular">
      <span className="flex items-center gap-1">{sw({ background: "var(--color-jamun)", opacity: 0.45 })} 1–{BAND_LOW - 1}</span>
      <span className="flex items-center gap-1">{sw({ background: "var(--color-jamun)", opacity: 0.8 })} {BAND_LOW}–{BAND_HIGH - 1}</span>
      <span className="flex items-center gap-1">{sw({ background: "linear-gradient(135deg, var(--color-jamun), var(--color-chilli))" })} {BAND_HIGH}+ sets</span>
    </p>
  );
}

const fmtSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
