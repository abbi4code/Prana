"use client";

import { create } from "zustand";
import { useAuth } from "./auth";
import { getFood, getUnit } from "./foods";
import { refreshSharedFoods } from "./sharedFoods";
import { useStore } from "./store";
import { getSupabase } from "./supabase";
import type { Food, SavedMeal } from "./types";

// "Your food is in Prana now" (D54 phase 5, .claude/food-requests.md): news for people who tapped "Request it" or had
// to make the food themselves, from food_request_news() (supabase/migrations/20260930130000_food_request_news.sql).
// Shown once on Today; dismissing, logging or swapping marks it seen on the server.

export type FoodNews = { id: number; name: string; foodId: string; status: "found" | "alias"; custom: boolean; at: string };

type State = {
  items: FoodNews[];
  /** account the news was loaded for (once per sign-in and app start) */
  loadedFor: string | null;
  load: () => Promise<void>;
  seen: (ids: number[]) => void;
};

export const useFoodNews = create<State>((set, get) => ({
  items: [],
  loadedFor: null,
  load: async () => {
    const { status, user } = useAuth.getState();
    const sb = getSupabase();
    if (!sb || status !== "signedIn" || !user || get().loadedFor === user.id) return;
    set({ loadedFor: user.id });
    await refreshSharedFoods(); // the added food has to be on this device before a card points at it
    const { data, error } = await sb.rpc("food_request_news");
    if (error || !Array.isArray(data)) return set({ loadedFor: null }); // offline / not migrated: try again next time
    // a food retracted since (or not downloaded yet) isn't announced; the news waits for the next app open
    set({ items: (data as FoodNews[]).filter((n) => getFood(n.foodId)) });
  },
  seen: (ids) => {
    set((s) => ({ items: s.items.filter((n) => !ids.includes(n.id)) }));
    // queries are lazy: .then sends it (architecture.md gotchas); a failure just shows the card again next time
    void getSupabase()?.rpc("food_request_seen", { p_ids: ids }).then(() => {});
  },
}));

/** Same key as the server's food_request_key(): lower case, ASCII punctuation + danda → space, spaces collapsed. */
const nameKey = (s: string) => s.toLowerCase().replace(/[!-/:-@[-`{-~।॥]+/g, " ").replace(/\s+/g, " ").trim();

/** The custom food this person made under the requested name, if they still have it. */
export function ownVersion(n: FoodNews): Food | null {
  if (!n.custom) return null;
  const key = nameKey(n.name);
  return useStore.getState().customFoods.find((f) => nameKey(f.name) === key) ?? null;
}

/**
 * Use the checked food instead of your own: every thali that had your version now has the checked one at the same
 * grams (their own unit sizes may differ), and your version leaves My foods. Past logs keep their numbers (entries are
 * snapshots, D05). Returns an undo.
 */
export function swapToChecked(own: Food, checked: Food): () => void {
  const s = useStore.getState();
  const before: SavedMeal[] = s.savedMeals.filter((m) => m.items.some((i) => i.foodId === own.id));
  for (const m of before)
    s.saveMeal({
      ...m,
      items: m.items.map((i) => (i.foodId !== own.id ? i : { foodId: checked.id, unitId: "g", qty: Math.round(getUnit(own, i.unitId).g * i.qty) })),
    });
  s.removeCustomFood(own.id);
  return () => {
    const now = useStore.getState();
    now.addCustomFood(own);
    for (const m of before) now.saveMeal(m);
  };
}
