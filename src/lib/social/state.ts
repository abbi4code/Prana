"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useAuth } from "../auth";
import { social, type Me, type Result, type Trophies } from "./api";

// Akhada client state. Not persisted: social data lives on the server and is fetched while online.

type SocialState = {
  /** undefined = not loaded yet · null = signed in, not joined */
  me: Me | null | undefined;
  loading: boolean;
  /** the last load failed (offline, server down): the gate offers a retry instead of loading forever */
  failed: boolean;
  refresh: () => Promise<void>;
  set: (me: Me | null) => void;
};

export const useSocial = create<SocialState>((set, get) => ({
  me: undefined,
  loading: false,
  failed: false,
  refresh: async () => {
    if (useAuth.getState().status !== "signedIn" || get().loading) return;
    set({ loading: true });
    const r = await social.sync(); // settles finished duels/challenges first
    set({ loading: false, failed: !r.ok, ...(r.ok ? { me: r.data } : {}) });
    if (r.ok && r.data) void loadTrophies();
  },
  set: (me) => set({ me }),
}));

let wired = false;
/** Load the profile when signed in, forget it on sign-out, refresh counts when the app comes back. */
export function useSocialBoot() {
  useEffect(() => {
    if (wired) return;
    wired = true;
    const load = () => void useSocial.getState().refresh();
    if (useAuth.getState().status === "signedIn") load();
    useAuth.subscribe((a, prev) => {
      if (a.status === "signedIn" && prev.status !== "signedIn") load();
      if (a.status !== "signedIn" && prev.status === "signedIn") useSocial.setState({ me: undefined });
    });
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && load());
  }, []);
}

/**
 * A server read with a short-lived cache (so switching tabs doesn't flash), refetched when `key` changes or on
 * `reload()`. Stale data stays on screen while a refetch runs.
 */
const cache = new Map<string, { at: number; value: unknown }>();
const FRESH_MS = 20_000;

export function useRemote<T>(key: string | null, load: () => Promise<Result<T>>) {
  const hit = key ? (cache.get(key) as { at: number; value: Result<T> } | undefined) : undefined;
  const [state, setState] = useState<{ key: string | null; result: Result<T> | null }>({ key, result: hit?.value ?? null });
  const [loading, setLoading] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async (force: boolean) => {
    if (!key) return;
    const c = cache.get(key);
    if (!force && c && Date.now() - c.at < FRESH_MS) {
      setState({ key, result: c.value as Result<T> });
      return;
    }
    setLoading(true);
    const r = await loadRef.current();
    if (r.ok) cache.set(key, { at: Date.now(), value: r });
    setState({ key, result: r });
    setLoading(false);
  }, [key]);

  useEffect(() => {
    const t = setTimeout(() => void run(false), 0);
    return () => clearTimeout(t);
  }, [run]);

  // what's on screen: this key's result, or the cached one while switching
  const result = state.key === key ? state.result : (hit?.value ?? null);
  return { result, data: result?.ok ? result.data : undefined, loading: loading || (!!key && result == null), reload: () => run(true) };
}

/** Drop cached reads (after a change that affects them). */
export const invalidate = (prefix: string) => {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
};

// ── avatars: presets only (no uploaded photos: nothing to moderate, nothing personal) ──
export const AVATARS: { id: string; emoji: string; tone: string }[] = [
  { id: "flame", emoji: "🔥", tone: "from-saffron to-chilli" },
  { id: "bolt", emoji: "⚡", tone: "from-turmeric to-saffron" },
  { id: "lifter", emoji: "🏋️", tone: "from-jamun to-chilli" },
  { id: "tiger", emoji: "🐯", tone: "from-saffron to-turmeric" },
  { id: "lion", emoji: "🦁", tone: "from-brass to-turmeric" },
  { id: "elephant", emoji: "🐘", tone: "from-sky to-jamun" },
  { id: "peacock", emoji: "🦚", tone: "from-leaf to-sky" },
  { id: "lotus", emoji: "🪷", tone: "from-chilli to-jamun" },
  { id: "mango", emoji: "🥭", tone: "from-turmeric to-leaf" },
  { id: "chai", emoji: "☕", tone: "from-brass to-saffron" },
  { id: "rocket", emoji: "🚀", tone: "from-sky to-jamun" },
  { id: "star", emoji: "⭐", tone: "from-turmeric to-brass" },
];
export const avatarOf = (id: string) => AVATARS.find((a) => a.id === id) ?? AVATARS[0];

// ── resume a join link after sign-in (only Akhada paths, so it can't become an open redirect) ──
const NEXT_KEY = "prana-after-login";
export function rememberAfterLogin(path: string) {
  try {
    if (path.startsWith("/akhada")) localStorage.setItem(NEXT_KEY, path);
  } catch {}
}
export function takeAfterLogin(): string | null {
  try {
    const p = localStorage.getItem(NEXT_KEY);
    localStorage.removeItem(NEXT_KEY);
    return p && /^\/akhada(\/[A-Za-z0-9_\-/?=&]*)?$/.test(p) ? p : null;
  } catch {
    return null;
  }
}

// ── trophies for the Akhada badges (lib/badges.ts): cached on the device so Awards works offline ──
const TROPHY_KEY = "prana-akhada-trophies";
const EMPTY: Trophies = { wins: [], finishes: [], duels: [], kudos: [] };
type Cached = { userId: string; t: Trophies };
const readTrophies = (): Cached | null => {
  try {
    return JSON.parse(localStorage.getItem(TROPHY_KEY) ?? "null");
  } catch {
    return null;
  }
};
export const useTrophyCache = create<{ cached: Cached | null }>(() => ({ cached: typeof window === "undefined" ? null : readTrophies() }));

async function loadTrophies() {
  const userId = useAuth.getState().user?.id;
  if (!userId) return;
  const r = await social.trophies();
  if (!r.ok) return;
  const cached = { userId, t: r.data };
  try {
    localStorage.setItem(TROPHY_KEY, JSON.stringify(cached));
  } catch {}
  useTrophyCache.setState({ cached });
}

/** This account's Akhada wins (empty for guests, other accounts, or before the first sync). */
export function useTrophies(userId: string | null): Trophies {
  const cached = useTrophyCache((s) => s.cached);
  return cached && userId && cached.userId === userId ? cached.t : EMPTY;
}
