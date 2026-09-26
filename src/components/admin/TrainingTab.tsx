"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Dumbbell, Flame, ListChecks, MapPin, Timer, Trophy } from "lucide-react";
import { ActivityIcon, ExercisePhoto } from "@/components/workout/ExercisePhoto";
import { useAdminQuery } from "@/lib/admin/api";
import type { TrainingStats } from "@/lib/admin/types";
import { GROUP_LABEL, getActivity, getExercise } from "@/lib/exercises";
import type { MuscleGroup } from "@/lib/types";
import { useTokens } from "@/lib/useTokens";
import { AXIS, BarList, ChartTip, ErrorState, Panel, PanelSkeleton, SplitBar, Stat, fillDays, nf, pct, shortDay } from "./ui";

export function TrainingTab({ days }: { days: number }) {
  const { data, error, reload } = useAdminQuery<TrainingStats>(`/api/admin/stats?section=training&days=${days}`);
  const tk = useTokens();

  // sets per muscle group, from the catalog (the database only knows exercise ids)
  const groups = useMemo(() => {
    const m = new Map<MuscleGroup, number>();
    for (const r of data?.refs ?? []) {
      if (r.kind !== "lift") continue;
      const g = getExercise(r.ref)?.group;
      if (g) m.set(g, (m.get(g) ?? 0) + r.sets);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (error) return <ErrorState reason={error} onRetry={reload} />;
  if (!data) return <PanelSkeleton />;
  const t = data.totals;
  const g = data.gym;
  const lifts = data.refs.filter((r) => r.kind === "lift").slice(0, 10);
  const cardio = data.refs.filter((r) => r.kind === "cardio").sort((a, b) => b.minutes - a.minutes).slice(0, 8);
  const visits = fillDays(data.from, data.to, g.series, (day) => ({ day, n: 0, verified: 0 })).map((x) => ({ ...x, other: x.n - x.verified }));
  const v = g.verification;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Workouts" value={nf(t.workouts)} tone="jamun" icon={<Dumbbell size={18} />}
          sub={<span className="tabular">{nf(t.lifts)} lifts · {nf(t.cardio)} cardio</span>} />
        <Stat label="Training members" value={nf(t.users)} tone="leaf" icon={<Activity size={18} />} delay={0.04}
          sub={<span className="tabular">{nf(t.userDays)} training days</span>} />
        <Stat label="Sets" value={nf(t.sets)} tone="saffron" icon={<ListChecks size={18} />} delay={0.08}
          sub={<span className="tabular">{nf(t.cardioMinutes)} min of cardio</span>} />
        <Stat label="Burned" value={`~${nf(t.kcal)}`} unit="kcal" tone="chilli" icon={<Flame size={18} />} delay={0.12}
          sub={<span>estimate, above resting (D27)</span>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <Panel title="Workouts per day" icon={<Dumbbell size={14} className="text-jamun" />} className="lg:col-span-3">
          <div className="-ml-3 h-60">
            <ResponsiveContainer>
              <BarChart data={data.series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={32} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: tk.muted }} />
                <Bar dataKey="lifts" name="Lifts" stackId="w" fill={tk.jamun} maxBarSize={22} />
                <Bar dataKey="cardio" name="Cardio" stackId="w" fill={tk.sky} radius={[5, 5, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Sets by muscle group" icon={<Activity size={14} className="text-jamun" />} className="lg:col-span-2">
          <BarList tone="jamun" empty="No lifting in this period" items={groups.map(([grp, sets]) => ({ key: grp, label: GROUP_LABEL[grp], value: sets, display: `${nf(sets)}` }))} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel title="Top exercises" icon={<Trophy size={14} className="text-turmeric" />} hint="Most logged lifts">
          <BarList tone="jamun" empty="No lifting in this period" items={lifts.map((r) => {
            const ex = getExercise(r.ref);
            return {
              key: r.ref, label: ex?.name ?? r.name, value: r.logs,
              sub: `${nf(r.users)} ${r.users === 1 ? "person" : "people"} · ${nf(r.sets)} sets`,
              icon: ex ? <ExercisePhoto ex={ex} className="w-12 shrink-0 rounded-lg" /> : undefined,
            };
          })} />
        </Panel>
        <Panel title="Cardio & sport" icon={<Timer size={14} className="text-sky" />} hint="By total minutes">
          <BarList tone="sky" empty="No cardio in this period" items={cardio.map((r) => ({
            key: r.ref, label: getActivity(r.ref)?.name ?? r.name, value: r.minutes, display: `${nf(r.minutes)} min`,
            sub: `${nf(r.logs)} sessions · ${nf(r.users)} ${r.users === 1 ? "person" : "people"}`,
            icon: <ActivityIcon id={r.ref} size={30} />,
          }))} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <Panel title="Gym check-ins" icon={<MapPin size={14} className="text-leaf" />} className="lg:col-span-3"
          hint="Visits of 20+ minutes count as workout days (D30)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Visits", g.visits, ""],
              ["Counted", g.counted, `${pct(g.counted, g.visits) ?? 0}%`],
              ["Avg length", g.avgMin, "min"],
              ["Checked in now", g.open, ""],
            ].map(([label, n, extra]) => (
              <div key={label as string} className="rounded-2xl bg-surface-2 p-3">
                <p className="font-display text-2xl font-semibold tabular">{nf(n as number | null)}<span className="ml-1 font-sans text-xs text-muted">{extra}</span></p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="-ml-3 mt-4 h-36">
            <ResponsiveContainer>
              <BarChart data={visits}>
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                <Bar dataKey="verified" name="Verified" stackId="v" fill={tk.leaf} maxBarSize={18} />
                <Bar dataKey="other" name="Not verified" stackId="v" fill={tk.faint} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-4">
            <SplitBar parts={[
              { label: "Verified", value: v.verified ?? 0, tone: "leaf" },
              { label: "No location", value: (v.not_checked ?? 0) + (v.permission_denied ?? 0) + (v.unavailable ?? 0), tone: "muted" },
              { label: "Too far", value: v.outside_radius ?? 0, tone: "chilli" },
              { label: "Fuzzy GPS", value: v.low_accuracy ?? 0, tone: "turmeric" },
            ]} />
            <p className="text-xs text-faint">
              {nf(g.status.auto_closed ?? 0)} closed automatically (forgot to tap Done) · {nf(g.source.web_offline ?? 0)} saved offline · {nf(g.failedChecks)} location checks said &ldquo;try again&rdquo;
            </p>
          </div>
        </Panel>

        <Panel title="Setup & habits" icon={<ListChecks size={14} className="text-saffron" />} className="lg:col-span-2">
          <ul className="space-y-3 text-sm">
            {[
              ["Gyms saved", data.misc.gyms, `${nf(data.misc.gymsLocated)} with a location · ${nf(data.misc.gymsSearched)} via search`],
              ["Location consent", data.misc.consentOn, `${nf(data.misc.consentOff)} turned it off`],
              ["Routines", data.misc.routines, `by ${nf(data.misc.routineUsers)} members`],
              ["Logged from a routine", t.fromRoutine, `${pct(t.fromRoutine, t.workouts) ?? 0}% of workouts`],
              ["Logged at the gym", t.atGym, `${pct(t.atGym, t.workouts) ?? 0}% during a check-in`],
              ["Daily burn goal set", data.misc.burnGoalUsers, "members"],
            ].map(([label, n, sub]) => (
              <li key={label as string} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-xs text-muted">{sub}</span>
                </span>
                <span className="font-display text-2xl font-semibold tabular">{nf(n as number)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
