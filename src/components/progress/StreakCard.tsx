"use client";

import { motion } from "motion/react";
import { Dumbbell, Flame, Snowflake, Sparkles, Trophy, UtensilsCrossed } from "lucide-react";
import { RollingNumber } from "@/components/RollingNumber";
import { MAX_FREEZES, FREEZE_EVERY } from "@/lib/streaks";
import { useStreaks } from "@/lib/useStreaks";
import { useFitnessStreaks } from "@/lib/useWorkouts";

/**
 * One layout for every streak card (food, workout, Prana), so they line up side by side on Progress:
 * same header, badge + big number, three stat tiles, note pinned to the bottom. It's a container, so a wide
 * card (tablet, full-width row) puts the stats beside the number instead of under it.
 */
export function StreakShell({ label, badge, badgeOn, glow, live, current, caption, stats, note }: {
  label: React.ReactNode;
  badge: React.ReactNode;
  /** classes for the badge when the streak is alive */
  badgeOn: string;
  /** CSS background for the corner glow when the streak is alive */
  glow: string;
  /** today already counts: the badge pulses */
  live: boolean;
  current: number;
  caption: string;
  stats: React.ReactNode;
  note: React.ReactNode;
}) {
  return (
    <section className="card @container relative flex h-full flex-col overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full opacity-40 blur-3xl transition-opacity duration-700"
        style={{ background: glow, opacity: current ? 0.4 : 0 }}
      />
      <p className="relative flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <div className="relative mt-3 flex flex-col gap-5 @[34rem]:flex-row @[34rem]:items-end @[34rem]:justify-between">
        <div className="flex items-end gap-3">
          <motion.span
            animate={live ? { scale: [1, 1.13, 1], rotate: [0, -5, 0] } : { scale: 1, rotate: 0 }}
            transition={{ duration: 1.6, repeat: live ? Infinity : 0, repeatDelay: 2.3 }}
            className={`grid size-14 shrink-0 place-items-center rounded-2xl ${current ? badgeOn : "bg-surface-2 text-faint"}`}
          >
            {badge}
          </motion.span>
          <div className="min-w-0">
            <p className="font-display text-5xl font-semibold leading-none">
              <RollingNumber value={current} />
            </p>
            <p className="mt-1 text-sm text-muted">{caption}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center @[34rem]:w-[19rem] @[34rem]:shrink-0">{stats}</div>
      </div>
      <p className="relative mt-auto pt-4 text-xs leading-relaxed text-faint">{note}</p>
    </section>
  );
}

export function StreakStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-2.5">
      <p className="flex items-center justify-center gap-1 font-display text-xl font-semibold tabular">{icon}{value}</p>
      <p className="truncate text-[11px] text-muted">{label}</p>
    </div>
  );
}

export function FreezeStat({ freezes }: { freezes: number }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-2.5">
      <div className="flex h-7 items-center justify-center gap-1">
        {Array.from({ length: MAX_FREEZES }, (_, i) => (
          <Snowflake key={i} size={17} className={i < freezes ? "text-sky" : "text-faint/50"} />
        ))}
      </div>
      <p className="text-[11px] text-muted">freezes</p>
    </div>
  );
}

export function StreakCard() {
  const { current, best, freezes, onTargetDays, status, today } = useStreaks();
  const todayOn = status.get(today) === "on";
  const toNextFreeze = FREEZE_EVERY - (current % FREEZE_EVERY);

  return (
    <StreakShell
      label={<><UtensilsCrossed size={13} className="text-saffron" /> Food streak</>}
      badge={<Flame size={30} strokeWidth={2.2} />}
      badgeOn="bg-saffron/15 text-saffron"
      glow="var(--color-saffron)"
      live={todayOn}
      current={current}
      caption={`${current === 1 ? "day" : "days"} on target${todayOn ? ", today included" : ""}`}
      stats={
        <>
          <StreakStat icon={<Trophy size={15} className="text-turmeric" />} value={best} label="best" />
          <StreakStat icon={<Flame size={15} className="text-leaf" />} value={onTargetDays} label="on target" />
          <FreezeStat freezes={freezes} />
        </>
      }
      note={
        <>
          On target = logged and within 80–105% of your goal. Every {FREEZE_EVERY} days earns a freeze that saves your streak on an off day
          {freezes < MAX_FREEZES && current > 0 ? ` (next in ${toNextFreeze} ${toNextFreeze === 1 ? "day" : "days"})` : ""}.
        </>
      }
    />
  );
}

/** Global streak (D27): lights only on days both are done: food on target, and the workout (or a planned rest day). */
export function PranaStreakCard() {
  const food = useStreaks();
  const { global, workout, today } = useFitnessStreaks();
  const live = global.status.get(today) === "hit";
  return (
    <StreakShell
      label={<><Sparkles size={13} className="text-turmeric" /> Prana streak</>}
      badge={<Flame size={30} strokeWidth={2.2} />}
      badgeOn="bg-gradient-to-br from-saffron to-jamun text-white"
      glow="linear-gradient(135deg, var(--color-saffron), var(--color-jamun))"
      live={live}
      current={global.current}
      caption={`${global.current === 1 ? "day" : "days"} of both${live ? ", today included" : ""}`}
      stats={
        <>
          <StreakStat icon={<UtensilsCrossed size={14} className="text-turmeric" />} value={food.current} label="food" />
          <StreakStat icon={<Dumbbell size={14} className="text-jamun" />} value={workout.current} label="workout" />
          <StreakStat icon={<Trophy size={14} className="text-turmeric" />} value={global.best} label="best" />
        </>
      }
      note="Lights up on days you do both: food on target and your workout done. Your rest days count as done."
    />
  );
}

export function WorkoutStreakCard() {
  const { workout, today, started } = useFitnessStreaks();
  const todayOn = workout.status.get(today) === "hit";
  const { current, best, freezes, hits } = workout;
  return (
    <StreakShell
      label={<><Dumbbell size={13} className="text-jamun" /> Workout streak</>}
      badge={<Dumbbell size={28} strokeWidth={2.2} />}
      badgeOn="bg-jamun/15 text-jamun"
      glow="var(--color-jamun)"
      live={todayOn}
      current={current}
      caption={!started ? "Log a workout to start" : `workout ${current === 1 ? "day" : "days"}${todayOn ? ", today included" : ""}`}
      stats={
        <>
          <StreakStat icon={<Trophy size={15} className="text-turmeric" />} value={best} label="best" />
          <StreakStat icon={<Flame size={15} className="text-jamun" />} value={hits} label="workout days" />
          <FreezeStat freezes={freezes} />
        </>
      }
      note={
        <>
          A workout day = your burn goal reached (or any workout, if you haven&apos;t set one), or a gym visit of 20+ min. Rest days you picked
          never break it. Every {FREEZE_EVERY} days earns a freeze.
        </>
      }
    />
  );
}
