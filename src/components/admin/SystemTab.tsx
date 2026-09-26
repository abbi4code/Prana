"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Database, Eye, FileDown, Flag, MapPinned, MessageSquareText, Sparkles, Wallet, Wand2 } from "lucide-react";
import { useAdminQuery } from "@/lib/admin/api";
import type { SystemStats } from "@/lib/admin/types";
import { useTokens } from "@/lib/useTokens";
import { CorrectionList } from "./Corrections";
import { AXIS, BarList, ChartTip, ErrorState, Panel, PanelSkeleton, Stat, ago, bytes, fillDays, nf, pct, shortDay } from "./ui";

/** Cost of one uncached parse on gpt-6-luna, measured when NL logging was built (nl-logging.md "Numbers"). */
const USD_PER_PARSE = 0.0001;
const usd = (n: number) => `$${n === 0 ? "0" : n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;
const ACTION: Record<SystemStats["audit"][number]["action"], { label: string; icon: React.ReactNode }> = {
  view_user: { label: "opened", icon: <Eye size={13} /> },
  export_user: { label: "exported", icon: <FileDown size={13} /> },
  resolve_report: { label: "resolved a report on", icon: <Flag size={13} /> },
};

export function SystemTab({ days }: { days: number }) {
  const { data, error, reload } = useAdminQuery<SystemStats>(`/api/admin/stats?section=system&days=${days}`);
  const tk = useTokens();

  const places = useMemo(() => {
    if (!data) return [];
    const rows = data.api.filter((a) => a.bucket === "places").map((a) => ({ day: a.day, requests: a.requests }));
    return fillDays(data.from, data.to, rows, (day) => ({ day, requests: 0 }));
  }, [data]);

  if (error) return <ErrorState reason={error} onRetry={reload} />;
  if (!data) return <PanelSkeleton />;
  const parse = fillDays(data.from, data.to, data.parse, (day) => ({ day, requests: 0, users: 0 }));
  const requests = data.parse.reduce((t, p) => t + p.requests, 0);
  const served = data.cache.hits + data.cache.entries;
  const tables = data.storage.tables.slice(0, 10);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="AI requests" value={nf(requests)} tone="jamun" icon={<Sparkles size={18} />} sub={<span>sentences + voice, this period</span>} />
        <Stat label="Model calls" value={nf(data.cache.newInPeriod)} tone="saffron" icon={<Wand2 size={18} />} delay={0.04}
          sub={<span>new sentences (the rest came from cache)</span>} />
        <Stat label="AI spend" value={usd(data.cache.newInPeriod * USD_PER_PARSE)} tone="leaf" icon={<Wallet size={18} />} delay={0.08}
          sub={<span>≈ ${USD_PER_PARSE} per new sentence</span>} />
        <Stat label="Cache hit rate" value={`${pct(data.cache.hits, served) ?? 0}%`} tone="sky" icon={<Database size={18} />} delay={0.12}
          sub={<span className="tabular">{nf(data.cache.entries)} cached sentences</span>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
        <Panel title="AI logging per day" icon={<Sparkles size={14} className="text-jamun" />} className="lg:col-span-3" hint="Every request counts, cache hits included (the rate limit counts them too)">
          <div className="-ml-3 h-56">
            <ResponsiveContainer>
              <BarChart data={parse}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                <YAxis {...AXIS} width={32} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                <Bar dataKey="requests" name="Requests" fill={tk.jamun} radius={[5, 5, 1, 1]} maxBarSize={22} />
                <Bar dataKey="users" name="Members" fill={tk.saffron} radius={[5, 5, 1, 1]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Most repeated sentences" icon={<MessageSquareText size={14} className="text-saffron" />} className="lg:col-span-2" hint="Shared cache (no user attached)">
          <BarList tone="saffron" empty="Nothing cached yet" items={data.cache.top.map((t) => ({ key: t.text, label: `“${t.text}”`, value: t.hits, display: `${nf(t.hits)}×` }))} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel title="What people corrected" icon={<Wand2 size={14} className="text-saffron" />}
          hint="Latest fixes on the AI confirm card: add the misses to data/aliases.json or evals/nl-parse.jsonl">
          <CorrectionList showUser items={data.corrections} />
        </Panel>

        <div className="space-y-4 lg:space-y-6">
          <Panel title="Gym place search" icon={<MapPinned size={14} className="text-leaf" />}
            hint={`Geoapify through our server · ${nf(data.places.entries)} cached answers, reused ${nf(data.places.hits)}×`}>
            <div className="-ml-3 h-32">
              <ResponsiveContainer>
                <BarChart data={places}>
                  <XAxis dataKey="day" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
                  <YAxis {...AXIS} width={28} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: tk.faint, fillOpacity: 0.12 }} />
                  <Bar dataKey="requests" name="Searches" fill={tk.leaf} radius={[4, 4, 1, 1]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Storage" icon={<Database size={14} className="text-sky" />} hint={`Database ${bytes(data.storage.database)} in total · rows are Postgres estimates`}>
            <BarList tone="sky" items={tables.map((t) => ({ key: t.table, label: t.table, value: t.bytes, display: bytes(t.bytes), sub: t.rows > 0 ? `≈ ${nf(t.rows)} rows` : undefined }))} />
          </Panel>
        </div>
      </div>

      <Panel title="Admin access log" icon={<Eye size={14} className="text-brass" />} hint="Every time an admin opened or exported a member's data, or resolved a report">
        {data.audit.length ? (
          <ul className="divide-y divide-line">
            {data.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2.5 text-sm first:pt-0 last:pb-0">
                <span className="text-brass">{ACTION[a.action].icon}</span>
                <span className="font-semibold">{a.admin}</span>
                <span className="text-muted">{ACTION[a.action].label}</span>
                {a.target ? (
                  <Link href={`/admin/u/${a.target}`} className="font-semibold underline decoration-line-strong underline-offset-2 hover:decoration-text">{a.targetEmail ?? "a deleted account"}</Link>
                ) : (
                  <span className="text-muted">a report</span>
                )}
                <span className="ml-auto text-xs text-faint">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No admin activity yet.</p>
        )}
      </Panel>
    </div>
  );
}
