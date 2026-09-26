"use client";

import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRightLeft, Crosshair, LoaderCircle, MapPin, ShieldCheck, Trash, Trash2, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { useAuth } from "@/lib/auth";
import { RADIUS_DEFAULT_M, RADIUS_MAX_M, RADIUS_MIN_M } from "@/lib/gym/config";
import { currentGym, placeChanged } from "@/lib/gym/gyms";
import { placeStillFits, type GymPlace } from "@/lib/gym/places";
import { isIosChrome, readLocation, unblockSteps, type Reading } from "@/lib/gym/location";
import { resetNearby } from "@/lib/gym/nearby";
import { activeVisit } from "@/lib/gym/visits";
import { useStore, useUI } from "@/lib/store";
import type { Gym } from "@/lib/types";
import { GymMap } from "./GymMap";
import { PlaceSearch } from "./PlaceSearch";

type LatLng = { lat: number; lng: number };
/** setup = first gym · edit = same gym (pin, name, radius) · switch = moved to a different gym (the old one keeps its visits) */
type Mode = "setup" | "edit" | "switch";

/**
 * Gym settings (D30): name, location (current location, search or map), radius, the location setting;
 * plus switching to a new gym and removing it. Opened from the Gym card and from Me.
 */
export default function GymSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open && <GymSettings onClose={onClose} />}
    </Sheet>
  );
}

function GymSettings({ onClose }: { onClose: () => void }) {
  const gym = useStore((s) => currentGym(s.gyms));
  const [mode, setMode] = useState<Mode>(gym ? "edit" : "setup");
  // keyed: switching starts a fresh form (and a fresh map), "back" restores the saved gym
  return <GymForm key={mode} mode={gym ? mode : "setup"} gym={gym} onClose={onClose} onMode={setMode} />;
}

const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `gym-${Date.now()}`);

