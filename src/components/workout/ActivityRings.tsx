"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Dumbbell, Flame, Footprints, Info, Moon } from "lucide-react";
import { Burst, useGoalHits } from "@/components/Burst";
import { RollingNumber } from "@/components/RollingNumber";
import { WHO_MOVE_MINUTES, WHO_STRENGTH_DAYS, weekActivity } from "@/lib/activity";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { useStore, useUI } from "@/lib/store";

// Workout tab hero (D33): three nested rings, like a fitness watch.
//   outer  Burn      today's estimated kcal vs your burn goal (any workout fills it when there's no goal, like the streak)
//   middle Move      this week's moderate-equivalent cardio minutes vs 150 (WHO 2020)
//   inner  Strength  this week's lifting days vs 2 (WHO 2020)
// Colours: burn = jamun→chilli (workouts), move = saffron→turmeric, strength = leaf→sky.

const SIZE = 200;
const STROKE = 14;
const GAP = 4;

type RingSpec = { pct: number; from: string; to: string };

export function ActivityRings({ date, kcal, minutes, sets, rest }: { date: string; kcal: number; minutes: number; sets: number; rest: boolean }) {
  const goal = useStore((s) => s.fitness.burnGoal);
  const workouts = useStore((s) => s.workouts);
  const showToast = useUI((s) => s.showToast);
  const [info, setInfo] = useState(false);

  // the Monday–Sunday week of the selected day, like the week strip above
  const monday = addDays(date, -((parseDay(date).getDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  const thisWeek = dayKey() >= monday && dayKey() <= sunday;
  const week = weekActivity(workouts, monday, sunday);

  const burnHits = useGoalHits(kcal, goal ?? 0, date, () => showToast("Burn goal done. Strong session."));
  const moveHits = useGoalHits(week.move, WHO_MOVE_MINUTES, monday, () => showToast(`${WHO_MOVE_MINUTES} active minutes this week. That's the WHO mark.`));
  const strengthHits = useGoalHits(week.strengthDays, WHO_STRENGTH_DAYS, monday, () => showToast(`${WHO_STRENGTH_DAYS} strength days this week. WHO box ticked.`));

  const burnPct = goal ? kcal / goal : kcal > 0 ? 1 : 0;
  const rings: RingSpec[] = [
    { pct: burnPct, from: "var(--color-jamun)", to: "var(--color-chilli)" },
    { pct: week.move / WHO_MOVE_MINUTES, from: "var(--color-saffron)", to: "var(--color-turmeric)" },
    { pct: week.strengthDays / WHO_STRENGTH_DAYS, from: "var(--color-leaf)", to: "var(--color-sky)" },
  ];
  const weekWord = thisWeek ? "this week" : "that week";

  return (
    <section className="card @container relative overflow-hidden p-5">
      <Burst trigger={burnHits + moveHits + strengthHits} />
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full blur-3xl transition-opacity duration-700" style={{ background: "var(--color-jamun)", opacity: kcal ? 0.22 : 0 }} />

      <div className="relative flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          <Flame size={13} className="text-jamun" /> Activity
        </p>
        <button
          onClick={() => setInfo(!info)}
          aria-expanded={info}
          aria-label="How these are worked out"
          className={`grid size-8 place-items-center rounded-full transition-colors ${info ? "bg-surface-2 text-text" : "text-faint hover:text-muted"}`}
        >
          <Info size={16} />
        </button>
      </div>

      <div className="relative mt-2 flex flex-col items-center gap-5 @[22rem]:flex-row @[22rem]:gap-6">
        <Dial rings={rings}>
          <RollingNumber value={kcal} className="font-display text-[1.9rem] font-semibold tracking-tight" />
          <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-faint">kcal</span>
        </Dial>

        <ul className="grid w-full grid-cols-3 gap-2 @[22rem]:grid-cols-1 @[22rem]:gap-3.5">
          <Legend
            icon={<Flame size={13} />}
            tone="text-jamun"
            bar="from-jamun to-chilli"
            label="Burn"
            when={date === dayKey() ? "today" : "that day"}
            value={kcal}
            target={goal}
            unit="kcal"
            done={!!goal && kcal >= goal}
          />
          <Legend icon={<Footprints size={13} />} tone="text-saffron" bar="from-saffron to-turmeric" label="Move" when={weekWord} value={week.move} target={WHO_MOVE_MINUTES} unit="min" done={week.move >= WHO_MOVE_MINUTES} />
          <Legend icon={<Dumbbell size={13} />} tone="text-leaf" bar="from-leaf to-sky" label="Strength" when={weekWord} value={week.strengthDays} target={WHO_STRENGTH_DAYS} unit="days" done={week.strengthDays >= WHO_STRENGTH_DAYS} />
        </ul>
      </div>

      <div className="relative mt-4 flex items-center gap-2 border-t border-line pt-3.5 text-sm text-muted tabular">
        <span><span className="font-semibold text-text">{minutes}</span> min</span>
        <span className="text-faint">·</span>
        <span><span className="font-semibold text-text">{sets}</span> {sets === 1 ? "set" : "sets"}</span>
        <span className="text-faint">{date === dayKey() ? "today" : "that day"}</span>
        {rest && !kcal ? (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-sky/12 px-3 py-1 text-xs font-semibold text-sky">
            <Moon size={13} /> Rest day
          </span>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {info && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="relative overflow-hidden"
          >
            <div className="mt-3 space-y-2 rounded-2xl bg-surface-2 p-3.5 text-xs leading-relaxed text-muted">
              <p><b className="text-jamun">Burn</b>: estimates (roughly ±30%), calories above resting only. Lifts: measured energy per rep, so weight and reps count and rest doesn&apos;t. Cardio: Compendium of Physical Activities 2024. Kept separate from your food goal.</p>
              <p><b className="text-saffron">Move</b>: WHO 2020 guidelines, 150–300 min of moderate activity a week (or 75–150 vigorous). Cardio only; vigorous minutes (6+ METs) count double, light ones (under 3 METs) don&apos;t count.</p>
              <p><b className="text-leaf">Strength</b>: WHO 2020, muscle-strengthening on 2 or more days a week. Any day with a lift logged counts.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Three nested progress rings with a soft glow; content in the middle. Gradient + filter ids are unique per instance. */
function Dial({ rings, children }: { rings: RingSpec[]; children: React.ReactNode }) {
  const id = useId().replace(/:/g, "");
  const c = SIZE / 2;
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
        <defs>
          {rings.map((r, i) => (
            <linearGradient key={i} id={`${id}-g${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: r.from }} />
              <stop offset="1" style={{ stopColor: r.to }} />
            </linearGradient>
          ))}
          <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        {rings.map((r, i) => {
          const radius = c - STROKE / 2 - 3 - i * (STROKE + GAP);
          const len = 2 * Math.PI * radius;
          const pct = Math.max(0, Math.min(r.pct, 1));
          const arc = {
            cx: c, cy: c, r: radius, fill: "none", stroke: `url(#${id}-g${i})`, strokeWidth: STROKE, strokeLinecap: "round" as const,
            strokeDasharray: len, initial: { strokeDashoffset: len }, animate: { strokeDashoffset: len * (1 - pct) },
            transition: { type: "spring" as const, stiffness: 55, damping: 18, delay: 0.08 * i },
          };
          return (
            <g key={i}>
              {/* empty track tinted in the ring's own colour, so even a zero day shows which ring is which */}
              <circle cx={c} cy={c} r={radius} fill="none" strokeWidth={STROKE} style={{ stroke: r.from, opacity: 0.13 }} />
              {pct > 0 && <motion.circle {...arc} filter={`url(#${id}-glow)`} opacity={0.5} />}
              {pct > 0 && <motion.circle {...arc} />}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function Legend({ icon, tone, bar, label, when, value, target, unit, done }: {
  icon: React.ReactNode; tone: string; bar: string; label: string; when: string;
  value: number; target: number | null; unit: string; done: boolean;
}) {
  return (
    <li className="flex min-w-0 flex-col items-center gap-1 text-center @[22rem]:flex-row @[22rem]:items-center @[22rem]:gap-3 @[22rem]:text-left">
      <span aria-hidden className={`hidden h-9 w-1 shrink-0 rounded-full bg-gradient-to-b @[22rem]:block ${bar}`} />
      <span className="min-w-0">
        <span className={`flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider @[22rem]:justify-start ${tone}`}>
          {icon} {label}
          {done && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-3.5 place-items-center rounded-full bg-current">
              <Check size={10} strokeWidth={3.5} className="text-bg" />
            </motion.span>
          )}
        </span>
        <span className="block font-display text-xl font-semibold leading-tight tabular">
          {value.toLocaleString("en-IN")}
          <span className="text-sm font-medium text-faint">{target ? `/${target.toLocaleString("en-IN")}` : ""} {unit}</span>
        </span>
        <span className="block truncate text-[11px] text-faint">{when}{!target ? " · no goal" : ""}</span>
      </span>
    </li>
  );
}
