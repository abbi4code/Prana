"use client";

import { useAuth } from "./auth";
import { getSupabase } from "./supabase";

// Missing-food requests (D54 phase 1, .claude/food-requests.md). What people look for and can't find, sent to
// food_request_add() in Postgres (supabase/migrations/20260930100000_food_requests.sql). Signed-in users only; only
// the food name is sent. Not part of the sync queue: nothing comes back to merge.

/** request = tapped "Request it" · search = closed a search that found nothing · ai = AI item with no match · custom = made their own */
export type Via = "request" | "search" | "ai" | "custom";
export type RequestReply = { people: number; status: "waiting" | "found" };
export type RequestFail = "offline" | "signed_out" | "rate_limited" | "bad_name" | "failed";
export type RequestResult = { ok: true; data: RequestReply } | { ok: false; reason: RequestFail };

const QUEUE_KEY = "prana-food-requests"; // signals waiting for the network (a few names, never the search context)
const QUEUE_MAX = 30;

/** The name as it's sent: spaces collapsed, 2–60 characters, at least one letter. null = not worth sending. */
export function requestName(raw: string): string | null {
  const s = raw.replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 60 || !/\p{L}/u.test(s)) return null;
  return s;
}

type Queued = { name: string; via: Via };
const keyOf = (x: Queued) => `${x.via}:${x.name.toLowerCase()}`;
const readQueue = (): Queued[] => {
  try {
    const v = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const writeQueue = (q: Queued[]) => {
  try {
    if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX)));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    // storage blocked or full: the signal is lost, which is fine for a hint
  }
};
const enqueue = (item: Queued) => {
  writeQueue([...readQueue().filter((x) => keyOf(x) !== keyOf(item)), item]);
};

const signedIn = () => useAuth.getState().status === "signedIn";
const online = () => typeof navigator === "undefined" || navigator.onLine;

async function call(name: string, via: Via): Promise<RequestResult> {
  const sb = getSupabase();
  if (!sb || !signedIn()) return { ok: false, reason: "signed_out" };
  try {
    const { data, error } = await sb.rpc("food_request_add", { p_name: name, p_via: via });
    if (!error) return { ok: true, data: data as RequestReply };
    const msg = error.message ?? "";
    if (/^rate_limited/.test(msg)) return { ok: false, reason: "rate_limited" };
    if (/^bad_name/.test(msg)) return { ok: false, reason: "bad_name" };
    if (/not_signed_in|JWT|jwt/.test(msg)) return { ok: false, reason: "signed_out" };
    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: online() ? "failed" : "offline" };
  }
}

let flushing = false;
let listening = false;

/** Send what was saved while offline. Runs before each new signal and when the browser comes back online. */
export async function flushFoodRequests() {
  if (flushing || !signedIn() || !online()) return;
  const q = readQueue();
  if (!q.length) return;
  flushing = true;
  try {
    const done = new Set<string>();
    for (const item of q) {
      const r = await call(item.name, item.via);
      // offline again or a server hiccup: keep it; sent, a bad name or the daily limit: drop it
      if (r.ok || (r.reason !== "offline" && r.reason !== "failed")) done.add(keyOf(item));
    }
    // re-read: signals queued while this ran stay
    writeQueue(readQueue().filter((x) => !done.has(keyOf(x))));
  } finally {
    flushing = false;
  }
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("online", () => void flushFoodRequests());
}

// one send per name + signal per app session (the server dedupes too, but this saves calls and the rate limit)
const sent = new Set<string>();

/** "Request it": sent now, or saved for later when offline. */
export async function requestFood(raw: string): Promise<RequestResult> {
  const name = requestName(raw);
  if (!name) return { ok: false, reason: "bad_name" };
  if (!signedIn()) return { ok: false, reason: "signed_out" };
  listen();
  if (!online()) {
    enqueue({ name, via: "request" });
    return { ok: false, reason: "offline" };
  }
  void flushFoodRequests();
  const r = await call(name, "request");
  if (!r.ok && r.reason === "offline") enqueue({ name, via: "request" });
  if (r.ok) sent.add(keyOf({ name, via: "request" }));
  return r;
}

/** A quiet signal (search with no result, AI item with no match, custom food). Fire and forget; signed in only. */
export function noteMissingFood(raw: string, via: Exclude<Via, "request">) {
  const name = requestName(raw);
  if (!name || !signedIn()) return;
  const key = keyOf({ name, via });
  if (sent.has(key)) return;
  sent.add(key);
  listen();
  if (!online()) return enqueue({ name, via });
  void flushFoodRequests();
  void call(name, via).then((r) => {
    if (!r.ok && (r.reason === "offline" || r.reason === "failed")) enqueue({ name, via });
  });
}
