"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CloudOff, Loader2, PackageSearch, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { noteMissingFood, requestFood, requestName } from "@/lib/foodRequests";
import { refreshSharedFoods } from "@/lib/sharedFoods";

// D54 phase 1 (.claude/food-requests.md): when search can't find a food, ask for it ("Request it") or make it yourself.

type Sent = { state: "sending" | "sent" | "queued" | "limited" | "failed"; people?: number; found?: boolean };

/**
 * The end of a food search. `empty` = nothing matched: the message + a prominent "Request it"; otherwise a quiet
 * "Not in the list?" row under the results. Requests need an account (guests only see "Create").
 */
export function MissingFood({ query, empty, emptyText, createLabel, onCreate }: {
  query: string;
  empty: boolean;
  emptyText: React.ReactNode;
  createLabel: string;
  onCreate: () => void;
}) {
  const signedIn = useAuth((s) => s.status === "signedIn");
  const name = requestName(query);
  // what happened to the request for this exact query (a new query starts fresh)
  const [sent, setSent] = useState<{ q: string; s: Sent } | null>(null);
  const mine = sent && sent.q === name ? sent.s : null;

  const ask = async () => {
    if (!name || (mine && mine.state !== "failed")) return;
    setSent({ q: name, s: { state: "sending" } });
    const r = await requestFood(name);
    navigator.vibrate?.(10);
    if (r.ok && r.data.status === "found") void refreshSharedFoods(true); // added already: fetch it now
    setSent({
      q: name,
      s: r.ok
        ? { state: "sent", people: r.data.people, found: r.data.status === "found" }
        : { state: r.reason === "offline" ? "queued" : r.reason === "rate_limited" ? "limited" : "failed" },
    });
  };

  return (
    <>
      {empty && <p className="px-2 pb-2 pt-8 text-center text-sm text-muted">{emptyText}</p>}
      {signedIn && name && <RequestRow name={name} prominent={empty} sent={mine} onClick={() => void ask()} />}
      <button
        onClick={onCreate}
        className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-3 py-3 text-left text-sm font-semibold text-muted transition-colors hover:border-turmeric/50 hover:text-text"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-turmeric"><Plus size={18} /></span>
        <span className="truncate">{createLabel}</span>
      </button>
    </>
  );
}

function RequestRow({ name, prominent, sent, onClick }: { name: string; prominent: boolean; sent: Sent | null; onClick: () => void }) {
  const done = sent?.state === "sent" || sent?.state === "queued";
  const title =
    sent?.state === "sent" ? (sent.found ? "Already added" : "Requested")
    : sent?.state === "queued" ? "Saved for later"
    : sent?.state === "sending" ? "Sending…"
    : prominent ? `Request “${name}”` : `Not in the list? Request “${name}”`;
  const sub =
    sent?.state === "sent"
      ? sent.found ? "It's been checked and added: search again in a moment"
      : (sent.people ?? 1) > 1 ? `${sent.people} people want this · we'll add it once it's checked against an official source`
      : "We'll add it once it's checked against an official source"
    : sent?.state === "queued" ? "You're offline: it goes out when you're back"
    : sent?.state === "limited" ? "That's a lot of requests for today. Try again tomorrow"
    : sent?.state === "failed" ? "Couldn't send it. Tap to try again"
    : prominent ? "We'll look for it in official sources (INDB, IFCT, USDA, the brand's label) and add it for everyone" : null;

  return (
    <motion.button
      layout
      whileTap={done ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={done || sent?.state === "sending"}
      aria-live="polite"
      className={`mt-2 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
        done ? "border-leaf/30 bg-leaf/10"
        : prominent ? "border-turmeric/35 bg-turmeric/10 hover:border-turmeric/60"
        : "border-dashed border-line-strong hover:border-turmeric/50"
      }`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${done ? "bg-leaf text-bg" : prominent ? "bg-turmeric/20 text-turmeric" : "bg-surface-2 text-turmeric"}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={sent?.state ?? "idle"}
            initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 24 }}
            className="grid place-items-center"
          >
            {sent?.state === "sending" ? <Loader2 size={18} className="animate-spin" />
              : sent?.state === "sent" ? <Check size={18} strokeWidth={2.5} />
              : sent?.state === "queued" ? <CloudOff size={17} />
              : <PackageSearch size={18} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold ${done ? "text-leaf" : prominent ? "text-text" : "text-muted"}`}>{title}</span>
        {sub && <span className="mt-0.5 block text-xs leading-snug text-muted">{sub}</span>}
      </span>
    </motion.button>
  );
}

/** How long a no-result query has to stay on screen to count as looked at (not a word still being typed). */
const LOOKED_MS = 1500;

/**
 * A missing food = a search that found nothing, looked at, then given up on: the box cleared (Esc clears it first),
 * something unrelated typed instead, or the sheet closed. Typing on ("kulfi" → "kulfi falooda") isn't giving up.
 * Signed-in users only, the name only (lib/foodRequests.ts). `skip` for sentences, which go to the AI instead.
 */
export function useSearchMiss(query: string, found: boolean, skip: boolean) {
  const seen = useRef<string | null>(null);
  useEffect(() => {
    const q = query.trim();
    if (seen.current && !q.toLowerCase().startsWith(seen.current.toLowerCase())) {
      noteMissingFood(seen.current, "search");
      seen.current = null;
    }
    if (skip || found || q.length < 3) return;
    const t = setTimeout(() => {
      seen.current = q;
    }, LOOKED_MS);
    return () => clearTimeout(t);
  }, [query, found, skip]);
  useEffect(() => {
    const ref = seen;
    return () => {
      if (ref.current) noteMissingFood(ref.current, "search");
    };
  }, []);
}
