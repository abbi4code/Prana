"use client";

// Browser location for gym check-in (D30, phase 2). Read ONLY when the user taps something: never on page load,
// never in the background (the web can't anyway). Callers must check the app-level consent first.

export type Reading = { lat: number; lng: number; accuracy: number };
export type ReadFail = "permission_denied" | "unavailable" | "timeout" | "unsupported";
export type ReadResult = { ok: true; reading: Reading } | { ok: false; reason: ReadFail };

/** "granted" | "prompt" | "denied", or "unknown" where the Permissions API can't say (older iOS). Never prompts. */
export async function permissionState(): Promise<PermissionState | "unknown"> {
  try {
    if (!navigator.permissions?.query) return "unknown";
    const s = await navigator.permissions.query({ name: "geolocation" });
    return s.state;
  } catch {
    return "unknown";
  }
}

/**
 * One reading. May show the browser's permission prompt, so only call it right after a user tap.
 * iOS can ask again even after "Allow", so nothing here assumes the permission is remembered.
 */
export function readLocation(opts: { highAccuracy?: boolean; timeoutMs?: number; maxAgeMs?: number } = {}): Promise<ReadResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ ok: true, reading: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } }),
      (e) => resolve({ ok: false, reason: e.code === 1 ? "permission_denied" : e.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: opts.highAccuracy ?? true, timeout: opts.timeoutMs ?? 15_000, maximumAge: opts.maxAgeMs ?? 0 },
    );
  });
}

/** Every iOS browser is WebKit (same location behaviour); iPadOS reports itself as a Mac with touch. */
export function platform(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}
/** Chrome on iPhone also needs iPhone Settings → Chrome → Location. */
export const isIosChrome = () => platform() === "ios" && /CriOS/.test(navigator.userAgent);
export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Plain steps to unblock location, per platform. */
export function unblockSteps(): string[] {
  const p = platform();
  if (p === "ios") {
    if (isIosChrome()) return ["Open iPhone Settings → Chrome → Location → While Using the App.", "Then in Chrome, reload Prana and try again."];
    return [
      "Open iPhone Settings → Privacy & Security → Location Services → Safari Websites → While Using the App.",
      isStandalone() ? "The installed app uses Safari's setting. Reopen Prana and try again." : "Then in Safari, tap aA → Website Settings → Location → Allow.",
    ];
  }
  if (p === "android") return ["Tap the lock icon (or ⋮ → Settings → Site settings) next to the address.", "Permissions → Location → Allow, then try again."];
  return ["Click the lock icon next to the address → Site settings → Location → Allow.", "Then try again."];
}
