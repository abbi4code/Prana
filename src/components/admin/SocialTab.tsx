"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, EyeOff, Flag, Loader2, ShieldAlert, Swords, Trophy, UsersRound } from "lucide-react";
import { adminFetch, failText, invalidateAdmin, useAdminQuery } from "@/lib/admin/api";
import type { SocialStats } from "@/lib/admin/types";
import { avatarOf } from "@/lib/social/state";
import { useUI } from "@/lib/store";
import { useTokens } from "@/lib/useTokens";
import { AXIS, BarList, ChartTip, Empty, ErrorState, Panel, PanelSkeleton, SplitBar, Stat, ago, nf, shortDay, useSvgId } from "./ui";

const REASON: Record<string, string> = { name: "Name / handle", cheating: "Cheating", harassment: "Harassment", spam: "Spam", other: "Other" };

export function SocialTab({ days }: { days: number }) {
  const path = `/api/admin/stats?section=social&days=${days}`;
  const { data, error, reload } = useAdminQuery<SocialStats>(path);
  const tk = useTokens();
  const fill = useSvgId("akhada");
  const [done, setDone] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);

  async function resolve(id: number, target: string) {
    setBusy(id);
    const r = await adminFetch<{ resolved: boolean }>("/api/admin/reports", { method: "POST", body: { id, target } });
    setBusy(null);
    if (!r.ok) return useUI.getState().showToast(failText(r.reason));
    setDone((s) => new Set(s).add(id));
    invalidateAdmin(path);
    useUI.getState().showToast("Report resolved");
  }

  if (error) return <ErrorState reason={error} onRetry={reload} />;
  if (!data) return <PanelSkeleton />;
  const k = data.kpi;
  const reports = data.reports.filter((r) => !done.has(r.id));

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Akhada members" value={nf(k.profiles)} tone="jamun" icon={<UsersRound size={18} />}
          sub={<span className="tabular">{nf(k.listed)} public · +{nf(k.newProfiles)} new</span>} />
        <Stat label="Friendships" value={nf(k.friends)} tone="leaf" icon={<UsersRound size={18} />} delay={0.04}
          sub={<span className="tabular">{nf(k.pending)} pending · {nf(k.blocks)} blocks</span>} />
        <Stat label="Challenges" value={nf(k.challenges)} tone="saffron" icon={<Swords size={18} />} delay={0.08}
          sub={<span className="tabular">{nf(k.states.live ?? 0)} live · {nf(k.members)} joined</span>} />
        <Stat label="Open reports" value={nf(k.reportsOpen - done.size)} tone={k.reportsOpen - done.size ? "chilli" : "leaf"} icon={<Flag size={18} />} delay={0.12}
          sub={<span className="tabular">{nf(k.reportsResolved + done.size)} resolved · {nf(k.disputes)} disputes</span>} />
      </div>

      <Panel title="Moderation queue" icon={<ShieldAlert size={14} className="text-chilli" />}
        hint="Reports stay open until you resolve them. 3 open name / cheating / harassment reports from different people in 60 days hide a member from the global board (D46).">
        {reports.length ? (
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {reports.map((r) => (
                <motion.li key={r.id} layout exit={{ opacity: 0, x: 40, height: 0, marginTop: 0 }} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/60 p-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-chilli/15 px-2 py-0.5 text-[11px] font-bold text-chilli">{REASON[r.reason] ?? r.reason}</span>
                      <span className="font-semibold">@{r.targetHandle ?? "left the Akhada"}</span>
                      <span className="truncate text-xs text-muted">{r.targetName} · {r.targetEmail}</span>
                      {r.hidden && (
                        <span className="flex items-center gap-1 rounded-full bg-turmeric/15 px-2 py-0.5 text-[11px] font-bold text-turmeric"><EyeOff size={11} /> hidden from board</span>
                      )}
                    </div>
                    {r.note && <p className="mt-1.5 text-sm">&ldquo;{r.note}&rdquo;</p>}
                    <p className="mt-1 text-xs text-faint">
                      by @{r.reporterHandle ?? "someone"} · {ago(r.at)} · {r.openAgainst} open against them{r.challenge ? " · in a challenge" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/admin/u/${r.target}`} className="flex h-9 items-center rounded-full border border-line-strong px-3.5 text-xs font-bold text-muted hover:text-text">
                      Open member
                    </Link>
                    <button onClick={() => resolve(r.id, r.target)} disabled={busy === r.id} className="flex h-9 items-center gap-1.5 rounded-full bg-cream px-3.5 text-xs font-bold text-bg disabled:opacity-60">
                      {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} Resolve
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <Empty icon={<Check size={22} />} text="Nothing to review. The Akhada is behaving." />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <Panel title="Active days (server-counted)" icon={<Trophy size={14} className="text-leaf" />} className="lg:col-span-3"
          hint="From synced workouts + gym visits, with the 48 h backdating limit (activity_days)">
          <div className="-ml-3 h-56">
            <ResponsiveContainer>
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tk.jamun} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={tk.jamun} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={28} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: tk.faint, strokeDasharray: "3 3" }} />
                <Area dataKey="active" name="Active" type="monotone" stroke={tk.jamun} strokeWidth={2.5} fill={`url(#${fill})`} />
                <Area dataKey="verified" name="GPS-verified" type="monotone" stroke={tk.leaf} strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {k.flagged > 0 && <p className="mt-2 text-xs text-turmeric">{nf(k.flagged)} logged sets/sessions were ignored as implausible in this period.</p>}
        </Panel>
        <Panel title="Most active" icon={<Trophy size={14} className="text-turmeric" />} className="lg:col-span-2" hint="By active days in this period">
          <BarList tone="jamun" empty="No Akhada activity yet" items={data.top.map((p) => {
            const av = avatarOf(p.avatar);
            return {
              key: p.user, href: `/admin/u/${p.user}`, label: p.name, value: p.active, display: `${p.active} d`,
              sub: `@${p.handle} · ${nf(p.verified)} verified`,
              icon: <span className={`grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br ${av.tone} text-base`}>{av.emoji}</span>,
            };
          })} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Challenge types" icon={<Swords size={14} className="text-saffron" />}>
          <SplitBar parts={[
            { label: "Lift", value: k.kinds.lift ?? 0, tone: "jamun" },
            { label: "Days", value: k.kinds.days ?? 0, tone: "leaf" },
            { label: "Minutes", value: k.kinds.minutes ?? 0, tone: "sky" },
            { label: "Team", value: k.kinds.team_minutes ?? 0, tone: "saffron" },
          ]} />
          {data.duels && (
            <p className="mt-5 border-t border-line pt-4 text-sm">
              <span className="font-display text-2xl font-semibold tabular">{nf(data.duels.total)}</span> duels
              <span className="text-muted"> · {nf(data.duels.active)} live · {nf(data.duels.settled)} settled · {nf(data.duels.pending)} waiting</span>
            </p>
          )}
        </Panel>
        <Panel title="Latest challenges" icon={<Swords size={14} className="text-saffron" />} className="lg:col-span-2">
          {data.challenges.length ? (
            <ul className="divide-y divide-line">
              {data.challenges.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.title}</span>
                    <span className="block text-xs text-muted">
                      {c.kind.replace("_", " ")} · {c.audience === "open" ? "open to all" : "invite"} · {shortDay(c.startsOn)}–{shortDay(c.endsOn)} · by @{c.creator ?? "?"}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular ${c.cancelled ? "bg-surface-3 text-faint" : "bg-jamun/15 text-jamun"}`}>
                    {c.cancelled ? "cancelled" : `${c.members} in`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No challenges yet" />
          )}
        </Panel>
      </div>
    </div>
  );
}
