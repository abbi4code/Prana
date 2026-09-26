"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { addDays, dayKey } from "@/lib/dates";
import { activeVisit } from "@/lib/gym/visits";
import { RECENT_MAX, fits, greetParts, pickGreeting, type GreetState, type Greeting as Line } from "@/lib/greet";
import { useStore } from "@/lib/store";
import { dayStatus } from "@/lib/streaks";
import { isRestDay } from "@/lib/useWorkouts";

// Today's greeting (D31). A new line when the app is opened, or after being away STAY_MS; tap it for another.
// The pool is loaded on demand (~12 KB gzip), so it never weighs on the first paint.

const KEY = "prana-greet";
const STAY_MS = 30 * 60_000;

type Saved = { id: string; at: number; recent: string[] };

let pool: Promise<Line[]> | null = null;
const loadPool = () => (pool ??= import("@/data/greetings.generated.json").then((m) => m.default as Line[]));

function readSaved(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.id === "string" && Array.isArray(v.recent) ? v : null;
  } catch {
    return null;
  }
}
function save(v: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

/** "Abhishek" from the Google profile; null for guests. */
export function firstName(user: User | null): string | null {
  const m = user?.user_metadata ?? {};
  const full = String(m.full_name ?? m.name ?? m.given_name ?? "").trim();
  return full ? full.split(/\s+/)[0] : null;
}

/** Everything the picker needs, read from the store at the moment of picking. */
function currentState(streak: number): GreetState {
  const s = useStore.getState();
  const now = new Date();
  const today = dayKey(now);
  const logDays = new Set([...s.entries.map((e) => e.date), ...s.workouts.map((w) => w.date)]);
  const before = [...logDays].filter((d) => d < today).sort();
  const last = before.at(-1) ?? null;
  const eatenToday = s.entries.filter((e) => e.date === today);
  const kcal = eatenToday.reduce((t, e) => t + e.kcal, 0);
  return {
    hour: now.getHours(),
    weekday: now.getDay(),
    name: firstName(useAuth.getState().user),
    streak,
    firstDay: !last,
    // 2+ whole days without logging anything
    backAfterBreak: !!last && last <= addDays(today, -3),
    atGym: !!activeVisit(s.visits, s.localVisits, s.pendingCheckout?.visitId ?? null),
    workoutDone: s.workouts.some((w) => w.date === today),
    restDay: isRestDay(s.fitness.restDays, today),
    // from 8 am: breakfast nudges in the morning, "forgot to log?" lines after lunch (see fits)
    nothingLogged: now.getHours() >= 8 && !eatenToday.length && !!last,
    // until 8 pm "on track" = eating logged and not over the goal (80–105 % rarely holds before dinner);
    // from 8 pm the real test (D24), so "report card A plus" never goes to a day of under-eating
    onTrack: eatenToday.length > 0 && (now.getHours() < 20 ? dayStatus(kcal, s.goals.kcal) !== "over" : dayStatus(kcal, s.goals.kcal) === "on"),
    gymUser: s.workouts.length > 0 || s.gyms.length > 0 || s.visits.length > 0 || s.localVisits.length > 0,
    female: s.profile?.sex === "female",
  };
}

export function Greeting({ streak }: { streak: number }) {
  const still = useReducedMotion();
  const name = useAuth((s) => firstName(s.user));
  // pick only once we know who's signed in, so a saved {name} line survives a reload
  const authReady = useAuth((s) => s.status !== "loading");
  const [line, setLine] = useState<Line | null>(null);
  const streakRef = useRef(streak);
  const runRef = useRef<(fresh: boolean) => void>(() => {});

  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);

  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    const run = async (fresh: boolean) => {
      const list = await loadPool().catch(() => null);
      if (!alive || !list) return;
      const state = currentState(streakRef.current);
      const saved = readSaved();
      const now = Date.now();
      const kept = !fresh && saved && now - saved.at < STAY_MS ? list.find((g) => g.id === saved.id && fits(g, state)) : undefined;
      if (kept) {
        save({ ...saved!, at: now });
        return setLine(kept);
      }
      const recent = saved?.recent ?? [];
      const g = pickGreeting(list, state, fresh && saved ? [saved.id, ...recent] : recent);
      if (!g) return;
      save({ id: g.id, at: now, recent: [g.id, ...recent.filter((id) => id !== g.id)].slice(0, RECENT_MAX) });
      setLine(g);
    };
    runRef.current = (fresh) => void run(fresh);
    const t = setTimeout(() => void run(false), 0);
    // away time counts from when the app was hidden; coming back after STAY_MS brings a new line
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        const saved = readSaved();
        if (saved) save({ ...saved, at: Date.now() });
      } else void run(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authReady]);

  const parts = line && !(line.t.includes("{name}") && !name) ? greetParts(line, { name, streak }) : null;
  // words animate one by one; name/streak keep their highlight
  const words = parts?.flatMap((p) => p.text.split(/(\s+)/).filter(Boolean).map((w) => ({ w, slot: p.slot }))) ?? [];

  return (
    <div className="min-h-[3.6rem] lg:min-h-[2.6rem]">
      <AnimatePresence mode="wait" initial={false}>
        {parts && (
          <motion.button
            key={line!.id}
            onClick={() => runRef.current(true)}
            aria-label={`${parts.map((p) => p.text).join("")}. Tap for another`}
            title="Tap for another"
            exit={{ opacity: 0, y: still ? 0 : -8, transition: { duration: 0.15 } }}
            className="block w-full cursor-pointer text-left font-display text-[1.45rem] font-semibold leading-[1.22] tracking-[-0.01em] text-text text-balance lg:text-[2rem]"
          >
            {words.map(({ w, slot }, i) =>
              /^\s+$/.test(w) ? (
                w
              ) : (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: still ? 0 : 10, filter: still ? "none" : "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: still ? 0 : i * 0.035, type: "spring", stiffness: 380, damping: 30 }}
                  className={`inline-block ${slot ? "bg-gradient-to-r from-turmeric to-saffron bg-clip-text text-transparent" : ""}`}
                >
                  {w}
                </motion.span>
              ),
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
