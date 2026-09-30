"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, HeartPulse, RefreshCw, Scale } from "lucide-react";
import { RollingNumber } from "@/components/RollingNumber";
import { NUDGE_KCAL } from "@/lib/energy";
import { useStore, useUI } from "@/lib/store";
import { useEnergy } from "@/lib/useEnergy";

// "Your energy" (D45): resting burn (BMR) made visible: a live count since midnight, and how the daily goal is
// built from it (resting + daily life = maintenance, ± your aim).

type E = NonNullable<ReturnType<typeof useEnergy>>;

/** Ticks once a second while mounted (0 until the first tick, so render stays pure). */
function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return now;
}

export function EnergyCard() {
  const e = useEnergy();
  return (
    <section className="card relative overflow-hidden p-5">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-leaf opacity-[0.14] blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HeartPulse size={16} className="text-leaf" />
          <h2 className="font-display text-lg font-semibold">Your energy</h2>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">~ estimate</span>
      </div>
      {e ? <Body e={e} /> : (
        <p className="relative mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-5 text-sm text-muted">
          <ArrowDown size={16} className="shrink-0 animate-bounce text-leaf" />
          Fill in &ldquo;Find my daily goal&rdquo; below to see what your body burns at rest, and how your goal is built.
        </p>
      )}
    </section>
  );
}

function Body({ e }: { e: E }) {
  const { now: n, goal } = e;
  return (
    <div className="relative">
      <LiveResting bmr={n.bmr} />
      <Ladder e={e} />
      <dl className="mt-4 space-y-1.5 text-sm">
        <Row dot="bg-leaf" label="Resting burn (BMR)" hint="your body, lying still all day" value={`~${n.bmr.toLocaleString("en-IN")}`} />
        <Row dot="bg-turmeric" label="Daily life" hint="walking, work, chores, workouts" value={`+ ${n.activity.toLocaleString("en-IN")}`} />
        <Row label="Maintenance" value={`~${n.tdee.toLocaleString("en-IN")}`} strong />
        {n.aim !== 0 && (
          <Row dot={n.aim < 0 ? "bg-chilli" : "bg-saffron"} label={n.aim < 0 ? "Aim: lose" : "Aim: gain"} hint={n.aim < 0 ? "about 0.5 kg a week" : "slow, lean gain"} value={`${n.aim < 0 ? "−" : "+"} ${Math.abs(n.aim)}`} />
        )}
        <div className="mt-2 flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2.5">
          <span className="font-semibold">{goal === n.goal ? "Your daily goal" : "Suggested goal"}</span>
          <span className="font-display text-xl font-semibold tabular">{n.goal.toLocaleString("en-IN")} <span className="text-sm text-muted">kcal</span></span>
        </div>
        {goal !== n.goal && !e.refresh && (
          <p className="px-1 text-xs text-muted tabular">
            Your goal is {goal.toLocaleString("en-IN")} kcal{e.fromCalculator ? "" : " (set by you)"}.
          </p>
        )}
      </dl>
      {e.refresh && <GoalNudge className="mt-4" />}
      <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-faint">
        <Scale size={12} className="mt-0.5 shrink-0" />
        <span>
          At {e.weight.kg} kg ({e.weight.from === "weigh-ins" ? "7-day average of your weigh-ins" : "the weight in your profile; log weigh-ins in Health → Progress to keep it current"}).
          Mifflin–St Jeor: within about 10% for most people in studies, less tested in Indian adults, so treat it as a guide.
          Most of it keeps your organs going: brain, liver, heart, kidneys.
        </span>
      </p>
    </div>
  );
}

/** "~1,134.6 kcal burned since midnight": resting burn spread evenly over the day, ticking live. */
function LiveResting({ bmr }: { bmr: number }) {
  const now = useNow();
  const d = new Date(now || 0);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const kcal = now ? (bmr * (now - midnight)) / 86_400_000 : 0;
  return (
    <div className="mt-4 flex items-end justify-between gap-3">
      <div>
        <p className="font-display text-5xl font-semibold leading-none text-leaf tabular">
          <span className="text-3xl">~</span>
          <RollingNumber value={Math.floor(kcal)} />
          <span className="text-2xl text-leaf/70">.{Math.floor((kcal % 1) * 10)}</span>
          <span className="ml-1.5 text-base font-medium text-muted">kcal</span>
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <span className="relative flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-leaf opacity-60" />
            <span className="relative size-2 rounded-full bg-leaf" />
          </span>
          burned since midnight, just keeping you alive
        </p>
      </div>
      <p className="shrink-0 pb-1 text-right text-xs text-muted tabular">
        ~{Math.round(bmr / 24)} kcal
        <br />
        an hour
      </p>
    </div>
  );
}

