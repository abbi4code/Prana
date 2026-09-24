"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Scale, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { PranaStreakCard, StreakCard } from "@/components/progress/StreakCard";
import { YearHeatmap } from "@/components/progress/YearHeatmap";
import { useStore } from "@/lib/store";
import { dayStatus } from "@/lib/streaks";
import { useTokens } from "@/lib/useTokens";
import { useFitnessStreaks } from "@/lib/useWorkouts";

const short = (k: string) => parseDay(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function ProgressPage() {
  const hydrated = useStore((s) => s.hydrated);
  const entries = useStore((s) => s.entries);
  const weights = useStore((s) => s.weights);
  const goals = useStore((s) => s.goals);
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

  if (!hydrated) return <div className="space-y-4"><div className="skeleton h-12" /><div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0"><div className="skeleton h-72" /><div className="skeleton h-72" /></div></div>;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[2rem] font-semibold lg:text-4xl">Progress</h1>

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-4">
          {started && <PranaStreakCard />}
          <StreakCard />
        </div>
        <YearHeatmap />
      </div>

      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <section className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Weight · 7-day avg</p>
              <p className="mt-1 font-display text-4xl font-semibold">
                {latest ? latest.avg : "–"}
                <span className="text-lg text-muted"> kg</span>
              </p>
              {latest && first && latest !== first && (
                <p className={`text-sm font-semibold ${latest.avg <= first.avg ? "text-leaf" : "text-saffron"}`}>
                  {latest.avg <= first.avg ? "↓" : "↑"} {Math.abs(Math.round((latest.avg - first.avg) * 10) / 10)} kg since {short(first.date)}
                </p>
              )}
            </div>
            <Scale className="text-brass" size={22} />
          </div>

          <form
            className="mt-4 flex gap-2"
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
              className="h-12 flex-1 rounded-2xl border border-line-strong bg-bg/60 px-4 outline-none placeholder:text-faint focus:border-turmeric/60"
            />
            <motion.button whileTap={{ scale: 0.95 }} className="h-12 rounded-2xl bg-cream px-5 font-bold text-bg">
              Log
            </motion.button>
          </form>

          {weightSeries.length > 1 ? (
            <div className="-ml-3 mt-5 h-48">
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
            <p className="mt-4 text-sm text-muted">Log your weight for a few days to see the trend line.</p>
          )}

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
        </section>

        <section className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Calories · last 14 days</p>
          <div className="mt-2 flex gap-6">
            <div>
              <p className="font-display text-3xl font-semibold tabular">{avgKcal.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted">avg per logged day</p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold tabular text-leaf">{onTarget}<span className="text-lg text-muted">/{logged.length}</span></p>
              <p className="text-xs text-muted">days on target</p>
            </div>
          </div>
          <div className="-ml-3 mt-4 h-52">
            <ResponsiveContainer>
              <BarChart data={calories}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
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
          <p className="mt-2 text-xs text-faint">Dashed line = your goal ({goals.kcal.toLocaleString("en-IN")} kcal)</p>
        </section>
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
