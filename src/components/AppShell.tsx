"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { initAuth, useAuth } from "@/lib/auth";
import { initGym } from "@/lib/gym/actions";
import { mealForNow } from "@/lib/nutrition";
import { hydrateStore, useStore, useUI } from "@/lib/store";
import { BottomNav } from "./BottomNav";
import { LogSheet } from "./log/LogSheet";
import { QuickAddSheet, openQuickAdd } from "./log/QuickAdd";
import { Sidebar } from "./Sidebar";
import { StorageNotice } from "./StorageNotice";
import { Toaster } from "./Toaster";
import { NearbyBanner } from "./workout/NearbyBanner";
import { PrCelebration } from "./PrCelebration";
import { RestTimer } from "./workout/RestTimer";
import { RoutineSheet } from "./workout/RoutineSheet";
import { WorkoutSheet } from "./workout/WorkoutSheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const hydrated = useStore((s) => s.hydrated);
  const guest = useStore((s) => s.guest);
  // login + OAuth callback render full-screen, without app chrome
  const bare = path === "/login" || path.startsWith("/auth/");

  useEffect(() => {
    // auth needs the local store loaded first: it decides whose data is on this device
    hydrateStore().then(() => {
      initAuth();
      initGym();
    });
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);

  // navigation requested from outside a page (toast buttons, the nearby banner)
  const navTo = useUI((s) => s.navTo);
  useEffect(() => {
    if (!navTo) return;
    useUI.setState({ navTo: null });
    if (location.pathname !== navTo) router.push(navTo);
  }, [navTo, router]);

  // first visit (no account, didn't choose guest mode) → login screen
  useEffect(() => {
    if (hydrated && status === "signedOut" && !guest && !bare) router.replace("/login");
  }, [hydrated, status, guest, bare, router]);

  // keyboard (desktop): / or ⌘K / Ctrl+K opens "Add anything", N the food sheet, W the workout sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (location.pathname === "/login" || location.pathname.startsWith("/auth/")) return;
      const ui = useUI.getState();
      if (ui.sheet || ui.gym || ui.quick || ui.routine) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        return openQuickAdd();
      }
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "/") {
        e.preventDefault();
        openQuickAdd();
      } else if (e.key === "n") {
        e.preventDefault();
        ui.openAdd(mealForNow());
      } else if (e.key === "w") {
        e.preventDefault();
        ui.openGym("strength");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (bare) return <>{children}</>;

  return (
    <>
      <Sidebar />
      <main className="mx-auto w-full max-w-md px-4 pb-[calc(7rem+var(--safe-bottom))] pt-[calc(1rem+var(--safe-top))] md:max-w-2xl md:px-6 lg:ml-64 lg:w-auto lg:max-w-none lg:px-10 lg:py-10">
        <div className="lg:mx-auto lg:max-w-6xl">
          <StorageNotice />
          {children}
        </div>
      </main>
      <BottomNav />
      <LogSheet />
      <WorkoutSheet />
      <QuickAddSheet />
      <RoutineSheet />
      <NearbyBanner />
      <Toaster />
      <PrCelebration />
      <RestTimer />
    </>
  );
}
