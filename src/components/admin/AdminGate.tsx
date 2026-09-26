"use client";

import Link from "next/link";
import { LockKeyhole, LogIn } from "lucide-react";
import { useAdminStatus, useIsAdmin } from "@/lib/admin/api";
import { useAuth } from "@/lib/auth";

/**
 * Shows the admin panel only once the server has confirmed this account is an admin (D51). This is a convenience:
 * the real lock is on the server, which checks every /api/admin call.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth((s) => s.status);
  const admin = useIsAdmin();
  const status = useAdminStatus((s) => s.status);

  if (admin) return <>{children}</>;
  if (auth === "loading" || (auth === "signedIn" && (status === "checking" || status === "unknown")))
    return (
      <div className="space-y-4 lg:space-y-6">
        <div className="skeleton h-14 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>
        <div className="skeleton h-80" />
      </div>
    );

  const signedIn = auth === "signedIn";
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brass/30 to-surface-3 text-brass">
          {signedIn ? <LockKeyhole size={24} /> : <LogIn size={24} />}
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold">{signedIn ? "Admins only" : "Sign in to continue"}</h1>
        <p className="mt-2 text-sm text-muted">
          {signedIn
            ? "This area shows every member's data, so it opens only for Prana admins."
            : auth === "disabled"
              ? "This build has no Supabase keys, so there's no server data to show."
              : "Sign in with your admin Google account."}
        </p>
        <Link href={signedIn ? "/" : "/login"} className="mt-6 inline-flex h-11 items-center rounded-2xl bg-cream px-5 text-sm font-bold text-bg">
          {signedIn ? "Back to Today" : "Sign in"}
        </Link>
      </div>
    </div>
  );
}
