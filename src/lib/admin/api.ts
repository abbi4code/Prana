"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useAuth } from "../auth";
import { getSupabase } from "../supabase";

// Admin panel client (D51). Every call carries the user's own Supabase token; the server decides whether they're an
// admin and reads with the service role. Nothing admin-related is stored on the device.

export type AdminFail = "offline" | "signed_out" | "forbidden" | "not_found" | "not_migrated" | "failed";
export type AdminResult<T> = { ok: true; data: T } | { ok: false; reason: AdminFail };

export async function adminFetch<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<AdminResult<T>> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, reason: "offline" };
  const token = (await getSupabase()?.auth.getSession())?.data.session?.access_token;
  if (!token) return { ok: false, reason: "signed_out" };
  try {
    const res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    if (res.status === 401) return { ok: false, reason: "signed_out" };
    if (res.status === 403) return { ok: false, reason: "forbidden" };
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (res.status === 503 && body?.error === "not_migrated") return { ok: false, reason: "not_migrated" };
    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "failed" };
  }
}

export function failText(reason: AdminFail): string {
  switch (reason) {
    case "offline": return "You're offline. The admin panel reads live data from the server.";
    case "signed_out": return "Sign in with your admin Google account.";
    case "forbidden": return "This area is for Prana admins only.";
    case "not_found": return "That account doesn't exist (or was deleted).";
    case "not_migrated": return "The admin database functions aren't on the server yet. Run npm run db:push.";
    default: return "Couldn't load this. Try again.";
  }
}

// ── am I an admin? (asked once per sign-in; the answer only decides whether to show links: the server still checks every call) ──
type AdminStatus = { status: "unknown" | "checking" | "yes" | "no"; for: string | null; check: () => Promise<void> };

export const useAdminStatus = create<AdminStatus>((set, get) => ({
  status: "unknown",
  for: null,
  check: async () => {
    const { status, user } = useAuth.getState();
    if (status !== "signedIn" || !user) return set({ status: "no", for: null });
    if (get().for === user.id && get().status !== "unknown") return;
    set({ status: "checking", for: user.id });
    const r = await adminFetch<{ admin: boolean }>("/api/admin/me");
    // a network blip shouldn't hide the panel for the whole session: stay "unknown" and retry next time
    set({ status: r.ok ? (r.data.admin ? "yes" : "no") : r.reason === "signed_out" ? "no" : "unknown" });
  },
}));

/** true once the server has said this account is an admin. Checks lazily when signed in. */
export function useIsAdmin() {
  const auth = useAuth((s) => s.status);
  const uid = useAuth((s) => s.user?.id ?? null);
  const status = useAdminStatus((s) => s.status);
  const owner = useAdminStatus((s) => s.for);
  useEffect(() => {
    if (auth === "signedIn" && (owner !== uid || status === "unknown")) void useAdminStatus.getState().check();
    if (auth === "signedOut" && status !== "no") useAdminStatus.setState({ status: "no", for: null });
  }, [auth, uid, owner, status]);
  return auth === "signedIn" && owner === uid && status === "yes";
}

// ── reads with a short cache, so switching tabs or ranges back and forth doesn't refetch ──
const cache = new Map<string, { at: number; value: AdminResult<unknown> }>();
const inflight = new Map<string, Promise<AdminResult<unknown>>>(); // two views asking at once share one request
const FRESH_MS = 60_000;

function load<T>(path: string): Promise<AdminResult<T>> {
  let p = inflight.get(path) as Promise<AdminResult<T>> | undefined;
  if (!p) {
    p = adminFetch<T>(path).finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

export function useAdminQuery<T>(path: string | null) {
  const hit = path ? (cache.get(path) as { at: number; value: AdminResult<T> } | undefined) : undefined;
  const [state, setState] = useState<{ path: string | null; result: AdminResult<T> | null }>({ path, result: hit?.value ?? null });
  const [loading, setLoading] = useState(false);
  const latest = useRef(path);
  useEffect(() => {
    latest.current = path;
  });

  const run = useCallback(async (force: boolean) => {
    if (!path) return;
    const c = cache.get(path);
    if (!force && c && Date.now() - c.at < FRESH_MS) {
      setState({ path, result: c.value as AdminResult<T> });
      return;
    }
    setLoading(true);
    const r = await load<T>(path);
    if (r.ok) cache.set(path, { at: Date.now(), value: r });
    if (latest.current === path) setState({ path, result: r });
    setLoading(false);
  }, [path]);

  useEffect(() => {
    const t = setTimeout(() => void run(false), 0);
    return () => clearTimeout(t);
  }, [run]);

  const result = state.path === path ? state.result : (hit?.value ?? null);
  return {
    data: result?.ok ? result.data : undefined,
    error: result && !result.ok ? result.reason : null,
    loading: loading || (!!path && result == null),
    reload: () => run(true),
    at: path ? cache.get(path)?.at ?? null : null,
  };
}

export const invalidateAdmin = (prefix = "/api/admin") => {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
};

// ── files for the admin to keep (CSV of users, one account's data as JSON for access requests) ──
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // quote, and neutralise spreadsheet formulas (a name like "=HYPERLINK(...)" must stay text)
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}
