"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Trophy } from "lucide-react";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { PR_LABEL, formatGain, formatPr, headline } from "@/lib/records";
import { useRecords } from "@/lib/useRecords";
import { ItemThumb } from "./Routines";

const ago = (d: string, today = dayKey()) => {
  if (d === today) return "today";
  if (d === addDays(today, -1)) return "yesterday";
  const days = Math.round((parseDay(today).getTime() - parseDay(d).getTime()) / 86_400_000);
  return days < 30 ? `${days} days ago` : parseDay(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/** Personal records (workouts.md "PRs"): the latest ones you set, and every exercise's best on request. */
/** `full` (Achievements page): more recent PRs and every exercise listed open. */
export function RecordsCard({ full = false }: { full?: boolean }) {
  const { recent, byRef } = useRecords();
  const [all, setAll] = useState(full);
  const today = dayKey();
  const monthAgo = addDays(today, -30);
  // sessions that set at least one PR (a heavier set is often also a best set: count it once)
  const thisMonth = new Set(recent.filter((h) => h.date >= monthAgo).map((h) => h.workoutId)).size;
  // one line per exercise: its newest PR, the most meaningful kind of that session (recent keeps PR_ORDER within a log)
  const latest = useMemo(() => {
    const out = new Map<string, (typeof recent)[number]>();
    for (const h of recent) if (!out.has(h.refId)) out.set(h.refId, h);
    return [...out.values()].slice(0, full ? 8 : 4);
  }, [recent, full]);
  const exercises = useMemo(
    () => [...byRef.values()].filter((r) => headline(r)).sort((a, b) => (a.lastDate === b.lastDate ? b.sessions - a.sessions : a.lastDate < b.lastDate ? 1 : -1)),
    [byRef],
  );

  return (
    <section className="card relative overflow-hidden p-5">
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-14 size-48 rounded-full bg-turmeric opacity-20 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
          <Trophy size={13} className="text-turmeric" /> Personal records
        </p>
        {thisMonth > 0 && (
          <span className="rounded-full bg-turmeric/15 px-2.5 py-1 text-[11px] font-bold text-turmeric tabular">{thisMonth} this month</span>
        )}
      </div>

      {latest.length ? (
        <ul className="relative mt-3 space-y-1">
          {latest.map((h, i) => (
            <motion.li key={h.workoutId + h.kind} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-3 rounded-2xl py-1.5">
              <span className="relative">
                <ItemThumb item={{ kind: byRef.get(h.refId)?.kind ?? "lift", refId: h.refId }} size={44} className="rounded-xl" />
                <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-gradient-to-br from-turmeric to-saffron text-on-accent ring-2 ring-surface">
                  <Trophy size={10} strokeWidth={2.6} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{h.name}</span>
                <span className="block truncate text-xs text-muted">{PR_LABEL[h.kind]} · {ago(h.date, today)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-base font-semibold tabular">{formatPr(h.kind, h)}</span>
                <span className="block text-[11px] font-bold text-leaf tabular">{formatGain(h)}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      ) : (
        <p className="relative mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">
          {exercises.length
            ? "Your first sessions are your baseline. Beat one and it shows up here with a trophy."
            : "Log an exercise, then beat it next time: heavier, more reps or longer. PRs are spotted automatically."}
        </p>
      )}

      {exercises.length > 0 && (
        <>
          <button
            onClick={() => setAll(!all)}
            aria-expanded={all}
            className="relative mt-3 flex w-full items-center justify-between rounded-2xl bg-surface-2 px-4 py-2.5 text-sm font-semibold hover:bg-surface-3"
          >
            Best for every exercise · {exercises.length}
            <motion.span animate={{ rotate: all ? 180 : 0 }} className="grid place-items-center text-muted">
              <ChevronDown size={17} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {all && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="relative overflow-hidden"
              >
                {exercises.map((r) => {
                  const top = headline(r)!;
                  const e1 = r.best.e1rm;
                  return (
                    <li key={r.refId} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                      <ItemThumb item={{ kind: r.kind, refId: r.refId }} size={36} className="rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{r.name}</span>
                        <span className="block text-[11px] text-faint tabular">{r.sessions} {r.sessions === 1 ? "session" : "sessions"} · {PR_LABEL[top.kind].toLowerCase()}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-display text-sm font-semibold tabular">{formatPr(top.kind, top.best)}</span>
                        {e1 && top.kind !== "e1rm" && <span className="block text-[11px] text-muted tabular">1RM ~{formatPr("e1rm", e1)}</span>}
                      </span>
                    </li>
                  );
                })}
              </motion.ul>
            )}
          </AnimatePresence>
          <p className="relative mt-3 text-[11px] leading-relaxed text-faint">
            Spotted automatically from your logs. Est. 1-rep max uses the Brzycki formula on sets of 10 reps or fewer, where it&apos;s most accurate; treat it as a guide, not a test.
          </p>
        </>
      )}
    </section>
  );
}
