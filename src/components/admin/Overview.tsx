"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, Mic, Repeat, Sparkles, TrendingUp, UserPlus, UsersRound, Zap } from "lucide-react";
import { useAdminQuery } from "@/lib/admin/api";
import type { Growth } from "@/lib/admin/types";
import { useTokens } from "@/lib/useTokens";
import { AXIS, ChartTip, ErrorState, Panel, PanelSkeleton, Ring, SplitBar, Stat, nf, pct, shortDay, useSvgId } from "./ui";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Overview({ days }: { days: number }) {
  const { data, error, reload } = useAdminQuery<Growth>(`/api/admin/stats?section=growth&days=${days}`);
  const tk = useTokens();
  const fill = useSvgId("active");
  if (error) return <ErrorState reason={error} onRetry={reload} />;
  if (!data) return <PanelSkeleton />;
  const k = data.kpi;
  const stick = pct(k.dau, k.mau);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Members" value={nf(k.users)} tone="turmeric" icon={<UsersRound size={18} />} delta={{ now: k.new, prev: k.newPrev }}
          sub={<span>+{nf(k.new)} joined in {data.days} d</span>} />
        <Stat label="Active" value={nf(k.active)} tone="leaf" icon={<Zap size={18} />} delta={{ now: k.active, prev: k.activePrev }}
          sub={<span>{pct(k.active, k.users) ?? 0}% of members</span>} delay={0.04} />
        <Stat label="Today" value={nf(k.dau)} tone="saffron" icon={<CalendarClock size={18} />} delay={0.08}
          sub={<span className="tabular">WAU {nf(k.wau)} · MAU {nf(k.mau)}{stick != null ? ` · ${stick}% stick` : ""}</span>} />
        <Stat label="Things logged" value={nf(k.foodLogs + k.workouts)} tone="jamun" icon={<TrendingUp size={18} />} delay={0.12}
          delta={{ now: k.foodLogs + k.workouts, prev: k.foodLogsPrev + k.workoutsPrev }}
          sub={<span className="tabular">{nf(k.foodLogs)} food · {nf(k.workouts)} workouts</span>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <Panel title="Active members & sign-ups" icon={<UserPlus size={14} className="text-leaf" />} className="lg:col-span-3"
          hint="Active = logged food, a workout or a gym visit that day">
          <div className="-ml-3 h-64">
            <ResponsiveContainer>
              <ComposedChart data={data.series}>
                <defs>
                  <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tk.leaf} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={tk.leaf} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={32} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: tk.faint, strokeDasharray: "3 3" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: tk.muted }} />
                <Bar dataKey="signups" name="Sign-ups" fill={tk.jamun} radius={[4, 4, 1, 1]} maxBarSize={14} />
                <Area dataKey="active" name="Active" type="monotone" stroke={tk.leaf} strokeWidth={2.5} fill={`url(#${fill})`} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Come back rate" icon={<Repeat size={14} className="text-turmeric" />} className="lg:col-span-2"
          hint="Of members who joined long enough ago, how many logged again">
          <div className="grid flex-1 grid-cols-3 items-center gap-2">
            {([
              ["d1", "Next day", "turmeric"],
              ["w1", "First week", "saffron"],
              ["w4", "Week 4", "leaf"],
            ] as const).map(([key, label, tone]) => {
              const r = data.retention[key];
              const p = pct(r.returned, r.eligible);
              return (
                <div key={key} className="flex flex-col items-center gap-2 text-center">
                  <Ring value={p == null ? null : p / 100} tone={tone}>
                    <span className="font-display text-xl font-semibold tabular">{p == null ? "–" : `${p}%`}</span>
                  </Ring>
                  <div>
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[11px] text-faint tabular">{nf(r.returned)} of {nf(r.eligible)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel title="What gets logged" icon={<Sparkles size={14} className="text-turmeric" />} hint="Food entries and workouts per day">
          <div className="-ml-3 h-60">
            <ResponsiveContainer>
              <BarChart data={data.series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={32} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: tk.muted }} />
                <Bar dataKey="foodLogs" name="Food" stackId="a" fill={tk.turmeric} maxBarSize={22} />
                <Bar dataKey="workouts" name="Workouts" stackId="a" fill={tk.jamun} radius={[5, 5, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="When people log" icon={<CalendarClock size={14} className="text-saffron" />} hint="Food + workouts by weekday and hour (IST)">
          <HourHeatmap hours={data.hours} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="How food gets logged" icon={<Mic size={14} className="text-sky" />} hint="Search, typed sentences or voice (signed-in AI logging)">
          <SplitBar parts={[
            { label: "Search", value: data.sources.manual ?? 0, tone: "turmeric" },
            { label: "Sentence", value: data.sources.text ?? 0, tone: "saffron" },
            { label: "Voice", value: data.sources.voice ?? 0, tone: "sky" },
          ]} />
        </Panel>
        <Panel title="All time" className="lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Food entries", k.foodLogsAll, "text-turmeric"],
              ["Workouts", k.workoutsAll, "text-jamun"],
              ["Gym visits (20+ min)", k.visitsAll, "text-leaf"],
            ].map(([label, n, cls]) => (
              <div key={label as string}>
                <p className={`font-display text-2xl font-semibold tabular lg:text-3xl ${cls}`}>{nf(n as number)}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-faint">
            Signed in this week: {nf(k.signedIn7)}. Guests (no account) keep everything on their own phone, so they never show up here.
          </p>
        </Panel>
      </div>
    </div>
  );
}

/** 7 × 24 grid, deeper saffron = more logs in that hour. */
function HourHeatmap({ hours }: { hours: Growth["hours"] }) {
  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const h of hours) g[h.dow][h.hour] += h.n;
    return g;
  }, [hours]);
  const max = Math.max(1, ...grid.flat());
  const peak = useMemo(() => {
    let best = { dow: 0, hour: 0, n: 0 };
    grid.forEach((row, d) => row.forEach((n, h) => { if (n > best.n) best = { dow: d, hour: h, n }; }));
    return best;
  }, [grid]);
  const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

  if (!hours.length) return <p className="py-10 text-center text-sm text-muted">No logs in this period yet.</p>;
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "2.2rem repeat(24, minmax(0, 1fr))" }}>
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="self-center text-[10px] text-faint">{DOW[d]}</span>
            {row.map((n, h) => (
              <motion.span
                key={h}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (d * 24 + h) * 0.002 }}
                title={`${DOW[d]} ${hourLabel(h)}: ${n}`}
                className="aspect-square rounded-[3px]"
                style={{ background: n ? `color-mix(in srgb, var(--color-saffron) ${Math.round(18 + (n / max) * 82)}%, var(--color-surface-2))` : "var(--color-surface-2)" }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[9px] text-faint">{h % 6 === 0 ? hourLabel(h) : ""}</span>
        ))}
      </div>
      {peak.n > 0 && (
        <p className="mt-3 text-xs text-muted">
          Busiest: <span className="font-semibold text-text">{DOW[peak.dow]} around {hourLabel(peak.hour)}</span> ({nf(peak.n)} logs). Good time for reminders.
        </p>
      )}
    </div>
  );
}
