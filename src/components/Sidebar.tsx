"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { CloudOff, Dumbbell, LogIn, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar, SyncStatus } from "./account/AccountCard";
import { APP_NAME } from "@/lib/app";
import { mealForNow } from "@/lib/nutrition";
import { useUI } from "@/lib/store";
import { NAV_TABS, isActive } from "./BottomNav";
import { openQuickAdd } from "./log/QuickAdd";

/** Desktop navigation (lg and up). Phones use BottomNav. */
export function Sidebar() {
  const path = usePathname();
  const openAdd = useUI((s) => s.openAdd);
  const openGym = useUI((s) => s.openGym);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg/60 px-5 py-8 backdrop-blur-xl lg:flex">
      <Link href="/" className="flex items-center gap-3 px-2">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-turmeric to-saffron shadow-[0_8px_24px_-8px_rgb(255_138_61/0.7)]">
          <svg viewBox="0 0 100 100" className="size-7" aria-hidden>
            <ellipse cx="50" cy="40" rx="38" ry="9" fill="#15100d" />
            <ellipse cx="50" cy="37" rx="30" ry="5" fill="#fff4e4" opacity="0.9" />
            <path d="M12,40 C13,66 30,80 50,80 C70,80 87,66 88,40 C76,50 24,50 12,40 Z" fill="#15100d" />
          </svg>
        </span>
        <span className="font-display text-2xl font-semibold">{APP_NAME}</span>
      </Link>

      <button
        onClick={() => openQuickAdd()}
        className="mt-8 flex h-11 items-center gap-2 rounded-2xl border border-line-strong bg-surface px-3.5 text-sm text-muted transition-colors hover:border-turmeric/50 hover:text-text"
      >
        <Search size={16} /> <span className="flex-1 text-left">Add anything…</span>
        <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 font-sans text-xs">/</kbd>
      </button>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => openAdd(mealForNow())}
        className="mt-2 flex h-12 items-center justify-between rounded-2xl bg-gradient-to-r from-turmeric to-saffron px-4 font-bold text-on-accent shadow-[0_10px_30px_-10px_rgb(255_138_61/0.6)] transition-[filter] hover:brightness-110"
      >
        <span className="flex items-center gap-2">
          <Plus size={19} strokeWidth={2.6} /> Log food
        </span>
        <kbd className="rounded-md bg-bg/15 px-1.5 py-0.5 font-sans text-xs">N</kbd>
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => openGym("strength")}
        className="mt-2 flex h-11 items-center justify-between rounded-2xl border border-line-strong px-4 font-semibold transition-colors hover:border-jamun/50 hover:bg-surface"
      >
        <span className="flex items-center gap-2">
          <Dumbbell size={17} className="text-jamun" /> Log workout
        </span>
        <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-sans text-xs text-muted">W</kbd>
      </motion.button>

      <nav className="mt-6 flex flex-col gap-1">
        {NAV_TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                active ? "text-text" : "text-muted hover:bg-surface hover:text-text"
              }`}
            >
              {active && (
                <motion.span layoutId="side-pill" className="absolute inset-0 rounded-xl bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
              )}
              {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-turmeric" />}
              <Icon size={19} strokeWidth={2.1} className="relative" />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <AccountFooter />
      </div>
    </aside>
  );
}

function AccountFooter() {
  const { status, user } = useAuth();
  if (status === "signedIn")
    return (
      <Link href="/me" className="flex items-center gap-3 rounded-2xl border border-line p-3 transition-colors hover:bg-surface">
        <Avatar size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{(user?.user_metadata?.full_name as string | undefined) ?? user?.email}</p>
          <SyncStatus />
        </div>
      </Link>
    );
  if (status === "signedOut")
    return (
      <Link href="/login" className="flex items-center gap-2.5 rounded-2xl border border-line p-3 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-text">
        <LogIn size={16} /> Sign in to sync
      </Link>
    );
  return (
    <div className="flex gap-2.5 rounded-2xl border border-line p-3 text-xs leading-relaxed text-faint">
      <CloudOff size={15} className="mt-0.5 shrink-0" />
      {status === "loading" ? "Checking account…" : "Saved in this browser only."}
    </div>
  );
}
