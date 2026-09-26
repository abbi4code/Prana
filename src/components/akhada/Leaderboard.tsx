"use client";

import { Fragment, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Info, ShieldCheck, UserPlus, Users } from "lucide-react";
import { social, failText, type BoardRow, type Period, type Scope } from "@/lib/social/api";
import { useRemote, useSocial } from "@/lib/social/state";
import { CheerButton } from "./People";
import { Avatar } from "./Profile";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
];
const MEDAL = ["🥇", "🥈", "🥉"];

/** The leaderboard (D46): active days (capped) → effort → verified days. Computed by the database. */
export function Leaderboard({ onPerson, onFriends }: { onPerson: (h: string) => void; onFriends: () => void }) {
  const me = useSocial((s) => s.me);
  const [scope, setScope] = useState<Scope>("friends");
  const [period, setPeriod] = useState<Period>("week");
  const [how, setHow] = useState(false);
  const { data: b, result, loading } = useRemote(`board:${scope}:${period}`, () => social.board(scope, period));
  const cap = period.includes("week") ? 6 : 26;
  const mine = b?.rows.find((r) => r.me);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl border border-line-strong bg-surface p-1">
          {(["friends", "global"] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={`relative rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${scope === s ? "text-bg" : "text-muted hover:text-text"}`}
            >
              {scope === s && <motion.span layoutId="lb-scope" className="absolute inset-0 rounded-xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">{s === "friends" ? "Friends" : "Everyone"}</span>
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex flex-1 gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${period === p.id ? "border-transparent bg-turmeric/20 text-turmeric" : "border-line-strong text-muted hover:text-text"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* you */}
      {me && (
        <section className="card relative overflow-hidden p-4">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-saffron opacity-20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <Avatar id={me.avatar} size={48} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{scope === "friends" ? "Among friends" : "Everyone"}</p>
              <p className="font-display text-3xl font-semibold leading-tight tabular">
                {b?.me?.rank ? <>#{b.me.rank}<span className="text-base text-muted"> of {b.total}</span></> : b ? <span className="text-xl">Not ranked yet</span> : " "}
              </p>
            </div>
            {mine && mine.streak > 0 && <span className="text-lg font-semibold tabular">🔥 {mine.streak}</span>}
          </div>
          {me.kudosToday > 0 && (
            <p className="relative mt-2 inline-flex items-center gap-1.5 rounded-full bg-saffron/15 px-3 py-1 text-xs font-semibold text-saffron">
              🙌 {me.kudosToday} Shabaash today
            </p>
          )}
          {b?.me && (
            <div className="relative mt-3">
              <div className="flex gap-1" aria-label={`${b.me.active} of ${cap} active days`}>
                {Array.from({ length: Math.min(cap, 13) }, (_, i) => (
                  <span key={i} className={`h-2 flex-1 rounded-full ${i < Math.round((b.me!.active / cap) * Math.min(cap, 13)) ? "bg-leaf" : "bg-surface-3"}`} />
                ))}
              </div>
              <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted">
                <span><b className="text-text tabular">{b.me.active}</b>/{cap} active days</span>
                <span><b className="text-text tabular">{b.me.effort}</b> effort</span>
                <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-leaf" /><b className="text-text tabular">{b.me.verified}</b> verified</span>
              </p>
            </div>
          )}
          {b && scope === "global" && !b.trusted && (
            <p className="relative mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
              New accounts join the Everyone board after 14 days or 3 GPS-verified gym visits. It keeps throwaway accounts off it. Friends can see you already.
            </p>
          )}
        </section>
      )}

      {scope === "friends" && <TrainedToday />}

      {/* the board */}
      <section className="card overflow-hidden p-2">
        {!b && result && !result.ok ? (
          <p className="p-4 text-sm text-muted">{failText(result)}</p>
        ) : !b ? (
          <div className="space-y-2 p-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-14" />)}</div>
        ) : scope === "friends" && b.rows.length <= 1 ? (
          <div className="p-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted"><Users size={22} /></span>
            <p className="mt-3 font-semibold">It&apos;s just you so far</p>
            <p className="mt-1 text-sm text-muted">Invite friends: you&apos;ll be friends the moment they open your link.</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={onFriends} className="mx-auto mt-4 flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-turmeric to-saffron px-5 text-sm font-bold text-on-accent">
              <UserPlus size={16} /> Invite friends
            </motion.button>
          </div>
        ) : (
          <ol className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
            <AnimatePresence initial={false}>
              {b.rows.map((r, i) => {
                const gap = i > 0 && r.rank != null && b.rows[i - 1].rank != null && r.rank - (b.rows[i - 1].rank ?? 0) > 1 && scope === "global";
                return (
                  <Fragment key={r.handle}>
                    {gap && <li className="py-1 text-center text-xs tracking-[0.4em] text-faint" aria-hidden>···</li>}
                    <Row r={r} cap={cap} tied={b.rows.some((x) => x !== r && x.rank === r.rank && r.rank != null)} onPerson={onPerson} i={i} />
                  </Fragment>
                );
              })}
            </AnimatePresence>
          </ol>
        )}
      </section>

      <button onClick={() => setHow((v) => !v)} className="flex items-center gap-1.5 text-sm text-muted hover:text-text" aria-expanded={how}>
        <Info size={15} /> How ranking works <ChevronDown size={14} className={`transition-transform ${how ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {how && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card space-y-2 p-4 text-sm text-muted">
              <p><b className="text-text">1. Active days.</b> A day counts with a gym visit of 20+ minutes, or a workout of 15+ minutes or 6+ sets. Only 6 a week (26 a month) count, so rest days never cost you.</p>
              <p><b className="text-text">2. Effort.</b> Each counted day scores up to 100: 12 working sets or 30 active minutes is a full day. Fair to every body size.</p>
              <p><b className="text-text">3. Verified gym days</b> (✓, checked by GPS) break ties. Still tied? You share the rank.</p>
              <p>Calories, food and body weight are never ranked. Logs synced more than 2 days late don&apos;t count, and impossible entries are ignored.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ r, cap, tied, onPerson, i }: { r: BoardRow; cap: number; tied: boolean; onPerson: (h: string) => void; i: number }) {
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}>
      <button
        onClick={() => !r.me && onPerson(r.handle)}
        className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors ${r.me ? "bg-turmeric/10 ring-1 ring-turmeric/30" : "hover:bg-surface-2"}`}
      >
        <span className="w-8 shrink-0 text-center font-display text-lg font-semibold tabular text-muted">
          {r.rank == null ? "–" : r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}
          {tied && r.rank != null && r.rank > 3 && <span className="block text-[9px] font-sans font-bold uppercase text-faint">tie</span>}
        </span>
        <Avatar id={r.avatar} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold leading-tight">{r.name}{r.me && <span className="text-muted"> (you)</span>}</span>
          <span className="flex items-center gap-2 text-xs text-muted">
            <span className="truncate">@{r.handle}</span>
            {r.streak > 0 && <span className="shrink-0">🔥 {r.streak}</span>}
            {r.verified > 0 && <span className="flex shrink-0 items-center gap-0.5 text-leaf"><ShieldCheck size={11} />{r.verified}</span>}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-xl font-semibold leading-none tabular">{r.active}<span className="text-xs text-muted">/{cap}</span></span>
          <span className="text-[11px] text-muted tabular">{r.effort} effort</span>
        </span>
      </button>
    </motion.li>
  );
}

/** Friends who trained today (or yesterday): one tap to cheer. Friends who went quiet for 3 days: a nudge. */
function TrainedToday() {
  const { data } = useRemote("friends", () => social.friends());
  const active = (data?.friends ?? []).filter((f) => f.kudosDay);
  const quiet = (data?.friends ?? []).filter((f) => !f.kudosDay && f.canNudge);
  if (!active.length && !quiet.length) return null;
  return (
    <section className="card p-4">
      {active.length > 0 && (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Trained today</p>
          <ul className="no-scrollbar -mx-4 mt-2 flex gap-3 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
            {active.map((f) => (
              <li key={f.handle} className="flex w-28 shrink-0 flex-col items-center gap-1.5 text-center">
                <Avatar id={f.avatar} size={48} />
                <span className="w-full truncate text-xs font-semibold">{f.name.split(" ")[0]}</span>
                <CheerButton f={f} />
              </li>
            ))}
          </ul>
        </>
      )}
      {quiet.length > 0 && (
        <div className={active.length ? "mt-4 border-t border-line pt-3" : ""}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Quiet for 3 days</p>
          <ul className="mt-2 space-y-1.5">
            {quiet.slice(0, 3).map((f) => (
              <li key={f.handle} className="flex items-center gap-2">
                <Avatar id={f.avatar} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                <CheerButton f={f} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
