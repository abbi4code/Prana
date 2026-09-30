"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Scale, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { PranaStreakCard, StreakCard, WorkoutStreakCard } from "@/components/progress/StreakCard";
import { YearHeatmap } from "@/components/progress/YearHeatmap";
import { WrappedCard } from "@/components/wrapped/WrappedEntry";
import { useStore } from "@/lib/store";
import { dayStatus } from "@/lib/streaks";
import { useTokens } from "@/lib/useTokens";
import { useFitnessStreaks } from "@/lib/useWorkouts";
import { GoalNudge } from "@/components/me/EnergyCard";
import { mifflin } from "@/lib/energy";

const short = (k: string) => parseDay(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Health → Progress (D55): streaks, the year, weight and calories. Body moved to its own tab. */
export function ProgressTab() {
  const hydrated = useStore((s) => s.hydrated);
  const entries = useStore((s) => s.entries);
  const weights = useStore((s) => s.weights);
  const goals = useStore((s) => s.goals);
  const profile = useStore((s) => s.profile);
  const logWeight = useStore((s) => s.logWeight);
  const removeWeight = useStore((s) => s.removeWeight);
  const [kg, setKg] = useState("");
  const tk = useTokens();
  const { started } = useFitnessStreaks();
  const today = dayKey();

  const calories = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of entries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.kcal);
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, i - 13);
      return { d, label: parseDay(d).getDate(), kcal: byDay.get(d) ?? 0 };
    });
  }, [entries, today]);

  // 7-day trailing average smooths daily water-weight swings
  const weightSeries = useMemo(
    () =>
      weights.map((w) => {
        const from = addDays(w.date, -6);
        const win = weights.filter((x) => x.date >= from && x.date <= w.date);
        return { ...w, label: short(w.date), avg: Math.round((win.reduce((t, x) => t + x.kg, 0) / win.length) * 10) / 10 };
      }),
    [weights],
  );

  const logged = calories.filter((c) => c.kcal > 0);
  const avgKcal = logged.length ? Math.round(logged.reduce((t, c) => t + c.kcal, 0) / logged.length) : 0;
  const onTarget = logged.filter((c) => dayStatus(c.kcal, goals.kcal) === "on").length;
  const latest = weightSeries.at(-1);
  const first = weightSeries[0];

  if (!hydrated) return <ProgressSkeleton />;

  // bento: streak cards in one row (equal heights), the year full width, then weight | calories (equal heights)
  return (
    <div className="space-y-4 lg:space-y-6">
      <GoalNudge />

      <WrappedCard />

      <div className={`grid grid-cols-1 gap-4 lg:gap-6 md:grid-cols-2 ${started ? "xl:grid-cols-3" : ""}`}>
        {started && (
          <div className="md:col-span-2 xl:col-span-1">
            <PranaStreakCard />
          </div>
        )}
        <StreakCard />
        <WorkoutStreakCard />
      </div>

      <YearHeatmap />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
        <section className="card flex flex-col p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Weight · 7-day avg</p>
            <Scale className="text-brass" size={20} />
          </div>
          <div className="mt-2 flex min-h-[4.25rem] items-start justify-between gap-3">
          <div>
            <p className="font-display text-4xl font-semibold leading-tight">
              {latest ? latest.avg : "–"}
              <span className="text-lg text-muted"> kg</span>
            </p>
            {latest && first && latest !== first && (
              <p className={`text-xs font-semibold ${latest.avg <= first.avg ? "text-leaf" : "text-saffron"}`}>
                {latest.avg <= first.avg ? "↓" : "↑"} {Math.abs(Math.round((latest.avg - first.avg) * 10) / 10)} kg since {short(first.date)}
              </p>
            )}
          </div>
          {/* resting burn follows the weight (D45) */}
          {latest && profile && profile.age > 0 && profile.heightCm > 0 && (
            <Link href="/me" className="shrink-0 rounded-2xl bg-leaf/10 px-3 py-2 text-right hover:bg-leaf/15">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-leaf">Resting burn</span>
              <span className="block font-display text-lg font-semibold leading-tight tabular">~{Math.round(mifflin(profile, latest.avg)).toLocaleString("en-IN")}</span>
              <span className="block text-[10px] text-muted tabular">
                {first && latest !== first
                  ? `${Math.round(mifflin(profile, latest.avg) - mifflin(profile, first.avg)) >= 0 ? "+" : "−"}${Math.abs(Math.round(mifflin(profile, latest.avg) - mifflin(profile, first.avg)))} kcal/day since ${short(first.date)}`
                  : "kcal / day"}
              </span>
            </Link>
          )}
          </div>

          {weightSeries.length > 1 ? (
            <div className="-ml-3 mt-4 h-52">
              <ResponsiveContainer>
                <LineChart data={weightSeries}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v: number) => v.toFixed(1)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={<ChartTip unit="kg" />} />
                  <Line dataKey="kg" strokeWidth={0} dot={{ r: 3, fill: tk.muted, strokeWidth: 0 }} isAnimationActive={false} />
                  <Line dataKey="avg" stroke={tk.turmeric} strokeWidth={3} dot={false} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 grid h-52 place-items-center rounded-2xl border border-dashed border-line-strong px-6 text-center">
              <div>
                <Scale size={26} className="mx-auto text-faint" />
                <p className="mt-2 text-sm text-muted">Log your weight for a few days to see the trend line.</p>
              </div>
            </div>
          )}

          <div className="mt-auto pt-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = parseFloat(kg);
                if (v > 20 && v < 300) {
                  logWeight(today, Math.round(v * 10) / 10);
                  setKg("");
                }
              }}
            >
              <input
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                inputMode="decimal"
                placeholder={weights.find((w) => w.date === today) ? "Update today's weight" : "Today's weight (kg)"}
                className="h-11 min-w-0 flex-1 rounded-2xl border border-line-strong bg-bg/60 px-4 outline-none placeholder:text-faint focus:border-turmeric/60"
              />
              <motion.button whileTap={{ scale: 0.95 }} className="h-11 rounded-2xl bg-cream px-5 font-bold text-bg">
                Log
              </motion.button>
            </form>
            {weights.length > 0 && (
              <ul className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
                {[...weights].reverse().slice(0, 10).map((w) => (
                  <li key={w.date} className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-3 pr-1.5 text-xs">
                    <span className="text-muted">{short(w.date)}</span>
                    <span className="font-semibold">{w.kg}</span>
                    <button onClick={() => removeWeight(w.date)} aria-label={`Remove ${short(w.date)}`} className="grid size-5 place-items-center rounded-full text-faint">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card flex flex-col p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Calories · last 14 days</p>
          <div className="mt-2 flex min-h-[4.25rem] gap-6">
            <div>
              <p className="font-display text-4xl font-semibold leading-tight tabular">{avgKcal.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted">avg per logged day</p>
            </div>
            <div>
              <p className="font-display text-4xl font-semibold leading-tight tabular text-leaf">{onTarget}<span className="text-lg text-muted">/{logged.length}</span></p>
              <p className="text-xs text-muted">days on target</p>
            </div>
          </div>
          <div className="-ml-3 mt-4 h-52 md:h-auto md:min-h-52 md:flex-1">
            <ResponsiveContainer>
              <BarChart data={calories}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} domain={[0, (max: number) => Math.max(max, goals.kcal) * 1.1]} tickFormatter={(v: number) => Math.round(v).toLocaleString("en-IN")} />
                <Tooltip content={<ChartTip unit="kcal" />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                <ReferenceLine y={goals.kcal} stroke={tk.leaf} strokeDasharray="4 4" />
                <Bar dataKey="kcal" radius={[6, 6, 2, 2]}>
                  {calories.map((c) => (
                    <Cell key={c.d} fill={c.kcal > goals.kcal * 1.05 ? tk.chilli : tk.turmeric} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-auto pt-3 text-xs text-faint">Dashed line = your goal ({goals.kcal.toLocaleString("en-IN")} kcal)</p>
        </section>
      </div>

    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">
        <div className="skeleton h-64 md:col-span-2 xl:col-span-1" />
        <div className="skeleton h-64" />
        <div className="skeleton h-64" />
      </div>
      <div className="skeleton h-60" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
        <div className="skeleton h-96" />
        <div className="skeleton h-96" />
      </div>
    </div>
  );
}

function ChartTip({ active, payload, unit }: { active?: boolean; payload?: { value: number; payload: { d?: string; date?: string } }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload.at(-1)!;
  const key = p.payload.d ?? p.payload.date;
  return (
    <div className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-xl">
      {key && <p className="text-muted">{short(key)}</p>}
      <p className="font-bold">{p.value.toLocaleString("en-IN")} {unit}</p>
    </div>
  );
}
