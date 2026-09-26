"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { HardDriveDownload, Share, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isStandalone, platform } from "@/lib/gym/location";
import { useSaveHealth } from "@/lib/localSave";
import { useStore, useUI } from "@/lib/store";

const IOS_HINT_KEY = "prana-ios-hint";
const IOS_HINT_SNOOZE_DAYS = 14;

/**
 * Keeps people from losing logs on this device (architecture.md "Local storage"):
 * - saving failed (storage full / blocked): says so, and what it means for guests vs signed-in people
 * - an iPhone guest in a Safari tab: Safari deletes a site's data after 7 days away (home-screen apps are exempt),
 *   so suggest Add to Home Screen or signing in
 */
export function StorageNotice() {
  const health = useSaveHealth((s) => s.status);
  const auth = useAuth((s) => s.status);
  const hydrated = useStore((s) => s.hydrated);
  const hasData = useStore((s) => s.entries.length > 0 || s.workouts.length > 0);
  const [iosHint, setIosHint] = useState(false);
  const guest = auth !== "signedIn";

  // decided after mount: platform, install state and the snooze live in the browser
  useEffect(() => {
    const t = setTimeout(() => {
      let snoozed = false;
      try {
        snoozed = Date.now() - Number(localStorage.getItem(IOS_HINT_KEY) ?? 0) < IOS_HINT_SNOOZE_DAYS * 86_400_000;
      } catch {}
      setIosHint(platform() === "ios" && !isStandalone() && !snoozed);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const dismissIos = () => {
    try {
      localStorage.setItem(IOS_HINT_KEY, String(Date.now()));
    } catch {}
    setIosHint(false);
  };

  const failing = health !== "ok";
  // the banner sits at the top of the page: also say it where the person is looking, once per failure
  useEffect(() => {
    if (!failing) return;
    useUI.getState().showToast(guest ? "Couldn't save on this device. Sign in to keep your logs." : "This device's storage is full. Your logs are safe in your account.");
  }, [failing, guest]);
  const showIos = !failing && iosHint && guest && hydrated && hasData;

  return (
    <AnimatePresence initial={false}>
      {failing ? (
        <motion.div key="fail" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-chilli/40 bg-chilli/10 p-4 text-sm">
            <HardDriveDownload size={20} className="mt-0.5 shrink-0 text-chilli" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{health === "full" ? "This device's storage for Prana is full" : "Prana can't save on this device"}</p>
              {guest ? (
                <p className="mt-0.5 text-muted">New logs are kept only until you close the app. Sign in to save them to your account; nothing you logged is lost if you do it now.</p>
              ) : (
                <p className="mt-0.5 text-muted">Your logs are safe in your account and keep syncing. This device just can&apos;t keep its offline copy up to date, so stay online for now.</p>
              )}
              {guest && auth !== "disabled" && (
                <Link href="/login" className="mt-2 inline-flex h-9 items-center rounded-xl bg-cream px-3 text-xs font-bold text-bg">Sign in and keep my logs</Link>
              )}
            </div>
          </div>
        </motion.div>
      ) : showIos ? (
        <motion.div key="ios" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-line-strong bg-surface p-4 text-sm">
            <Share size={20} className="mt-0.5 shrink-0 text-sky" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Keep your logs on this iPhone</p>
              <p className="mt-0.5 text-muted">
                Safari clears a website&apos;s data if you don&apos;t open it for 7 days. Add Prana to your Home Screen (Share → Add to Home Screen){auth !== "disabled" ? " or sign in" : ""} and your logs stay.
              </p>
              {auth !== "disabled" && <Link href="/login" className="mt-2 inline-flex h-9 items-center rounded-xl bg-cream px-3 text-xs font-bold text-bg">Sign in</Link>}
            </div>
            <button onClick={dismissIos} aria-label="Dismiss" className="grid size-8 shrink-0 place-items-center rounded-full text-faint hover:text-text">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
