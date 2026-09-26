"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeft, BookmarkCheck, Check, Copy, Download, Dumbbell, Flame, Loader2, MapPin, Ruler, Scale, ShieldAlert, Sparkles, Swords,
  Target, Trophy, UserRound, Utensils, Wand2,
} from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { ActivityIcon, ExercisePhoto } from "@/components/workout/ExercisePhoto";
import { adminFetch, download, failText, useAdminQuery } from "@/lib/admin/api";
import type { AdminUserBundle } from "@/lib/admin/types";
import { buildUserModel, type UserModel } from "@/lib/admin/userModel";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { energy } from "@/lib/energy";
import { getExercise } from "@/lib/exercises";
import { getFood } from "@/lib/foods";
import { MEALS } from "@/lib/nutrition";
import { PR_LABEL, formatPr } from "@/lib/records";
import { avatarOf } from "@/lib/social/state";
import { useUI } from "@/lib/store";
import { dayStatus } from "@/lib/streaks";
import type { Profile } from "@/lib/types";
import { useTokens } from "@/lib/useTokens";
import { CorrectionList } from "./Corrections";
import { UserDay } from "./UserDay";
import { AXIS, BarList, ChartTip, Empty, ErrorState, Panel, Segmented, SplitBar, Stat, UserAvatar, ago, longDay, nf, pct, shortDay } from "./ui";

type Range = 30 | 90 | 365 | 0;
const RANGES: { v: Range; label: string }[] = [
  { v: 30, label: "30d" },
  { v: 90, label: "90d" },
  { v: 365, label: "1y" },
  { v: 0, label: "All" },
];
const ACTIVITY: Record<string, string> = { "1.2": "Desk job", "1.375": "Light", "1.55": "Moderate", "1.725": "Very active" };
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function UserDetail({ id }: { id: string }) {
  const { data, error, reload } = useAdminQuery<AdminUserBundle>(`/api/admin/user?id=${id}`);
  const model = useMemo(() => (data ? buildUserModel(data) : null), [data]);
  if (error) return <div className="space-y-4"><Back /><ErrorState reason={error} onRetry={reload} /></div>;
  if (!data || !model) return <DetailSkeleton />;
  return <Detail b={data} m={model} />;
}

function Back() {
  return (
    <Link href="/admin?tab=users" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
      <ArrowLeft size={16} /> All members
    </Link>
  );
}