function GymForm({ mode, gym, onClose, onMode }: { mode: Mode; gym: Gym | null; onClose: () => void; onMode: (m: Mode) => void }) {
  const saveGym = useStore((s) => s.saveGym);
  const switchGym = useStore((s) => s.switchGym);
  const consent = useStore((s) => s.locationConsent);
  const setConsent = useStore((s) => s.setLocationConsent);
  const visits = useStore((s) => s.visits);
  const local = useStore((s) => s.localVisits);
  const pending = useStore((s) => s.pendingCheckout);
  const signedIn = useAuth((s) => s.status === "signedIn");
  const showToast = useUI((s) => s.showToast);

  const editing = mode === "edit" && gym;
  const saved = editing && gym.lat != null && gym.lng != null ? { lat: gym.lat, lng: gym.lng } : null;
  const [name, setName] = useState(editing ? gym.name : "");
  const [pin, setPin] = useState<LatLng | null>(saved);
  const [radius, setRadius] = useState(editing ? gym.radiusM : RADIUS_DEFAULT_M);
  const [reading, setReading] = useState<Reading | null>(null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<null | "denied" | "unavailable">(null);
  // the search result the pin came from (kept only while the pin stays near it), and the name to show under the map
  const [place, setPlace] = useState<GymPlace | null>(editing ? gym.place ?? null : null);
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<{ at: LatLng; zoom: number; n: number } | null>(null);

  /** every way the pin moves (map, drag, location, search) goes through here */
  const movePin = (p: LatLng | null, from: { reading?: Reading; picked?: string; place?: GymPlace } = {}) => {
    setPin(p);
    setReading(from.reading ?? null);
    setPicked(from.picked ?? null);
    setPlace((cur) => from.place ?? (placeStillFits(cur, p) ? cur : null));
  };

  const active = useMemo(() => activeVisit(visits, local, pending?.visitId ?? null), [visits, local, pending]);
  // visits linked to the current gym: they stay with it after a switch
  const pastVisits = useMemo(
    () => (gym ? visits.filter((v) => v.gymId === gym.id && v.endedAt).length + local.filter((v) => v.gymId === gym.id && v.endedAt).length : 0),
    [gym, visits, local],
  );
  const pinMoved = !!editing && (pin?.lat !== saved?.lat || pin?.lng !== saved?.lng);

  const useHere = async () => {
    // tapping this is an explicit "use my location": it turns the app setting on (it can be turned off below)
    if (consent !== true) setConsent(true);
    setLocating(true);
    setProblem(null);
    const r = await readLocation();
    setLocating(false);
    if (!r.ok) return setProblem(r.reason === "permission_denied" ? "denied" : "unavailable");
    movePin({ lat: r.reading.lat, lng: r.reading.lng }, { reading: r.reading });
    navigator.vibrate?.(10);
  };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const next: Gym = {
      id: editing ? gym.id : newId(),
      name: n.slice(0, 80),
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
      radiusM: radius,
      createdAt: editing ? gym.createdAt : Date.now(),
      place: pin && placeStillFits(place, pin) ? place : null,
    };
    if (mode === "switch" && gym) {
      switchGym(next);
      resetNearby(gym.id);
      showToast(`Switched to ${next.name}. Your past visits stay in your history.`);
    } else {
      saveGym(next);
      if (editing && placeChanged(gym, next)) resetNearby(gym.id);
      showToast(editing ? "Gym updated." : pin && signedIn ? "Gym saved. Check-ins can now be verified." : "Gym saved.");
    }
    onClose();
  };

  const title = mode === "switch" ? "Your new gym" : mode === "edit" ? "Edit your gym" : "Your gym";
  const cta = mode === "switch" ? "Switch gym" : mode === "edit" ? "Save changes" : "Save gym";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">{title}</Drawer.Title>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex items-center gap-3 pt-1">
          {mode === "switch" && (
            <button onClick={() => onMode("edit")} aria-label="Back to your gym" className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-muted hover:text-text">
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Gym check-in</p>
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>

        {mode === "switch" && gym && (
          <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
            Moving on from <span className="font-semibold text-text">{gym.name}</span>?{" "}
            {pastVisits
              ? `Your ${pastVisits} visit${pastVisits === 1 ? "" : "s"} there stay in your history and streaks.`
              : "Anything you did there stays in your history."}
          </p>
        )}

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
            <button onClick={() => movePin(null)} className="flex items-center gap-1 text-xs font-semibold text-faint hover:text-chilli">
              <Trash size={12} /> Remove pin
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

        <PlaceSearch
          near={view}
          signedIn={signedIn}
          onPlace={(p, provider) => {
            movePin({ lat: p.lat, lng: p.lng }, { picked: p.name, place: { provider, id: p.id, label: p.label || p.name, lat: p.lat, lng: p.lng } });
            if (!name.trim() && p.kind === "gym") setName(p.name.slice(0, 80));
          }}
          onArea={(p) => setFocus((f) => ({ at: { lat: p.lat, lng: p.lng }, zoom: 15, n: (f?.n ?? 0) + 1 }))}
        />

        <GymMap
          pin={pin}
          radiusM={radius}
          accuracy={reading ? { at: { lat: reading.lat, lng: reading.lng }, m: reading.accuracy } : null}
          onPick={(p) => movePin(p)}
          onView={setView}
          focus={focus}
          // switching: open near the old gym (usually the same city), not all of India
          start={mode === "switch" && gym?.lat != null && gym.lng != null ? { lat: gym.lat, lng: gym.lng } : null}
          className="mt-3 h-64 lg:h-72"
        />
        <p className="mt-2 text-xs text-muted">
          {reading
            ? reading.accuracy > 100
              ? `Fuzzy reading (±${Math.round(reading.accuracy)} m). Drag the pin onto your gym, or try again near a window.`
              : `Placed at your location (±${Math.round(reading.accuracy)} m). Drag the pin to adjust.`
            : picked
              ? `Placed at ${picked}. Map data can be a little off: drag the pin onto the building.`
              : pin
              ? "Drag the pin or tap the map to move it."
              : "Or tap the map where your gym is."}
        </p>
        {pinMoved && active && (
          <p className="mt-1 text-xs font-medium text-saffron">You&apos;re checked in: Done will be checked against the new spot.</p>
        )}

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

        {editing && <ChangeGym gym={gym} checkedIn={!!active} onSwitch={() => onMode("switch")} onRemoved={onClose} />}
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={save}
          disabled={!name.trim()}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-cream py-3.5 font-bold text-bg disabled:opacity-40"
        >
          {mode === "switch" ? <ArrowRightLeft size={18} /> : <MapPin size={18} />} {cta}
        </motion.button>
      </div>
    </div>
  );
}

/** "Changed gyms?": switch to a new one, or remove it. Not while a visit is running (it belongs to this gym). */
function ChangeGym({ gym, checkedIn, onSwitch, onRemoved }: { gym: Gym; checkedIn: boolean; onSwitch: () => void; onRemoved: () => void }) {
  const removeGym = useStore((s) => s.removeGym);
  const showToast = useUI((s) => s.showToast);
  const [confirming, setConfirming] = useState(false);

  const remove = () => {
    removeGym(gym.id);
    resetNearby(gym.id);
    showToast(`${gym.name} removed. Your past visits stay.`);
    onRemoved();
  };

  return (
    <div className="mt-6 border-t border-line pt-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Changed gyms?</p>
      {checkedIn && <p className="mt-1 text-xs text-muted">Tap Done on your current visit first.</p>}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onSwitch}
          disabled={checkedIn}
          className="flex h-12 items-center gap-2.5 rounded-2xl border border-line-strong px-4 text-left text-sm font-semibold transition-colors hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ArrowRightLeft size={16} className="shrink-0 text-jamun" />
          <span className="truncate">Switch to a new gym</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setConfirming(true)}
          disabled={checkedIn || confirming}
          aria-label={`Remove ${gym.name}`}
          className="grid size-12 place-items-center rounded-2xl border border-line-strong text-faint transition-colors hover:bg-chilli/10 hover:text-chilli disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-faint"
        >
          <Trash2 size={17} />
        </motion.button>
      </div>
      <AnimatePresence initial={false}>
        {confirming && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-2 rounded-2xl border border-chilli/30 bg-chilli/10 p-3">
              <p className="text-sm">
                Remove <span className="font-semibold">{gym.name}</span>? Your past visits stay. You can set up a gym again anytime.
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button onClick={() => setConfirming(false)} className="h-10 rounded-xl border border-line-strong text-sm font-semibold">Keep it</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={remove} className="h-10 rounded-xl bg-chilli text-sm font-bold text-white">Remove</motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
