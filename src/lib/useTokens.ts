"use client";

import { useSyncExternalStore } from "react";

const NAMES = ["turmeric", "saffron", "chilli", "leaf", "sky", "muted", "faint", "text"] as const;
export type Tokens = Record<(typeof NAMES)[number], string>;

const DARK: Tokens = {
  turmeric: "#f6c343", saffron: "#ff8a3d", chilli: "#ff5a6e", leaf: "#6cc46f", sky: "#7dd3fc", muted: "#a89484", faint: "#6f5f52", text: "#f7ecdf",
};

let cache: Tokens = DARK;
let cacheKey = "";

function read(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const key = NAMES.map((n) => cs.getPropertyValue(`--color-${n}`)).join("|");
  if (key !== cacheKey) {
    cacheKey = key;
    cache = Object.fromEntries(NAMES.map((n) => [n, cs.getPropertyValue(`--color-${n}`).trim() || DARK[n]])) as Tokens;
  }
  return cache;
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}

/** Theme colors as concrete values, for places CSS variables can't reach (SVG attributes, Recharts props). */
export const useTokens = () => useSyncExternalStore(subscribe, read, () => DARK);
