"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseEnabled } from "./supabase";
import { EMPTY_QUEUE, useStore } from "./store";
import { scheduleSync, syncNow } from "./sync/engine";

type SyncState = "idle" | "syncing" | "error" | "offline";

type Auth = {
  /** disabled = no Supabase keys configured, app runs local-only */
  status: "disabled" | "loading" | "signedOut" | "signedIn";
  user: User | null;
  sync: SyncState;
  lastSyncedAt: number | null;
  syncError: string | null;
};

export const useAuth = create<Auth>(() => ({
  status: supabaseEnabled ? "loading" : "disabled",
  user: null,
  sync: "idle",
  lastSyncedAt: null,
  syncError: null,
}));

/** When an account signs in, the data on this device is attached to it. */
function adoptLocalData(userId: string) {
  const s = useStore.getState();
  if (s.sync.userId === userId) return;
  if (s.sync.userId === null) {
    // guest data → push everything into the account
    useStore.setState({
      guest: false,
      sync: {
        ...EMPTY_QUEUE,
        userId,
        dirtyEntries: s.entries.map((e) => e.id),
        dirtyWeights: s.weights.map((w) => w.date),
        dirtyWater: Object.keys(s.water),
        dirtyFoods: s.customFoods.map((f) => f.id),
        // only if edited as a guest, so a fresh device doesn't overwrite the account's goals with defaults
        goalsDirty: s.sync.goalsDirty,
      },
    });
  } else {
    // someone else's data was left on this device: start clean, then pull
    s.resetLocal();
    useStore.setState({ sync: { ...EMPTY_QUEUE, userId } });
  }
}

let started = false;

/** Call once after the store has rehydrated. */
export function initAuth() {
  const supabase = getSupabase();
  if (!supabase || started) return;
  started = true;

  supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user ?? null;
    useAuth.setState({ user, status: user ? "signedIn" : "signedOut" });
    if (user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      adoptLocalData(user.id);
      // defer: supabase calls inside this callback can deadlock the auth lock
      setTimeout(syncNow, 0);
    }
  });

  // push local edits shortly after they happen
  useStore.subscribe((s, prev) => {
    if (s.sync !== prev.sync && useAuth.getState().status === "signedIn") scheduleSync();
  });
  const onWake = () => document.visibilityState === "visible" && syncNow();
  window.addEventListener("online", syncNow);
  window.addEventListener("focus", syncNow);
  document.addEventListener("visibilitychange", onWake);
}

export async function signInWithGoogle() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
}

/** Push anything pending, then sign out and clear this device. Data stays in the account. */
export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;
  await syncNow().catch(() => {});
  await supabase.auth.signOut();
  useStore.getState().resetLocal();
}
