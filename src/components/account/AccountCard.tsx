"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CloudCheck, CloudOff, LoaderCircle, LogOut, RefreshCw, TriangleAlert } from "lucide-react";
import { signOut, useAuth } from "@/lib/auth";
import { pendingCount, useStore } from "@/lib/store";
import { syncNow } from "@/lib/sync/engine";
import { GoogleButton } from "./GoogleButton";

export function ago(ms: number, now: number) {
  const s = Math.round((now - ms) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Re-renders every 30 s so "2 min ago" stays true. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function SyncStatus() {
  const { sync, lastSyncedAt, syncError } = useAuth();
  const pending = useStore((s) => pendingCount(s.sync));
  const now = useNow();

  if (sync === "syncing")
    return <Line icon={<LoaderCircle size={15} className="animate-spin text-turmeric" />}>Syncing…</Line>;
  if (sync === "offline")
    return <Line icon={<CloudOff size={15} className="text-muted" />}>Offline{pending ? `, ${pending} change${pending === 1 ? "" : "s"} waiting` : ""}</Line>;
  if (sync === "error")
    return <Line icon={<TriangleAlert size={15} className="text-chilli" />}>Sync failed: {syncError}</Line>;
  return (
    <Line icon={<CloudCheck size={15} className="text-leaf" />}>
      {lastSyncedAt ? `Synced ${ago(lastSyncedAt, now)}` : "Connected"}
      {pending > 0 && `, ${pending} waiting`}
    </Line>
  );
}

const Line = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <p className="flex items-center gap-1.5 text-xs text-muted">
    {icon}
    <span className="truncate">{children}</span>
  </p>
);

export function Avatar({ size = 44 }: { size?: number }) {
  const user = useAuth((s) => s.user);
  const url = user?.user_metadata?.avatar_url as string | undefined;
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "?";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- Google avatar, remote host not worth configuring for next/image
    <img src={url} alt="" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full ring-2 ring-line-strong" />
  ) : (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-surface-3 font-display font-semibold">
      {name[0]?.toUpperCase()}
    </span>
  );
}

export function AccountCard() {
  const { status, user } = useAuth();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  if (status === "disabled")
    return (
      <div className="flex gap-3 rounded-2xl bg-surface-2 p-3 text-sm text-muted">
        <CloudOff size={18} className="mt-0.5 shrink-0" />
        <p>Saved on this device only. Sign-in isn&apos;t set up yet: add the Supabase keys to <code>.env.local</code>.</p>
      </div>
    );

  if (status === "loading") return <div className="skeleton h-24" />;

  if (status === "signedOut")
    return (
      <div className="space-y-3">
        <div className="flex gap-3 rounded-2xl bg-surface-2 p-3 text-sm text-muted">
          <CloudOff size={18} className="mt-0.5 shrink-0" />
          <p>You&apos;re using the app without an account, so logs live on this device only. Sign in to back them up and sync with your other devices.</p>
        </div>
        <GoogleButton />
      </div>
    );

  const name = (user?.user_metadata?.full_name as string | undefined) ?? "Signed in";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2.5">
        <SyncStatus />
        <button onClick={() => syncNow()} aria-label="Sync now" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-text">
          <RefreshCw size={15} />
        </button>
      </div>
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={leaving}
        onClick={async () => {
          setLeaving(true);
          await signOut();
          router.replace("/login");
        }}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong font-semibold text-muted hover:text-text disabled:opacity-50"
      >
        {leaving ? <LoaderCircle size={17} className="animate-spin" /> : <LogOut size={17} />} Sign out
      </motion.button>
    </div>
  );
}
