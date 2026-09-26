"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useIsAdmin } from "@/lib/admin/api";

/** Sidebar entry to the admin panel; renders nothing unless the server said this account is an admin (D51). */
export function AdminNavLink() {
  const admin = useIsAdmin();
  const path = usePathname();
  if (!admin) return null;
  const active = path === "/admin" || path.startsWith("/admin/");
  return (
    <Link
      href="/admin"
      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors ${active ? "text-text" : "text-muted hover:bg-surface hover:text-text"}`}
    >
      {active && <motion.span layoutId="side-pill" className="absolute inset-0 rounded-xl bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
      {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-brass" />}
      <ShieldCheck size={19} strokeWidth={2.1} className="relative text-brass" />
      <span className="relative">Admin</span>
    </Link>
  );
}

/** Me page card (phones have no sidebar). */
export function AdminCard() {
  const admin = useIsAdmin();
  if (!admin) return null;
  return (
    <Link href="/admin" className="card flex items-center gap-4 p-5 transition-colors hover:bg-surface-2">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brass/35 to-surface-3 text-brass">
        <ShieldCheck size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold">Admin panel</span>
        <span className="block text-sm text-muted">Members, food, training, Akhada reports, AI usage</span>
      </span>
      <ChevronRight size={18} className="text-faint" />
    </Link>
  );
}
