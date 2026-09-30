"use client";

import { CATEGORY_LABEL, setSharedFoods } from "./foods";
import { getSupabase } from "./supabase";
import type { Food } from "./types";

// Shared foods (D54 phase 2, .claude/food-requests.md): foods the owner approved after the app was built, and names
// marked "Same as" in the admin panel. Downloaded from catalog_updates() (everyone, guests too), kept on the device
// for offline use, merged into search by lib/foods.ts. Nobody edits them here, so they're not in the store or the
// sync queue; logged entries snapshot their numbers as always (D05).

const KEY = "prana-shared-foods";
const EVERY_MS = 15 * 60_000; // re-check at most this often (app start always checks)

type Stored = { at: string | null; foods: Food[]; aliases: { name: string; foodId: string }[] };
type Update = { foods: { id: string; data: unknown; deleted: boolean }[]; aliases: { name: string; foodId: string }[]; at: string | null };

const EMPTY: Stored = { at: null, foods: [], aliases: [] };
let stored: Stored = EMPTY;
let lastCheck = 0;
let running: Promise<void> | null = null;
let started = false;

/** A downloaded row is used only if it has the shape the app relies on (a bad row must never break search). */
function isFood(x: unknown): x is Food {
  const f = x as Food;
  return !!f && typeof f.id === "string" && typeof f.name === "string" && f.name.length > 0 &&
    typeof f.kcal === "number" && f.kcal >= 0 && f.cat in CATEGORY_LABEL && Array.isArray(f.aliases) &&
    Array.isArray(f.units) && f.units.length > 0 && f.units.every((u) => typeof u.id === "string" && typeof u.g === "number" && u.g > 0) &&
    f.units.some((u) => u.id === f.du);
}

function apply() {
  const names = new Map<string, string[]>();
  for (const a of stored.aliases) names.set(a.foodId, [...(names.get(a.foodId) ?? []), a.name]);
  setSharedFoods(stored.foods, names);
}

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Stored | null;
    if (v && Array.isArray(v.foods) && Array.isArray(v.aliases)) stored = { at: v.at ?? null, foods: v.foods.filter(isFood), aliases: v.aliases };
  } catch {
    stored = EMPTY;
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // storage full or blocked: still works for this session, downloads again next time
  }
}

/** Ask the server what changed since the last check. `force` skips the 15-minute wait (e.g. a request came back "found"). */
export function refreshSharedFoods(force = false): Promise<void> {
  if (running) return running;
  if (!force && Date.now() - lastCheck < EVERY_MS) return Promise.resolve();
  if (typeof navigator !== "undefined" && !navigator.onLine) return Promise.resolve();
  const sb = getSupabase();
  if (!sb) return Promise.resolve();
  lastCheck = Date.now();
  running = (async () => {
    try {
      const { data, error } = await sb.rpc("catalog_updates", { p_since: stored.at });
      if (error || !data) return; // not migrated yet, or offline: keep what we have
      const u = data as Update;
      const byId = new Map(stored.foods.map((f) => [f.id, f]));
      for (const row of u.foods ?? []) {
        if (row.deleted || !isFood(row.data) || row.data.id !== row.id) byId.delete(row.id);
        else byId.set(row.id, row.data);
      }
      const aliases = (u.aliases ?? []).filter((a) => typeof a?.name === "string" && typeof a?.foodId === "string");
      stored = { at: u.at ?? stored.at, foods: [...byId.values()], aliases };
      save();
      apply();
    } catch {
      // network error: try again on the next focus
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Once, after the store is loaded (AppShell): use the saved copy straight away, then check for news. */
export function initSharedFoods() {
  if (started || typeof window === "undefined") return;
  started = true;
  load();
  apply();
  void refreshSharedFoods(true);
  window.addEventListener("focus", () => void refreshSharedFoods());
  window.addEventListener("online", () => void refreshSharedFoods());
}
