"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets, Flame, PackagePlus, Scale, Soup, Target, UtensilsCrossed, UserRoundCog } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { useAdminQuery } from "@/lib/admin/api";
import type { FoodStats } from "@/lib/admin/types";
import { getFood } from "@/lib/foods";
import { MEALS } from "@/lib/nutrition";
import { useTokens } from "@/lib/useTokens";
import { AXIS, BarList, ChartTip, ErrorState, Panel, PanelSkeleton, SplitBar, Stat, nf, pct, shortDay } from "./ui";

export function FoodTab({ days }: { days: number }) {
  const { data, error, reload } = useAdminQuery<FoodStats>(`/api/admin/stats?section=food&days=${days}`);
  const tk = useTokens();
  if (error) return <ErrorState reason={error} onRetry={reload} />;
  if (!data) return <PanelSkeleton />;
  const d = data.days;
  const macroKcal = (d.p ?? 0) * 4 + (d.c ?? 0) * 4 + (d.f ?? 0) * 9;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Avg day" value={nf(d.avgKcal)} unit="kcal" tone="turmeric" icon={<Flame size={18} />}
          sub={<span>vs goals of ~{nf(d.avgGoal)} kcal</span>} />
        <Stat label="On target" value={`${pct(d.on, d.userDays) ?? 0}%`} tone="leaf" icon={<Target size={18} />} delay={0.04}
          sub={<span className="tabular">{nf(d.on)} of {nf(d.userDays)} logged days</span>} />
        <Stat label="Items a day" value={nf(d.avgItems, 1)} tone="saffron" icon={<UtensilsCrossed size={18} />} delay={0.08}
          sub={<span>per member, on days they log</span>} />
        <Stat label="Water" value={nf(data.water.avg, 1)} unit="glasses" tone="sky" icon={<Droplets size={18} />} delay={0.12}
          sub={<span className="tabular">8+ on {nf(data.water.eight)} of {nf(data.water.userDays)} days</span>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <Panel title="The average day vs the goal" icon={<Flame size={14} className="text-turmeric" />} className="lg:col-span-3"
          hint="Mean kcal of members who logged that day, next to their mean goal">
          <div className="-ml-3 h-64">
            <ResponsiveContainer>
              <LineChart data={data.series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={40} tickFormatter={(v: number) => nf(v)} />
                <Tooltip content={<ChartTip unit=" kcal" />} cursor={{ stroke: tk.faint, strokeDasharray: "3 3" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: tk.muted }} />
                <Line dataKey="avgGoal" name="Goal" stroke={tk.leaf} strokeDasharray="5 5" strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="avgKcal" name="Eaten" stroke={tk.turmeric} strokeWidth={3} dot={{ r: 2.5, fill: tk.turmeric, strokeWidth: 0 }} type="monotone" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="How days land" icon={<Target size={14} className="text-leaf" />} className="lg:col-span-2"
          hint="On target = 80–105 % of the member's goal (the streak rule, D24)">
          <SplitBar parts={[
            { label: "Under", value: d.under, tone: "turmeric" },
            { label: "On target", value: d.on, tone: "leaf" },
            { label: "Over", value: d.over, tone: "chilli" },
          ]} />
          <div className="mt-6 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Macros on an average day</p>
            {([
              ["Protein", d.p, 4, "bg-chilli"],
              ["Carbs", d.c, 4, "bg-turmeric"],
              ["Fat", d.f, 9, "bg-saffron"],
            ] as const).map(([label, g, per, cls]) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span className="w-16 text-muted">{label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span className={`block h-full rounded-full ${cls}`} style={{ width: `${macroKcal ? ((g ?? 0) * per * 100) / macroKcal : 0}%` }} />
                </span>
                <span className="w-24 text-right tabular"><b className="font-semibold">{nf(g)} g</b> <span className="text-faint">{macroKcal ? `${Math.round(((g ?? 0) * per * 100) / macroKcal)}%` : ""}</span></span>
              </div>
            ))}
            <p className="text-xs text-faint">Average goal protein: {nf(data.goals.avgProtein)} g.</p>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Top foods" icon={<Soup size={14} className="text-turmeric" />} className="lg:col-span-2" hint="Most logged in this period">
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            {[data.top.slice(0, 10), data.top.slice(10, 20)].map((part, i) => (
              <BarList key={i} max={data.top[0]?.logs} empty={i ? "" : "No food logged in this period"} items={part.map((f) => {
                const food = getFood(f.id);
                return {
                  key: f.id,
                  label: f.name,
                  value: f.logs,
                  sub: `${nf(f.users)} ${f.users === 1 ? "person" : "people"} · ~${nf(Math.round(f.kcal / f.logs))} kcal a log`,
                  icon: food ? <FoodIcon cat={food.cat} size={30} /> : <span className="grid size-[30px] place-items-center rounded-lg bg-surface-3 text-[10px] font-bold text-muted">OWN</span>,
                };
              })} />
            ))}
          </div>
        </Panel>

        <Panel title="Meals" icon={<UtensilsCrossed size={14} className="text-saffron" />} hint="Entries per meal slot">
          <BarList tone="saffron" items={MEALS.map((m) => ({ key: m.id, label: m.label, value: data.meals[m.id] ?? 0 }))} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel title="Catalog gaps" icon={<PackagePlus size={14} className="text-brass" />}
          hint={`Foods people had to create themselves (${nf(data.custom.total)} by ${nf(data.custom.users)} members). Add the common ones to the catalog from a real source (data.md).`}>
          <BarList tone="brass" empty="Nobody has needed a custom food yet" items={data.custom.top.map((c) => ({
            key: c.name, label: c.name, value: c.users, display: `${nf(c.users)}`, sub: `${nf(c.logs)} logs`,
          }))} />
        </Panel>

        <Panel title="Goals & profiles" icon={<UserRoundCog size={14} className="text-leaf" />}
          hint={`${nf(data.goals.rows)} members saved goals; ${nf(data.goals.noProfile)} of them skipped the calculator`}>
          <div className="space-y-5">
            <SplitBar parts={[
              { label: "Lose", value: data.goals.aim.lose, tone: "leaf" },
              { label: "Maintain", value: data.goals.aim.maintain, tone: "sky" },
              { label: "Gain", value: data.goals.aim.gain, tone: "saffron" },
            ]} />
            <SplitBar parts={[
              { label: "Men", value: data.goals.sex.male, tone: "jamun" },
              { label: "Women", value: data.goals.sex.female, tone: "chilli" },
            ]} />
            <div className="grid grid-cols-3 gap-3 border-t border-line pt-4">
              {[
                ["Avg goal", data.goals.avgGoal, "kcal"],
                ["Avg age", data.goals.avgAge, "yrs"],
                ["Avg weight", data.goals.avgWeight, "kg"],
              ].map(([label, v, unit]) => (
                <div key={label as string}>
                  <p className="font-display text-xl font-semibold tabular">{nf(v as number | null, 1)}<span className="ml-1 font-sans text-xs text-muted">{unit}</span></p>
                  <p className="text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Weigh-ins" value={nf(data.misc.weighIns)} tone="brass" icon={<Scale size={18} />} sub={<span>by {nf(data.misc.weighUsers)} members</span>} />
        <Stat label="Thalis saved" value={nf(data.misc.thalis)} tone="saffron" sub={<span>by {nf(data.misc.thaliUsers)} members</span>} />
        <Stat label="Tape measures" value={nf(data.misc.measureUsers)} tone="sky" sub={<span>members tracking body</span>} />
        <Stat label="AI corrections" value={nf(data.misc.corrections)} tone="jamun" sub={<span>fixes on the confirm card (System tab)</span>} />
      </div>
    </div>
  );
}
