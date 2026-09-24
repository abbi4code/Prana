"use client";

import { motion } from "motion/react";
import { Flame, Snowflake, Trophy } from "lucide-react";
import { RollingNumber } from "@/components/RollingNumber";
import { MAX_FREEZES, FREEZE_EVERY } from "@/lib/streaks";
import { useStreaks } from "@/lib/useStreaks";

export function StreakCard() {
  const { current, best, freezes, onTargetDays, status, today } = useStreaks();
  const todayOn = status.get(today) === "on";
  const toNextFreeze = FREEZE_EVERY - (current % FREEZE_EVERY);

  return (
    <section className="card relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full opacity-40 blur-3xl"
        style={{ background: current ? "var(--color-saffron)" : "transparent" }}
      />
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Discipline streak</p>
      <div className="mt-2 flex items-end gap-3">
        <motion.span
          animate={current ? { scale: [1, 1.12, 1], rotate: [0, -4, 0] } : {}}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }}
          className={`grid size-14 place-items-center rounded-2xl ${current ? "bg-saffron/15 text-saffron" : "bg-surface-2 text-faint"}`}
        >
          <Flame size={30} strokeWidth={2.2} />
        </motion.span>
        <div>
          <p className="font-display text-5xl font-semibold leading-none">
            <RollingNumber value={current} />
          </p>
          <p className="mt-1 text-sm text-muted">{current === 1 ? "day" : "days"} on target{todayOn ? ", today included" : ""}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat icon={<Trophy size={15} className="text-turmeric" />} value={best} label="best" />
        <Stat icon={<Flame size={15} className="text-leaf" />} value={onTargetDays} label="on-target days" />
        <div className="rounded-2xl bg-surface-2 px-2 py-2.5">
          <div className="flex justify-center gap-1">
            {Array.from({ length: MAX_FREEZES }, (_, i) => (
              <Snowflake key={i} size={17} className={i < freezes ? "text-sky" : "text-faint/50"} />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">freezes</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        On target = logged and within 80–105% of your goal. Every {FREEZE_EVERY} days earns a freeze that saves your streak on an off day
        {freezes < MAX_FREEZES && current > 0 ? ` (next in ${toNextFreeze} ${toNextFreeze === 1 ? "day" : "days"})` : ""}.
      </p>
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-2.5">
      <p className="flex items-center justify-center gap-1 font-display text-xl font-semibold tabular">{icon}{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