/** Resting | daily life, with the aim cut from (or added to) the end, and a pin at your goal. */
function Ladder({ e }: { e: E }) {
  const { now: n, goal } = e;
  const scale = Math.max(n.tdee, n.goal, goal) * 1.02;
  const pct = (v: number) => `${(v / scale) * 100}%`;
  const grow = { type: "spring", stiffness: 70, damping: 16 } as const;
  return (
    <div className="mt-5">
      <div className="relative h-5 rounded-full bg-surface-3">
        <motion.div className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-leaf/80 to-leaf" initial={{ width: 0 }} animate={{ width: pct(n.bmr) }} transition={grow} />
        <motion.div
          className="absolute inset-y-0 bg-gradient-to-r from-turmeric to-turmeric/80"
          initial={{ left: pct(n.bmr), width: 0 }}
          animate={{ left: pct(n.bmr), width: pct(n.activity) }}
          transition={{ ...grow, delay: 0.25 }}
          style={{ borderTopRightRadius: n.aim >= 0 ? 999 : 0, borderBottomRightRadius: n.aim >= 0 ? 999 : 0 }}
        />
        {n.aim < 0 && (
          // the deficit: hatched over the end of maintenance
          <motion.div
            className="absolute inset-y-0 rounded-r-full"
            style={{ left: pct(n.goal), backgroundImage: "repeating-linear-gradient(135deg, var(--color-chilli) 0 4px, transparent 4px 8px)", opacity: 0.75 }}
            initial={{ width: 0 }}
            animate={{ width: pct(n.tdee - n.goal) }}
            transition={{ ...grow, delay: 0.5 }}
          />
        )}
        {n.aim > 0 && (
          <motion.div className="absolute inset-y-0 rounded-r-full bg-saffron" style={{ left: pct(n.tdee) }} initial={{ width: 0 }} animate={{ width: pct(n.goal - n.tdee) }} transition={{ ...grow, delay: 0.5 }} />
        )}
        {/* your goal */}
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="absolute -bottom-1.5 -top-1.5 w-[3px] -translate-x-1/2 rounded-full bg-cream shadow-[0_0_0_3px_var(--color-surface)]"
          style={{ left: pct(goal) }}
        />
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] font-bold uppercase tracking-wider">
        <span className="absolute left-0 text-leaf">Resting</span>
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="absolute -translate-x-1/2 whitespace-nowrap text-text" style={{ left: pct(goal) }}>
          Goal {goal.toLocaleString("en-IN")}
        </motion.span>
      </div>
    </div>
  );
}

function Row({ dot, label, hint, value, strong }: { dot?: string; label: string; hint?: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 px-1 ${strong ? "border-t border-line pt-1.5" : ""}`}>
      <dt className="flex min-w-0 items-baseline gap-2">
        <span className={`size-2 shrink-0 translate-y-[-1px] rounded-full ${dot ?? "bg-transparent"}`} />
        <span className="min-w-0">
          <span className={`block ${strong ? "font-semibold" : ""}`}>{label}</span>
          {hint && <span className="block text-[11px] leading-tight text-faint">{hint}</span>}
        </span>
      </dt>
      <dd className={`shrink-0 tabular ${strong ? "font-semibold" : "text-muted"}`}>{value}</dd>
    </div>
  );
}

const DISMISS = "prana-goal-nudge";

/**
 * "Your weight has changed since you set your goal: new suggestion 1,760 · Update". Shown in Me and on Progress.
 * Neutral on purpose (no "lighter/heavier" praise or blame). "Not now" hides it until the suggestion moves again.
 */
export function GoalNudge({ className = "" }: { className?: string }) {
  const e = useEnergy();
  const setProfile = useStore((s) => s.setProfile);
  const setGoals = useStore((s) => s.setGoals);
  const showToast = useUI((s) => s.showToast);
  const [dismissed, setDismissed] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(DISMISS));
      return v > 0 ? v : null;
    } catch {
      return null;
    }
  });
  const show = !!e?.refresh && (dismissed == null || Math.abs(e.suggestion.kcal - dismissed) >= NUDGE_KCAL);
  const diff = e ? e.suggestion.kcal - e.goal : 0;

  const update = () => {
    if (!e) return;
    const s = useStore.getState();
    const before = { goals: s.goals, profile: s.profile };
    setProfile({ ...e.profile, weightKg: e.weight.kg });
    setGoals(e.suggestion);
    showToast(`Goal updated to ${e.suggestion.kcal.toLocaleString("en-IN")} kcal`, {
      label: "Undo",
      run: () => {
        if (before.profile) useStore.getState().setProfile(before.profile);
        useStore.getState().setGoals(before.goals);
      },
    });
  };
  const later = () => {
    if (!e) return;
    try {
      localStorage.setItem(DISMISS, String(e.suggestion.kcal));
    } catch {}
    setDismissed(e.suggestion.kcal);
  };

  return (
    <AnimatePresence initial={false}>
      {show && e && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={`overflow-hidden ${className}`}
        >
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-leaf/30 bg-leaf/[0.08] p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf/15 text-leaf">
              <RefreshCw size={18} />
            </span>
            <p className="min-w-0 flex-1 text-sm">
              <span className="block font-semibold">Time to refresh your goal?</span>
              <span className="block text-xs text-muted tabular">
                Your 7-day weight is {e.weight.kg} kg; your goal was set at {e.profile.weightKg} kg. New suggestion:{" "}
                <span className="font-semibold text-text">{e.suggestion.kcal.toLocaleString("en-IN")} kcal</span> ({diff > 0 ? "+" : "−"}
                {Math.abs(diff)}).
              </span>
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <button onClick={later} className="h-10 flex-1 rounded-xl px-3 text-sm font-semibold text-muted hover:text-text sm:flex-none">Not now</button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={update} className="h-10 flex-1 rounded-xl bg-cream px-4 text-sm font-bold text-bg sm:flex-none">
                Update
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
