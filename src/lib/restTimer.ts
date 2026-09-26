"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Rest timer between sets (D40, .claude/workouts.md "Rest timer"). Started by ticking a set in the exercise logger;
// shown by <RestTimer/> (mounted in AppShell) above everything, sheets included. Only the end time is stored, so a
// locked phone, a switched app or a reload all come back to the right countdown.

type Rest = {
  /** when the rest is over (ms since epoch); null = no timer */
  endsAt: number | null;
  /** full length in seconds, for the progress ring */
  total: number;
  /** what's next, e.g. "Bench press · set 3 of 4" */
  label: string | null;
  start: (seconds: number, label: string) => void;
  /** add (or with a negative number, take off) seconds; never below 5 s left */
  add: (seconds: number) => void;
  stop: () => void;
};

export const useRest = create<Rest>()(
  persist(
    (set, get) => ({
      endsAt: null,
      total: 0,
      label: null,
      start: (seconds, label) => set({ endsAt: Date.now() + seconds * 1000, total: seconds, label }),
      add: (seconds) => {
        const { endsAt, total } = get();
        if (!endsAt) return;
        const left = Math.max(5000, endsAt - Date.now() + seconds * 1000);
        set({ endsAt: Date.now() + left, total: Math.max(total, Math.ceil(left / 1000)) });
      },
      stop: () => set({ endsAt: null, label: null }),
    }),
    { name: "prana-rest", skipHydration: true, partialize: ({ endsAt, total, label }) => ({ endsAt, total, label }) },
  ),
);
