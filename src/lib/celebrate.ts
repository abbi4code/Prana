"use client";

import { create } from "zustand";
import type { Unlock } from "./badges";
import type { PrHit } from "./records";

/** Things worth a banner: new personal records and newly earned badges. Shown one at a time, in order. */
export type NewCelebration = { kind: "pr"; hits: PrHit[] } | { kind: "badge"; unlocks: Unlock[] };
export type Celebration = { id: number } & NewCelebration;

type Q = {
  queue: Celebration[];
  push: (c: NewCelebration) => void;
  next: () => void;
};

let seq = 0;
export const useCelebrations = create<Q>((set) => ({
  queue: [],
  push: (c) => set((s) => ({ queue: [...s.queue, { ...c, id: Date.now() + seq++ }] })),
  next: () => set((s) => ({ queue: s.queue.slice(1) })),
}));
