"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Activity, Dumbbell, LayoutDashboard, PackageSearch, RefreshCw, Server, Swords, UsersRound, UtensilsCrossed } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { FoodTab } from "@/components/admin/FoodTab";
import { Overview } from "@/components/admin/Overview";
import { RequestsTab } from "@/components/admin/RequestsTab";
import { SocialTab } from "@/components/admin/SocialTab";
import { SystemTab } from "@/components/admin/SystemTab";
import { TrainingTab } from "@/components/admin/TrainingTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { Segmented } from "@/components/admin/ui";
import { invalidateAdmin } from "@/lib/admin/api";

type Tab = "overview" | "users" | "food" | "requests" | "training" | "akhada" | "system";
const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: UsersRound },
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "requests", label: "Requests", icon: PackageSearch },
  { id: "training", label: "Training", icon: Dumbbell },
  { id: "akhada", label: "Akhada", icon: Swords },
  { id: "system", label: "System", icon: Server },
];
const RANGES = [
  { v: 7, label: "7d" },
  { v: 30, label: "30d" },
  { v: 90, label: "90d" },
  { v: 365, label: "1y" },
];

/** Admin panel (D51): everyone's Prana, read-only, behind a server-side admin check. */
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96" />}>
      <AdminGate>
        <Admin />
      </AdminGate>
    </Suspense>
  );
}

function Admin() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "overview";
  const [days, setDays] = useState(30);
  const [nonce, setNonce] = useState(0); // bump = refetch everything shown
  const go = (t: Tab) => router.replace(t === "overview" ? "/admin" : `/admin?tab=${t}`, { scroll: false });

  return (
    <div className="space-y-5 lg:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brass">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-leaf" />
            </span>
            Live · Admin
          </p>
          <h1 className="mt-1 font-display text-[2rem] font-semibold leading-tight lg:text-4xl">Control room</h1>
          <p className="text-sm text-muted">Everyone&apos;s Prana at a glance. Read-only; every account you open is logged.</p>
        </div>
        <div className="flex items-center gap-2">
          {tab !== "users" && <Segmented id="admin-range" value={days} options={RANGES} onChange={setDays} size="md" />}
          <button
            onClick={() => {
              invalidateAdmin();
              setNonce((n) => n + 1);
            }}
            aria-label="Refresh"
            className="grid size-9 place-items-center rounded-full border border-line-strong bg-surface text-muted transition-colors hover:text-text"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {/* tabs: scroll sideways on phones, wrap on desktop */}
      <nav className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            aria-pressed={tab === id}
            className={`relative flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === id ? "border-transparent text-bg" : "border-line-strong bg-surface text-muted hover:text-text"
            }`}
          >
            {tab === id && <motion.span layoutId="admin-tab" className="absolute inset-0 rounded-2xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <Icon size={16} className="relative" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </nav>

      <motion.div key={`${tab}-${nonce}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === "overview" && <Overview days={days} />}
        {tab === "users" && <UsersTab />}
        {tab === "food" && <FoodTab days={days} />}
        {tab === "requests" && <RequestsTab days={days} />}
        {tab === "training" && <TrainingTab days={days} />}
        {tab === "akhada" && <SocialTab days={days} />}
        {tab === "system" && <SystemTab days={days} />}
      </motion.div>
    </div>
  );
}
