"use client";

import { Drawer } from "vaul";
import { motion } from "motion/react";
import { Check, Lock, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { TIER_NAME, unitOf, type BadgeReport, type FamilyState, type Group, type SpecialState } from "@/lib/badges";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { Medal, TIER_BG, TIER_TEXT } from "./Medal";

const when = (d: string) => {
  const today = dayKey();
  if (d === today) return "today";
  if (d === addDays(today, -1)) return "yesterday";
  return parseDay(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric" });
};
const topTier = (s: FamilyState) => (s.earned.length ? s.earned.length - 1 : null);

/** Hero: how many badges, by metal, the latest ones and what's closest. */
export function Summary({ report, onOpen }: { report: BadgeReport; onOpen: (id: string) => void }) {
  const pct = report.total ? report.earned / report.total : 0;
  const latest = report.unlocks.slice(0, 3);
  const c = report.closest;
  return (
    <section className="card relative overflow-hidden p-5 lg:p-7">
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-turmeric opacity-[0.16] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 right-0 size-72 rounded-full bg-jamun opacity-[0.16] blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div>
          <div className="flex items-end gap-4">
            <motion.span initial={{ rotate: -12, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
              <Medal tier={report.byTier[3] ? 3 : report.byTier[2] ? 2 : report.byTier[1] ? 1 : report.earned ? 0 : null} emoji="🏅" size={84} shine={report.earned > 0} />
            </motion.span>
            <div>
              <p className="font-display text-6xl font-semibold leading-none tabular">
                {report.earned}
                <span className="text-2xl text-muted">/{report.total}</span>
              </p>
              <p className="mt-1 text-sm text-muted">badges earned</p>
            </div>
          </div>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface-3">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-turmeric via-saffron to-jamun"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(pct * 100, report.earned ? 3 : 0)}%` }}
              transition={{ type: "spring", stiffness: 60, damping: 16 }}
            />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {report.byTier.map((n, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-2xl bg-surface-2/70 py-2">
                <Medal tier={n ? i : null} emoji="" size={26} />
                <span className="font-display text-base font-semibold leading-none tabular">{n}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${n ? TIER_TEXT[i] : "text-faint"}`}>{TIER_NAME[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Latest</p>
            {latest.length ? (
              <ul className="mt-2 space-y-1">
                {latest.map((u, i) => (
                  <motion.li key={u.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
                    <button onClick={() => onOpen(u.id.split(":")[0])} className="flex w-full items-center gap-3 rounded-2xl px-1 py-1 text-left hover:bg-surface-2">
                      <Medal tier={u.tier ?? "special"} emoji={u.emoji} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{u.name}</span>
                        <span className={`block text-[11px] font-bold ${u.tier == null ? "text-saffron" : TIER_TEXT[u.tier]}`}>{u.tier == null ? "One-off" : TIER_NAME[u.tier]}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">{when(u.date)}</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Nothing yet. Log a meal or a workout: your first badges are one day away.</p>
            )}
          </div>
          {c && (
            <button onClick={() => onOpen(c.state.def.id)} className="mt-auto flex items-center gap-3 rounded-2xl border border-jamun/30 bg-jamun/[0.07] p-3 text-left hover:bg-jamun/10">
              <Medal tier={null} emoji={c.state.def.emoji} size={46} progress={c.state.value / c.state.next!} />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-jamun">Next up</span>
                <span className="block truncate text-sm font-semibold">
                  {c.state.def.name} · {TIER_NAME[c.state.earned.length]}
                </span>
                <span className="block text-xs text-muted tabular">
                  {c.left} more {unitOf(c.state.def, c.left)} ({c.state.value}/{c.state.next})
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const GROUPS: { id: Group | "special"; title: string; sub: string }[] = [
  { id: "streaks", title: "Streaks", sub: "Your best run ever counts, so a broken streak never takes a badge away" },
  { id: "training", title: "Training", sub: "Showing up, beating yourself, sticking to the plan" },
  { id: "habits", title: "Habits", sub: "The small daily things" },
  { id: "akhada", title: "Akhada", sub: "Challenges, duels and cheers from friends. Join the Akhada to earn these" },
  { id: "special", title: "One-offs", sub: "Little moments worth a medal" },
];

export function BadgeGrid({ report, onOpen }: { report: BadgeReport; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-8">
      {GROUPS.map((g) => (
        <section key={g.id}>
          <div className="mb-3 px-1">
            <h2 className="font-display text-xl font-semibold">{g.title}</h2>
            <p className="text-xs text-muted">{g.sub}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {g.id === "special"
              ? report.specials.map((s, i) => <SpecialCard key={s.def.id} s={s} index={i} onOpen={() => onOpen(s.def.id)} />)
              : report.families.filter((f) => f.def.group === g.id).map((s, i) => <FamilyCard key={s.def.id} s={s} index={i} onOpen={() => onOpen(s.def.id)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function FamilyCard({ s, index, onOpen }: { s: FamilyState; index: number; onOpen: () => void }) {
  const top = topTier(s);
  // same measure as the label under it: value / next target
  const frac = s.next == null ? 1 : s.value / s.next;
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="card group flex flex-col items-center px-3 pb-4 pt-5 text-center"
    >
      <Medal tier={top} emoji={s.def.emoji} size={76} progress={top == null && s.next ? s.value / s.next : 0} />
      <p className="mt-3 font-display text-base font-semibold leading-tight">{s.def.name}</p>
      <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${top == null ? "text-faint" : TIER_TEXT[top]}`}>
        {top == null ? "Locked" : `${TIER_NAME[top]} · ${s.def.tiers[top]} ${unitOf(s.def, s.def.tiers[top])}`}
      </p>
      <div className="mt-3 w-full px-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            className={`h-full rounded-full ${s.next == null ? "bg-gradient-to-r from-sky to-jamun" : "bg-jamun"}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }}
            transition={{ type: "spring", stiffness: 70, damping: 18, delay: 0.1 + index * 0.03 }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted tabular">{s.next == null ? "All four tiers. Legend." : `${s.value} / ${s.next} ${unitOf(s.def, s.next)}`}</p>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {s.def.tiers.map((_, i) => (
          <span key={i} className={`size-1.5 rounded-full ${i < s.earned.length ? TIER_BG[i] : "bg-surface-3"}`} />
        ))}
      </div>
    </motion.button>
  );
}

function SpecialCard({ s, index, onOpen }: { s: SpecialState; index: number; onOpen: () => void }) {
  const got = !!s.date;
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="card flex flex-col items-center px-3 pb-4 pt-5 text-center"
    >
      <Medal tier={got ? "special" : null} emoji={s.def.emoji} size={64} />
      <p className="mt-3 font-display text-[15px] font-semibold leading-tight">{s.def.name}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">{s.def.blurb}</p>
      <p className={`mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${got ? "text-saffron" : "text-faint"}`}>
        {got ? <><Check size={11} strokeWidth={3} /> {when(s.date!)}</> : <><Lock size={10} /> Locked</>}
      </p>
    </motion.button>
  );
}

/** A badge's page: big medal, what it's for, every tier with its date or what's left. */
export function BadgeSheet({ report, id, onClose }: { report: BadgeReport; id: string | null; onClose: () => void }) {
  const fam = report.families.find((f) => f.def.id === id);
  const sp = report.specials.find((s) => s.def.id === id);
  return (
    <Sheet open={!!id && !!(fam || sp)} onClose={onClose} size={id ? "narrow" : undefined}>
      <Drawer.Title className="sr-only">{fam?.def.name ?? sp?.def.name ?? "Badge"}</Drawer.Title>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pb-[calc(1.5rem+var(--safe-bottom))]">
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line text-muted">
            <X size={18} />
          </button>
        </div>
        {fam && <FamilyDetail s={fam} />}
        {sp && <SpecialDetail s={sp} />}
      </div>
    </Sheet>
  );
}

function FamilyDetail({ s }: { s: FamilyState }) {
  const top = topTier(s);
  return (
    <div className="flex flex-col items-center text-center">
      <motion.span initial={{ scale: 0.6, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 13 }}>
        <Medal tier={top} emoji={s.def.emoji} size={132} shine progress={top == null && s.next ? s.value / s.next : 0} />
      </motion.span>
      <h2 className="mt-4 font-display text-3xl font-semibold">{s.def.name}</h2>
      <p className="mt-1 max-w-72 text-sm text-muted">{s.def.blurb}</p>
      <p className="mt-3 rounded-full bg-surface-2 px-3.5 py-1.5 text-sm font-semibold tabular">
        {s.def.from.endsWith("Best") ? "Best run" : "So far"}: {s.value} {unitOf(s.def, s.value)}
      </p>
      <ul className="mt-6 w-full space-y-2 text-left">
        {s.def.tiers.map((t, i) => {
          const date = s.earned[i];
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              className={`flex items-center gap-3 rounded-2xl border p-2.5 ${date ? "border-line bg-surface-2/60" : "border-dashed border-line-strong"}`}
            >
              <Medal tier={date ? i : null} emoji={s.def.emoji} size={44} progress={!date && i === s.earned.length ? s.value / t : 0} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold ${date ? TIER_TEXT[i] : "text-muted"}`}>{TIER_NAME[i]}</span>
                <span className="block text-xs text-muted tabular">{t} {unitOf(s.def, t)}</span>
              </span>
              <span className="shrink-0 text-right text-xs tabular">
                {date ? <span className="flex items-center gap-1 font-semibold text-leaf"><Check size={13} strokeWidth={3} /> {when(date)}</span> : <span className="text-faint">{t - s.value} to go</span>}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function SpecialDetail({ s }: { s: SpecialState }) {
  return (
    <div className="flex flex-col items-center pb-4 text-center">
      <motion.span initial={{ scale: 0.6, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 13 }}>
        <Medal tier={s.date ? "special" : null} emoji={s.def.emoji} size={132} shine />
      </motion.span>
      <h2 className="mt-4 font-display text-3xl font-semibold">{s.def.name}</h2>
      <p className="mt-1 max-w-72 text-sm text-muted">{s.def.blurb}</p>
      <p className={`mt-4 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${s.date ? "bg-saffron/12 text-saffron" : "bg-surface-2 text-muted"}`}>
        {s.date ? <><Check size={14} strokeWidth={3} /> Earned {when(s.date)}</> : <><Lock size={13} /> Not yet</>}
      </p>
    </div>
  );
}
