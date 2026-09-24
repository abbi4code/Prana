"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { Crosshair, LoaderCircle, MapPin, ShieldCheck, Trash, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { useAuth } from "@/lib/auth";
import { RADIUS_DEFAULT_M, RADIUS_MAX_M, RADIUS_MIN_M } from "@/lib/gym/config";
import { isIosChrome, readLocation, unblockSteps, type Reading } from "@/lib/gym/location";
import { useStore, useUI } from "@/lib/store";
import type { Gym } from "@/lib/types";
import { GymMap } from "./GymMap";

type LatLng = { lat: number; lng: number };

/** Gym settings (D30 phase 3): name, location (current location or map), radius, and the location setting. */
export default function GymSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open && <GymForm onClose={onClose} />}
    </Sheet>
  );
}

function GymForm({ onClose }: { onClose: () => void }) {
  const gym = useStore((s) => s.gyms[0] ?? null);
  const saveGym = useStore((s) => s.saveGym);
  const consent = useStore((s) => s.locationConsent);
  const setConsent = useStore((s) => s.setLocationConsent);
  const signedIn = useAuth((s) => s.status === "signedIn");
  const showToast = useUI((s) => s.showToast);

  const [name, setName] = useState(gym?.name ?? "");
  const [pin, setPin] = useState<LatLng | null>(gym?.lat != null && gym.lng != null ? { lat: gym.lat, lng: gym.lng } : null);
  const [radius, setRadius] = useState(gym?.radiusM ?? RADIUS_DEFAULT_M);
  const [reading, setReading] = useState<Reading | null>(null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<null | "denied" | "unavailable">(null);

  const useHere = async () => {
    // tapping this is an explicit "use my location": it turns the app setting on (it can be turned off below)
    if (consent !== true) setConsent(true);
    setLocating(true);
    setProblem(null);
    const r = await readLocation();
    setLocating(false);
    if (!r.ok) return setProblem(r.reason === "permission_denied" ? "denied" : "unavailable");
    setReading(r.reading);
    setPin({ lat: r.reading.lat, lng: r.reading.lng });
    navigator.vibrate?.(10);
  };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const next: Gym = {
      id: gym?.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `gym-${Date.now()}`),
      name: n.slice(0, 80),
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      radiusM: radius,
      createdAt: gym?.createdAt ?? Date.now(),
    };
    saveGym(next);
    showToast(pin && signedIn ? "Gym saved. Check-ins can now be verified." : "Gym saved.");
    onClose();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Your gym</Drawer.Title>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Gym check-in</p>
            <h2 className="font-display text-2xl font-semibold">Your gym</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line-strong text-muted">
            <X size={18} />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Gym name, e.g. Gold's Gym Andheri"
          aria-label="Gym name"
          className="mt-4 h-12 w-full rounded-2xl border border-line-strong bg-bg/60 px-4 font-semibold outline-none placeholder:font-normal placeholder:text-faint focus:border-jamun/60"
        />

        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Location</p>
          {pin && (
            <button onClick={() => { setPin(null); setReading(null); }} className="flex items-center gap-1 text-xs font-semibold text-faint hover:text-chilli">
              <Trash size={12} /> Remove
            </button>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={useHere}
          disabled={locating}
          className="mt-2 flex h-14 w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-jamun to-chilli px-4 text-left font-bold text-white shadow-[0_10px_30px_-12px_var(--color-jamun)] disabled:opacity-70"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-white/15">
            {locating ? <LoaderCircle size={18} className="animate-spin" /> : <Crosshair size={18} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block leading-tight">{locating ? "Finding you…" : "I'm at my gym right now"}</span>
            <span className="block text-xs font-medium text-white/80">Use my current location (most accurate)</span>
          </span>
        </motion.button>

        <AnimatePresence initial={false}>
          {problem && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-2 rounded-2xl border border-chilli/30 bg-chilli/10 px-4 py-3 text-sm">
                {problem === "denied" ? (
                  <>
                    <p className="font-semibold">Location is blocked for Prana.</p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-muted">
                      {unblockSteps().map((s) => <li key={s}>{s}</li>)}
                    </ol>
                    <p className="mt-1 text-muted">Or place your gym on the map below.</p>
                  </>
                ) : (
                  <p>
                    Couldn&apos;t get a location fix. Indoors? Step near a door or window and try again, or tap your gym on the map.
                    {isIosChrome() && " On iPhone, Chrome also needs Settings → Chrome → Location."}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <GymMap
          pin={pin}
          radiusM={radius}
          accuracy={reading ? { at: { lat: reading.lat, lng: reading.lng }, m: reading.accuracy } : null}
          onPick={(p) => { setPin(p); setReading(null); }}
          className="mt-3 h-64 lg:h-72"
        />
        <p className="mt-2 text-xs text-muted">
          {reading
            ? reading.accuracy > 100
              ? `Fuzzy reading (±${Math.round(reading.accuracy)} m). Drag the pin onto your gym, or try again near a window.`
              : `Placed at your location (±${Math.round(reading.accuracy)} m). Drag the pin to adjust.`
            : pin
              ? "Drag the pin or tap the map to move it."
              : "Or tap the map where your gym is."}
        </p>

        <div className="mt-5 flex items-baseline justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Check-in radius</p>
          <p className="font-display text-lg font-semibold tabular text-jamun">{radius} m</p>
        </div>
        <input
          type="range"
          min={RADIUS_MIN_M}
          max={RADIUS_MAX_M}
          step={10}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          aria-label="Check-in radius in metres"
          className="mt-2 w-full accent-[var(--color-jamun)]"
          data-vaul-no-drag
        />
        <p className="mt-1 text-xs text-muted">How close you need to be to count as at the gym. Bigger helps in basements and big complexes.</p>

        <button
          onClick={() => setConsent(consent !== true)}
          role="switch"
          aria-checked={consent === true}
          className="mt-5 flex w-full items-start gap-3 rounded-2xl border border-line-strong bg-surface-2 p-4 text-left"
        >
          <ShieldCheck size={20} className={`mt-0.5 shrink-0 ${consent ? "text-leaf" : "text-faint"}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Use my location to verify gym check-ins</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              Only when you tap check in or Done. Never in the background. Your location isn&apos;t stored, only how far you were from the gym.
              {!signedIn && " Sign in to get verified visits."}
            </span>
          </span>
          <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${consent ? "bg-leaf" : "bg-surface-3"}`}>
            <motion.span layout className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${consent ? "right-0.5" : "left-0.5"}`} transition={{ type: "spring", stiffness: 500, damping: 34 }} />
          </span>
        </button>
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={save}
          disabled={!name.trim()}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-cream py-3.5 font-bold text-bg disabled:opacity-40"
        >
          <MapPin size={18} /> Save gym
        </motion.button>
      </div>
    </div>
  );
}
