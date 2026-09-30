"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ChartLine, HeartPulse, Sprout } from "lucide-react";
import { BodyTab } from "@/components/health/BodyTab";
import { HabitsTab } from "@/components/health/HabitsTab";
import { ProgressTab } from "@/components/health/ProgressTab";

type Tab = "progress" | "body" | "habits";
const TABS: { id: Tab; label: string; icon: typeof ChartLine }[] = [
  { id: "progress", label: "Progress", icon: ChartLine },
  { id: "body", label: "Body", icon: HeartPulse },
  { id: "habits", label: "Habits", icon: Sprout },
];

/** Health (D55): Progress (streaks, weight, calories) · Body (measurements, BP, risk report) · Habits (tobacco, alcohol; opt-in). */
export default function HealthPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="skeleton h-12 w-40" /><div className="skeleton h-12" /><div className="skeleton h-80" /></div>}>
      <Health />
    </Suspense>
  );
}

function Health() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = raw === "body" || raw === "habits" ? raw : "progress";
  const go = (t: Tab) => router.replace(t === "progress" ? "/health" : `/health?tab=${t}`, { scroll: false });

  return (
    <div className="space-y-4 lg:space-y-6">
      <h1 className="font-display text-[2rem] font-semibold leading-tight lg:text-4xl">Health</h1>

      <div role="tablist" aria-label="Health sections" className="flex rounded-2xl border border-line-strong bg-surface p-1 md:max-w-lg">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => go(id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${tab === id ? "text-bg" : "text-muted hover:text-text"}`}
          >
            {tab === id && <motion.span layoutId="health-tab" className="absolute inset-0 rounded-xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <Icon size={16} className="relative" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === "progress" ? <ProgressTab /> : tab === "body" ? <BodyTab /> : <HabitsTab />}
      </motion.div>
    </div>
  );
}
