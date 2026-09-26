"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Medal as MedalIcon, Trophy } from "lucide-react";
import { BadgeGrid, BadgeSheet, Summary } from "@/components/achievements/Badges";
import { RecordsCard } from "@/components/workout/RecordsCard";
import { useStore } from "@/lib/store";
import { useBadges } from "@/lib/useBadges";
import { useRecords } from "@/lib/useRecords";

type Tab = "badges" | "records";

/** Achievements (D38): badges for habits, and every personal record (D36). Derived from the log; nothing stored. */
export default function AchievementsPage() {
  const hydrated = useStore((s) => s.hydrated);
  const report = useBadges();
  const { recent } = useRecords();
  // mounted only after the store loads (skeleton before), so reading the hash here can't mismatch the server HTML
  const [tab, setTab] = useState<Tab>(() => (typeof location !== "undefined" && location.hash === "#records" ? "records" : "badges"));
  const [open, setOpen] = useState<string | null>(null);

  if (!hydrated) return <AchievementsSkeleton />;

  const prSessions = new Set(recent.map((h) => h.workoutId)).size;
  const tabs: { id: Tab; label: string; count: string; icon: typeof Trophy }[] = [
    { id: "badges", label: "Badges", count: `${report.earned}/${report.total}`, icon: MedalIcon },
    { id: "records", label: "Records", count: String(prSessions), icon: Trophy },
  ];

  return (
    <div className="space-y-5 lg:space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Your wins</p>
        <h1 className="font-display text-[2rem] font-semibold leading-tight lg:text-4xl">Achievements</h1>
      </div>

      <Summary report={report} onOpen={setOpen} />

      <div className="flex rounded-2xl border border-line-strong bg-surface p-1 md:max-w-md">
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              history.replaceState(null, "", id === "records" ? "#records" : location.pathname);
            }}
            aria-pressed={tab === id}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${tab === id ? "text-bg" : "text-muted hover:text-text"}`}
          >
            {tab === id && <motion.span layoutId="ach-tab" className="absolute inset-0 rounded-xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <Icon size={16} className="relative" />
            <span className="relative">{label}</span>
            <span className={`relative rounded-full px-1.5 text-[11px] font-bold tabular ${tab === id ? "bg-bg/10" : "bg-surface-2"}`}>{count}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === "badges" ? (
          <BadgeGrid report={report} onOpen={setOpen} />
        ) : (
          <div className="lg:max-w-3xl">
            <RecordsCard full />
          </div>
        )}
      </motion.div>

      <BadgeSheet report={report} id={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function AchievementsSkeleton() {
  return (
    <div className="space-y-5 lg:space-y-7">
      <div className="skeleton h-14 w-56" />
      <div className="skeleton h-72" />
      <div className="skeleton h-12 md:max-w-md" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-52" />)}
      </div>
    </div>
  );
}
