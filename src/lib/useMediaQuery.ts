"use client";

import { useSyncExternalStore } from "react";

/** true when the query matches; false during SSR. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Matches Tailwind's `lg` breakpoint, where the desktop layout kicks in. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