function Detail({ b, m }: { b: AdminUserBundle; m: UserModel }) {
  const tk = useTokens();
  const [range, setRange] = useState<Range>(30);
  const [day, setDay] = useState<string>(m.activeDays[0] ?? m.today);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const u = b.user;
  const name = u.name ?? u.email ?? "Member";
  const joined = dayKey(new Date(u.createdAt));

  const from = range ? addDays(m.today, -(range - 1)) : (m.firstDay && m.firstDay < joined ? m.firstDay : joined);

  // one row per day in the range: eaten (with macros as kcal), status, burned, water
  const series = useMemo(() => {
    const macro = new Map<string, { p: number; c: number; f: number }>();
    for (const e of m.entries) {
      if (e.date < from || e.date > m.today) continue;
      const x = macro.get(e.date) ?? { p: 0, c: 0, f: 0 };
      x.p += (e.p ?? 0) * 4; x.c += (e.c ?? 0) * 4; x.f += (e.f ?? 0) * 9;
      macro.set(e.date, x);
    }
    const out = [];
    for (let d = from; d <= m.today; d = addDays(d, 1)) {
      const kcal = m.kcalByDay.get(d) ?? 0;
      const mc = macro.get(d);
      out.push({
        day: d, kcal, status: dayStatus(kcal, m.goals.kcal), burn: m.burnByDay.get(d) ?? 0, water: m.water.get(d) ?? 0,
        p: Math.round(mc?.p ?? 0), c: Math.round(mc?.c ?? 0), f: Math.round(mc?.f ?? 0),
      });
    }
    return out;
  }, [m, from]);

  const weights = useMemo(() => {
    const list = m.weights.filter((w) => w.date >= from && w.date <= m.today);
    return list.map((w) => {
      const win = m.weights.filter((x) => x.date >= addDays(w.date, -6) && x.date <= w.date);
      return { day: w.date, kg: w.kg, avg: Math.round((win.reduce((t, x) => t + x.kg, 0) / win.length) * 10) / 10 };
    });
  }, [m, from]);

  const k = useMemo(() => {
    const inRange = (d: string) => d >= from && d <= m.today;
    const logged = series.filter((s) => s.kcal > 0);
    const entries = m.entries.filter((e) => inRange(e.date));
    const workouts = m.workouts.filter((w) => inRange(w.date));
    const visits = m.visits.filter((v) => inRange(v.day));
    const foods = new Map<string, { name: string; n: number; kcal: number; id: string }>();
    for (const e of entries) {
      const f = foods.get(e.foodId) ?? { name: e.name, n: 0, kcal: 0, id: e.foodId };
      f.n++; f.kcal += e.kcal;
      foods.set(e.foodId, f);
    }
    const lifts = new Map<string, { name: string; n: number; sets: number; id: string }>();
    for (const w of workouts) {
      const x = lifts.get(w.refId) ?? { name: w.name, n: 0, sets: 0, id: w.refId };
      x.n++; x.sets += w.sets?.length ?? 0;
      lifts.set(w.refId, x);
    }
    const meals = Object.fromEntries(MEALS.map((ml) => [ml.id, entries.filter((e) => e.meal === ml.id).length]));
    return {
      loggedDays: logged.length,
      avgKcal: logged.length ? Math.round(logged.reduce((t, s) => t + s.kcal, 0) / logged.length) : null,
      onDays: logged.filter((s) => s.status === "on").length,
      entries,
      workouts: workouts.length,
      workoutDays: new Set(workouts.map((w) => w.date)).size,
      visits: visits.filter((v) => v.counted).length,
      verified: visits.filter((v) => v.counted && v.startVerification === "verified").length,
      ai: entries.filter((e) => e.source === "text" || e.source === "voice").length,
      voice: entries.filter((e) => e.source === "voice").length,
      topFoods: [...foods.values()].sort((a, z) => z.n - a.n).slice(0, 8),
      topLifts: [...lifts.values()].sort((a, z) => z.n - a.n).slice(0, 8),
      meals,
      span: series.length,
    };
  }, [m, series, from]);

  const wFirst = weights[0], wLast = weights.at(-1);
  const profile = b.goals?.profile ?? null;
  const e = profile ? energy({ ...profile, activity: profile.activity as Profile["activity"] }, wLast?.avg ?? profile.weightKg) : null;
  const openReports = b.reports.filter((r) => !r.resolved_at).length;

  async function exportJson() {
    setExporting(true);
    const r = await adminFetch<AdminUserBundle>(`/api/admin/user?id=${u.id}&export=1`);
    setExporting(false);
    if (!r.ok) return useUI.getState().showToast(failText(r.reason));
    download(`prana-${(u.email ?? u.id).replace(/[^a-z0-9]+/gi, "-")}-${dayKey()}.json`, JSON.stringify(r.data, null, 2), "application/json");
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <Back />

      {/* who */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-5 lg:p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-saffron/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <UserAvatar url={u.avatar} name={name} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold leading-tight">{name}</h1>
              {b.social && (
                <span className="flex items-center gap-1 rounded-full bg-jamun/15 px-2 py-0.5 text-xs font-bold text-jamun">
                  {avatarOf(b.social.avatar).emoji} @{b.social.handle}
                </span>
              )}
              {openReports > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-chilli/15 px-2 py-0.5 text-xs font-bold text-chilli"><ShieldAlert size={12} /> {openReports} open report{openReports === 1 ? "" : "s"}</span>
              )}
            </div>
            <p className="mt-0.5 truncate text-muted">{u.email}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>Joined <b className="text-text">{longDay(joined)}</b> ({ago(u.createdAt)})</span>
              <span>Last sign-in <b className="text-text">{ago(u.lastSignInAt)}</b></span>
              <span>Last log <b className="text-text">{m.activeDays[0] ? shortDay(m.activeDays[0]) : "never"}</b></span>
              <span className="capitalize">via {u.provider ?? "?"}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => { void navigator.clipboard.writeText(u.id); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-bold text-muted hover:text-text"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "User id"}
            </button>
            <button onClick={exportJson} disabled={exporting} className="flex h-9 items-center gap-1.5 rounded-full bg-cream px-3.5 text-xs font-bold text-bg disabled:opacity-60">
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export data
            </button>
          </div>
        </div>
      </motion.section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{range ? `Last ${range} days` : "Since they joined"}</h2>
        <Segmented id="user-range" value={range} options={RANGES} onChange={setRange} size="md" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Days logged" value={nf(k.loggedDays)} unit={`/ ${k.span}`} tone="turmeric" icon={<Utensils size={18} />}
          sub={<span>{pct(k.loggedDays, k.span) ?? 0}% of days · {nf(k.entries.length)} entries</span>} />
        <Stat label="Avg day" value={nf(k.avgKcal)} unit="kcal" tone="saffron" icon={<Flame size={18} />} delay={0.04}
          sub={<span>goal {nf(m.goals.kcal)}{m.customGoal ? "" : " (default)"} · {pct(k.onDays, k.loggedDays) ?? 0}% on target</span>} />
        <Stat label="Workouts" value={nf(k.workouts)} tone="jamun" icon={<Dumbbell size={18} />} delay={0.08}
          sub={<span>{nf(k.workoutDays)} days · {nf(k.visits)} gym visits{k.visits ? ` (${pct(k.verified, k.visits)}% verified)` : ""}</span>} />
        <Stat label="Streaks now" value={<span>{m.food.current}<span className="text-lg text-muted"> / {m.workout?.current ?? 0}</span></span>} tone="leaf" icon={<Trophy size={18} />} delay={0.12}
          sub={<span>food / workout · best {m.food.best} / {m.workout?.best ?? 0}{m.global ? ` · Prana ${m.global.current}` : ""}</span>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Calories vs goal" icon={<Target size={14} className="text-leaf" />} className="lg:col-span-2"
          hint="Green = on target (80–105 %), yellow = under, red = over · dashed = their goal">
          <div className="-ml-3 h-64">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={40} tickFormatter={(v: number) => nf(v)} domain={[0, (max: number) => Math.max(max, m.goals.kcal) * 1.1]} />
                <Tooltip content={<ChartTip unit=" kcal" />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                <ReferenceLine y={m.goals.kcal} stroke={tk.leaf} strokeDasharray="4 4" />
                <Bar dataKey="kcal" name="Eaten" radius={[5, 5, 1, 1]} maxBarSize={22} onClick={(d: { payload?: { day?: string } }) => d.payload?.day && setDay(d.payload.day)} className="cursor-pointer">
                  {series.map((s) => (
                    <Cell key={s.day} fill={s.status === "on" ? tk.leaf : s.status === "over" ? tk.chilli : tk.turmeric} fillOpacity={s.day === day ? 1 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-faint">Tap a bar to open that day below.</p>
        </Panel>

        <Panel title="Profile & goals" icon={<UserRound size={14} className="text-brass" />}>
          {profile ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Sex", profile.sex === "male" ? "Man" : "Woman"],
                ["Age", `${profile.age}`],
                ["Height", `${profile.heightCm} cm`],
                ["Weight", `${profile.weightKg} kg`],
                ["Activity", ACTIVITY[String(profile.activity)] ?? String(profile.activity)],
                ["Aim", profile.aim.charAt(0).toUpperCase() + profile.aim.slice(1)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-surface-2 px-2 py-2">
                  <p className="text-sm font-semibold">{v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-faint">{l}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">Never used the goal calculator.</p>
          )}
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Daily goal" value={`${nf(m.goals.kcal)} kcal`} />
            <Row label="Protein · carbs · fat" value={`${m.goals.p} · ${m.goals.c} · ${m.goals.f} g`} />
            {e && <Row label="Resting burn (BMR)" value={`~${nf(e.bmr)} kcal`} />}
            {e && <Row label="Maintenance" value={`~${nf(e.tdee)} kcal`} />}
            <Row label="Burn goal" value={m.fitness.burnGoal ? `${m.fitness.burnGoal} kcal` : "none"} />
            <Row label="Rest days" value={m.fitness.restDays.map((d) => WEEKDAY[d]).join(", ") || "none"} />
            <Row label="Location for check-ins" value={b.goals?.location_consent == null ? "never asked" : b.goals.location_consent ? "on" : "off"} />
          </div>
        </Panel>
      </div>

      <UserYear m={m} />

      <UserDay m={m} day={day} onDay={setDay} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel title="Where the calories came from" icon={<Flame size={14} className="text-saffron" />} hint="Protein, carbs and fat per day, in kcal">
          <div className="-ml-3 h-56">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={40} tickFormatter={(v: number) => nf(v)} />
                <Tooltip content={<ChartTip unit=" kcal" />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: tk.muted }} />
                <Bar dataKey="p" name="Protein" stackId="m" fill={tk.chilli} maxBarSize={22} />
                <Bar dataKey="c" name="Carbs" stackId="m" fill={tk.turmeric} maxBarSize={22} />
                <Bar dataKey="f" name="Fat" stackId="m" fill={tk.saffron} radius={[5, 5, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Burn & water" icon={<Dumbbell size={14} className="text-jamun" />} hint="Workout estimate (above resting) and glasses of water">
          <div className="-ml-3 h-56">
            <ResponsiveContainer>
              <BarChart data={series}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis yAxisId="k" {...AXIS} width={36} />
                <YAxis yAxisId="w" orientation="right" {...AXIS} width={24} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: tk.muted }} />
                {m.fitness.burnGoal && <ReferenceLine yAxisId="k" y={m.fitness.burnGoal} stroke={tk.jamun} strokeDasharray="4 4" />}
                <Bar yAxisId="k" dataKey="burn" name="Burned kcal" fill={tk.jamun} radius={[5, 5, 1, 1]} maxBarSize={16} />
                <Bar yAxisId="w" dataKey="water" name="Glasses" fill={tk.sky} radius={[5, 5, 1, 1]} maxBarSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Weight" icon={<Scale size={14} className="text-brass" />}
          hint={wFirst && wLast && wFirst !== wLast ? `${wLast.avg <= wFirst.avg ? "↓" : "↑"} ${Math.abs(Math.round((wLast.avg - wFirst.avg) * 10) / 10)} kg (7-day avg) since ${shortDay(wFirst.day)}` : "7-day average line, dots = weigh-ins"}>
          {weights.length > 1 ? (
            <div className="-ml-3 h-48">
              <ResponsiveContainer>
                <LineChart data={weights}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={24} />
                  <YAxis {...AXIS} width={36} domain={["dataMin - 1", "dataMax + 1"]} tickFormatter={(v: number) => v.toFixed(1)} />
                  <Tooltip content={<ChartTip unit=" kg" />} />
                  <Line dataKey="kg" name="Weigh-in" strokeWidth={0} dot={{ r: 3, fill: tk.muted, strokeWidth: 0 }} isAnimationActive={false} />
                  <Line dataKey="avg" name="7-day avg" stroke={tk.brass} strokeWidth={3} dot={false} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty icon={<Scale size={22} />} text={weights.length ? `One weigh-in: ${weights[0].kg} kg` : "No weigh-ins in this range"} />
          )}
        </Panel>

        <Panel title="Top foods" icon={<Utensils size={14} className="text-turmeric" />}>
          <BarList empty="No food in this range" items={k.topFoods.map((f) => {
            const food = getFood(f.id);
            return {
              key: f.id, label: f.name, value: f.n, display: `${f.n}×`, sub: `~${nf(Math.round(f.kcal / f.n))} kcal each`,
              icon: food ? <FoodIcon cat={food.cat} size={28} /> : <span className="grid size-7 place-items-center rounded-lg bg-surface-3 text-[9px] font-bold text-muted">OWN</span>,
            };
          })} />
        </Panel>

        <Panel title="Top exercises" icon={<Dumbbell size={14} className="text-jamun" />}>
          <BarList tone="jamun" empty="No workouts in this range" items={k.topLifts.map((x) => {
            const ex = getExercise(x.id);
            return {
              key: x.id, label: x.name, value: x.n, display: `${x.n}×`, sub: x.sets ? `${x.sets} sets` : "cardio",
              icon: ex ? <ExercisePhoto ex={ex} className="w-10 shrink-0 rounded-md" /> : <ActivityIcon id={x.id} size={28} />,
            };
          })} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Personal records" icon={<Trophy size={14} className="text-turmeric" />} hint={`${m.records.recent.length} PRs over ${m.records.byRef.size} exercises`}>
          {m.records.recent.length ? (
            <ul className="space-y-2">
              {m.records.recent.slice(0, 6).map((h) => (
                <li key={`${h.workoutId}-${h.kind}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{h.name}</span>
                    <span className="block text-xs text-muted">{PR_LABEL[h.kind]} · {shortDay(h.date)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-turmeric/15 px-2 py-0.5 text-xs font-bold text-turmeric tabular">{formatPr(h.kind, h)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No PRs yet (a first log is only a baseline)" />
          )}
        </Panel>

        <Panel title="How they log" icon={<Sparkles size={14} className="text-saffron" />}>
          <SplitBar parts={[
            { label: "Search", value: k.entries.length - k.ai, tone: "turmeric" },
            { label: "Sentence", value: k.ai - k.voice, tone: "saffron" },
            { label: "Voice", value: k.voice, tone: "sky" },
          ]} />
          <div className="mt-5">
            <BarList tone="saffron" items={MEALS.map((ml) => ({ key: ml.id, label: ml.label, value: k.meals[ml.id] ?? 0 }))} />
          </div>
        </Panel>

        <Panel title="Gym" icon={<MapPin size={14} className="text-leaf" />} hint={m.gyms.length ? undefined : "No gym saved"}>
          {m.gyms.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {m.gyms.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{g.name}</span>
                  <span className="shrink-0 text-xs text-muted">{g.retired ? "old gym" : g.lat != null ? `${g.radiusM} m radius` : "no location"}</span>
                </li>
              ))}
            </ul>
          )}
          {m.visits.length ? (
            <ul className="divide-y divide-line">
              {m.visits.slice(0, 6).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <button onClick={() => setDay(v.day)} className="text-left font-semibold hover:underline">{shortDay(v.day)}</button>
                  <span className="text-muted">{v.minutes != null ? `${v.minutes} min` : "in progress"}{v.status === "auto_closed" ? " · auto-closed" : ""}</span>
                  <span className={`rounded-full px-1.5 py-0.5 font-bold ${v.startVerification === "verified" ? "bg-leaf/15 text-leaf" : "bg-surface-3 text-muted"}`}>
                    {v.startVerification === "verified" ? "✓ verified" : "not verified"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No check-ins.</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Saved by them" icon={<BookmarkCheck size={14} className="text-brass" />}>
          <div className="space-y-4 text-sm">
            <SavedList title="Own foods" items={m.customFoods.map((f) => ({ id: f.id, name: f.name, sub: `${nf(f.kcal)} kcal / 100 g` }))} />
            <SavedList title="Thalis" items={m.meals.map((t) => ({ id: t.id, name: t.name, sub: `${t.items.length} items` }))} />
            <SavedList title="Routines" items={m.routines.map((r) => ({ id: r.id, name: r.name, sub: `${r.items.length} exercises` }))} />
          </div>
        </Panel>

        <Panel title="Body" icon={<Ruler size={14} className="text-sky" />} hint="Tape measurements (progress photos never leave their phone)">
          {m.measurements.length ? (
            <ul className="divide-y divide-line">
              {[...m.measurements].reverse().slice(0, 5).map((ms) => (
                <li key={ms.id} className="py-2 text-xs first:pt-0">
                  <span className="font-semibold">{shortDay(ms.date)}</span>
                  <span className="ml-2 text-muted">{Object.entries(ms.cm).map(([site, cm]) => `${site} ${cm}`).join(" · ")} cm</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No measurements.</p>
          )}
        </Panel>

        <Panel title="Akhada" icon={<Swords size={14} className="text-jamun" />}>
          {b.social ? (
            <div className="space-y-2 text-sm">
              <Row label="Name" value={b.social.display_name} />
              <Row label="Handle" value={`@${b.social.handle}`} />
              <Row label="On the public board" value={b.social.listed ? "yes" : "friends only"} />
              <Row label="Joined the Akhada" value={shortDay(dayKey(new Date(b.social.created_at)))} />
              <Row label="Active days (server, 30 d)" value={`${b.activity.filter((a) => a.active && a.day >= addDays(m.today, -29)).length}`} />
              <Row label="Reports against" value={`${b.reports.length} (${openReports} open)`} />
            </div>
          ) : (
            <p className="text-sm text-muted">Not in the Akhada (profiles are opt-in).</p>
          )}
        </Panel>
      </div>

      <Panel title="AI logging" icon={<Wand2 size={14} className="text-saffron" />}
        hint={`${nf(b.usage.reduce((t, x) => t + x.day_count, 0))} AI requests in the last ${b.usage.length} active days · what they corrected on the confirm card:`}>
        <CorrectionList items={b.corrections.map((c) => ({ id: c.id, raw: c.raw_input, parsed: c.parsed, confirmed: c.confirmed, at: c.created_at }))} />
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </p>
  );
}

function SavedList({ title, items }: { title: string; items: { id: string; name: string; sub: string }[] }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-faint">{title} · {items.length}</p>
      {items.length ? (
        <ul className="space-y-1">
          {items.slice(0, 5).map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span className="truncate">{i.name}</span>
              <span className="shrink-0 text-xs text-muted">{i.sub}</span>
            </li>
          ))}
          {items.length > 5 && <li className="text-xs text-faint">+{items.length - 5} more</li>}
        </ul>
      ) : (
        <p className="text-muted">None</p>
      )}
    </div>
  );
}

/** Their year: food days coloured like the member's own heatmap (D24), workouts in jamun. */
function UserYear({ m }: { m: UserModel }) {
  const [mode, setMode] = useState<"food" | "workout">("food");
  const WEEKS = 53;
  const dow = (parseDay(m.today).getDay() + 6) % 7;
  const start = addDays(m.today, -dow - (WEEKS - 1) * 7);
  const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const cls = (d: string) => {
    if (d > m.today) return "bg-surface-2 opacity-30";
    if (mode === "food") {
      if (m.food.frozen.has(d)) return "bg-sky/80";
      const s = m.food.status.get(d);
      return s === "on" ? "bg-leaf" : s === "under" ? "bg-turmeric/45" : s === "over" ? "bg-chilli/70" : s === "none" ? "bg-surface-3" : "bg-surface-2";
    }
    const j = m.workout?.status.get(d);
    return j === "hit" ? "bg-jamun" : j === "rest" ? "bg-sky/25" : j === "miss" ? "bg-surface-3" : "bg-surface-2";
  };
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Their year</p>
        <Segmented id="user-year" value={mode} options={[{ v: "food", label: "Food" }, { v: "workout", label: "Workout" }]} onChange={setMode} />
      </div>
      <div className="no-scrollbar -mx-5 mt-3 overflow-x-auto px-5">
        <div className="grid w-full min-w-fit gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(10px, 1fr))` }}>
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              <span className="h-4 whitespace-nowrap text-[10px] leading-4 text-faint">
                {parseDay(week[0]).getDate() <= 7 ? parseDay(week[0]).toLocaleDateString("en-IN", { month: "short" }) : ""}
              </span>
              {week.map((d) => (
                <span key={d} title={d} className={`aspect-square w-full rounded-[3px] ${cls(d)} ${d === m.today ? "ring-2 ring-turmeric/70 ring-offset-1 ring-offset-surface" : ""}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {(mode === "food"
          ? [["bg-leaf", "on target"], ["bg-turmeric/45", "under"], ["bg-chilli/70", "over"], ["bg-sky/80", "freeze"], ["bg-surface-3", "not logged"]]
          : [["bg-jamun", "workout"], ["bg-sky/25", "rest day"], ["bg-surface-3", "missed"]]
        ).map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-[3px] ${c}`} />{l}</span>
        ))}
      </div>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="skeleton h-5 w-32" />
      <div className="skeleton h-36" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6"><div className="skeleton h-80 lg:col-span-2" /><div className="skeleton h-80" /></div>
      <div className="skeleton h-48" />
    </div>
  );
}
