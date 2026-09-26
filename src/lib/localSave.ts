// How the store is saved on the device (localStorage "ct-v1"; architecture.md "Local storage").
//
// zustand's persist middleware saves after every store update by stringifying ALL the data. Measured 2026-09-27 in
// Chrome 153: one save of a typical user's year of logs (~1.4 M characters) costs ~2 ms on a Mac, ~9–14 ms on a
// throttled (mid/budget Android) CPU, ~30–50 ms at 3 years; localStorage holds ~5.24 M characters per site, after
// which setItem throws QuotaExceededError. So:
// - writes are batched: the latest state is written at most every WRITE_EVERY_MS, and at once when the app goes to
//   the background or the page is closed (so nothing is lost when the phone locks or the tab closes)
// - a failed write is caught and reported (useSaveHealth → StorageNotice), never thrown into a tap handler
// - the browser is asked once to keep the data even when the device runs low on space (navigator.storage.persist)
// The long-term fix (per-record IndexedDB) is in future.md.
import { create } from "zustand";
import type { PersistStorage, StorageValue } from "zustand/middleware";

export const WRITE_EVERY_MS = 500;

/** "full": the browser's storage for this site is full · "failed": saving failed for another reason (blocked, private mode) */
export type SaveHealth = { status: "ok" | "full" | "failed"; since: number | null };
export const useSaveHealth = create<SaveHealth>(() => ({ status: "ok", since: null }));

const isQuota = (e: unknown) =>
  e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);

let flushNow: () => void = () => {};
let askedPersist = false;
/** Ask once to keep the data under storage pressure. Chrome and Safari decide silently; Firefox would show a prompt, so it's skipped. */
function askPersistence() {
  if (askedPersist || typeof navigator === "undefined" || !navigator.storage?.persist || /Firefox\//.test(navigator.userAgent)) return;
  askedPersist = true;
  void navigator.storage.persisted().then((yes) => (yes ? true : navigator.storage.persist())).catch(() => {});
}

/** A PersistStorage for zustand that batches writes and survives a full localStorage. */
export function batchedStorage<S>(): PersistStorage<S> | undefined {
  let ls: Storage;
  try {
    ls = window.localStorage;
  } catch {
    return undefined; // no storage at all (blocked): zustand then keeps the data in memory only
  }
  let pending: { name: string; value: StorageValue<S> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const { name, value } = pending;
    pending = null;
    try {
      ls.setItem(name, JSON.stringify(value));
      if (useSaveHealth.getState().status !== "ok") useSaveHealth.setState({ status: "ok", since: null });
      askPersistence();
    } catch (e) {
      // keep the data in memory; the next change tries again
      useSaveHealth.setState((s) => ({ status: isQuota(e) ? "full" : "failed", since: s.since ?? Date.now() }));
    }
  };

  flushNow = write;
  // the moment the app is hidden (phone locked, app switched, tab closed), write what's pending
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && write());
  window.addEventListener("pagehide", write);

  return {
    getItem: (name) => {
      const s = ls.getItem(name);
      return s === null ? null : (JSON.parse(s) as StorageValue<S>);
    },
    setItem: (name, value) => {
      pending = { name, value };
      if (!timer) timer = setTimeout(write, WRITE_EVERY_MS);
    },
    removeItem: (name) => {
      if (pending?.name === name) pending = null;
      ls.removeItem(name);
    },
  };
}

/** Write anything pending now. */
export const flushSaves = () => flushNow();
