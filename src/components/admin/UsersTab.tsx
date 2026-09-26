"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Download, Loader2, Search, X } from "lucide-react";
import { adminFetch, download, toCsv, useAdminQuery } from "@/lib/admin/api";
import type { UserList, UserRow, UserSort } from "@/lib/admin/types";
import { dayKey } from "@/lib/dates";
import { Chevron, ErrorState, Segmented, UserAvatar, ago, nf, shortDay } from "./ui";

const SORTS: { v: UserSort; label: string }[] = [
  { v: "active", label: "Last active" },
  { v: "joined", label: "Newest" },
  { v: "logs", label: "Most logs" },
  { v: "name", label: "Name" },
];
const SIZE = 50;
const qs = (q: string, sort: UserSort, page: number, size = SIZE) =>
  `/api/admin/users?${new URLSearchParams({ q, sort, page: String(page), size: String(size) })}`;

export function UsersTab() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<UserSort>("active");
  const [pages, setPages] = useState(1);
  const [exporting, setExporting] = useState(false);
  const first = useAdminQuery<UserList>(qs(q, sort, 0));

  // search as you type, once the typing pauses
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim());
      setPages(1);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  async function exportCsv() {
    setExporting(true);
    const rows: UserRow[] = [];
    for (let page = 0; page < 50; page++) {
      const r = await adminFetch<UserList>(qs(q, sort, page, 200));
      if (!r.ok) break;
      rows.push(...r.data.rows);
      if (rows.length >= r.data.total || !r.data.rows.length) break;
    }
    download(`prana-users-${dayKey()}.csv`, toCsv(rows.map((r) => ({
      id: r.id, name: r.name, email: r.email, joined: r.created_at, last_sign_in: r.last_sign_in_at, last_active: r.last_active,
      food_logs: r.logs, days_logged: r.days, workouts: r.workouts, gym_visits: r.visits, active_days_7: r.active7,
      daily_goal: r.goal, aim: r.aim, akhada_handle: r.handle,
    }))), "text/csv");
    setExporting(false);
  }

  const total = first.data?.total;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex h-11 w-full min-w-0 items-center gap-2 rounded-2xl border border-line-strong bg-surface px-3.5 focus-within:border-turmeric/60 md:w-auto md:max-w-md md:flex-1">
          <Search size={16} className="shrink-0 text-faint" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Name, email or user id"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            data-escape-clears={text ? "" : undefined}
            onKeyDown={(e) => e.key === "Escape" && setText("")}
          />
          {text && <button onClick={() => setText("")} aria-label="Clear search" className="text-faint hover:text-text"><X size={15} /></button>}
        </label>
        <Segmented id="users-sort" value={sort} options={SORTS} onChange={(v) => { setSort(v); setPages(1); }} />
        <button
          onClick={exportCsv}
          disabled={exporting || !total}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-xs font-bold text-muted transition-colors hover:text-text disabled:opacity-50"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} CSV
        </button>
      </div>

      {first.error ? (
        <ErrorState reason={first.error} onRetry={first.reload} />
      ) : (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs text-muted">
            <span>{total == null ? "Loading members…" : `${nf(total)} ${total === 1 ? "member" : "members"}${q ? ` matching “${q}”` : ""}`}</span>
            <span className="hidden lg:inline">Tap a member to see everything they logged</span>
          </div>
          {/* desktop column heads */}
          <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_1fr_0.8fr_0.8fr_0.8fr_0.9fr_1rem] gap-4 border-b border-line px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-faint lg:grid">
            <span>Member</span><span>Joined</span><span>Last active</span><span className="text-right">Food</span>
            <span className="text-right">Workouts</span><span className="text-right">Days</span><span className="text-right">Goal</span><span />
          </div>
          {Array.from({ length: pages }, (_, p) => (
            <UserPage key={`${q}|${sort}|${p}`} q={q} sort={sort} page={p} last={p === pages - 1} onMore={() => setPages(pages + 1)} />
          ))}
        </section>
      )}
    </div>
  );
}

function UserPage({ q, sort, page, last, onMore }: { q: string; sort: UserSort; page: number; last: boolean; onMore: () => void }) {
  const { data, loading } = useAdminQuery<UserList>(qs(q, sort, page));
  if (!data)
    return loading ? (
      <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
    ) : null;
  if (!data.rows.length && page === 0) return <p className="px-5 py-12 text-center text-sm text-muted">No members match that.</p>;
  const more = last && data.total > (page + 1) * SIZE;
  return (
    <>
      <ul className="divide-y divide-line">
        {data.rows.map((u, i) => <UserLine key={u.id} u={u} i={i} />)}
      </ul>
      {more && (
        <div className="border-t border-line p-3 text-center">
          <button onClick={onMore} className="h-9 rounded-full bg-surface-2 px-4 text-xs font-bold text-muted hover:text-text">
            Show more ({nf(data.total - (page + 1) * SIZE)} left)
          </button>
        </div>
      )}
    </>
  );
}

function UserLine({ u, i }: { u: UserRow; i: number }) {
  const today = dayKey();
  const state = u.last_day === today ? { cls: "bg-leaf", label: "Active today" } : u.active7 > 0 ? { cls: "bg-turmeric", label: `${u.active7} of last 7 days` } : { cls: "bg-surface-3", label: "Quiet this week" };
  const name = u.name ?? u.email ?? "Member";
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}>
      <Link
        href={`/admin/u/${u.id}`}
        className="grid grid-cols-[minmax(0,1fr)_1rem] items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60 lg:grid-cols-[minmax(0,2.4fr)_1fr_1fr_0.8fr_0.8fr_0.8fr_0.9fr_1rem] lg:gap-4"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative">
            <UserAvatar url={u.avatar} name={name} size={40} />
            <span title={state.label} className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-surface ${state.cls}`} />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-semibold">{name}</span>
              {u.handle && <span className="shrink-0 rounded-full bg-jamun/15 px-1.5 py-0.5 text-[10px] font-bold text-jamun">@{u.handle}</span>}
            </span>
            <span className="block truncate text-xs text-muted">{u.email}</span>
            {/* phone: the numbers go under the name */}
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-faint lg:hidden tabular">
              <span>{ago(u.last_active)}</span>
              <span><b className="font-semibold text-turmeric">{nf(u.logs)}</b> food</span>
              <span><b className="font-semibold text-jamun">{nf(u.workouts)}</b> workouts</span>
              <span>{nf(u.days)} days</span>
            </span>
          </span>
        </span>
        <span className="hidden text-sm text-muted lg:block">{shortDay(dayKey(new Date(u.created_at)))}</span>
        <span className="hidden text-sm lg:block">
          {ago(u.last_active)}
          <span className="block text-[11px] text-faint">{state.label}</span>
        </span>
        <span className="hidden text-right font-display text-lg font-semibold tabular text-turmeric lg:block">{nf(u.logs)}</span>
        <span className="hidden text-right font-display text-lg font-semibold tabular text-jamun lg:block">{nf(u.workouts)}</span>
        <span className="hidden text-right text-sm tabular lg:block">{nf(u.days)}</span>
        <span className="hidden text-right text-sm tabular lg:block">
          {u.goal ? `${nf(u.goal)}` : <span className="text-faint">default</span>}
          {u.aim && <span className="block text-[11px] capitalize text-faint">{u.aim}</span>}
        </span>
        <Chevron />
      </Link>
    </motion.li>
  );
}
