"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dumbbell, MapPin, Navigation, Search, X } from "lucide-react";
import { NEARBY_RADIUS_M, SEARCH_MIN_CHARS, type Place, type PlacesRequest, type PlacesResponse } from "@/lib/gym/places";
import { searchPlaces, type PlacesOutcome } from "@/lib/gym/placesApi";
import { haversineM } from "@/lib/gym/verify";

type LatLng = { lat: number; lng: number };
type List = { mode: PlacesRequest["mode"]; around: LatLng | null; places: Place[]; provider: string; attribution: PlacesResponse["attribution"] };
type Status = { s: "idle" } | { s: "loading"; mode: PlacesRequest["mode"] } | { s: "error"; reason: Exclude<PlacesOutcome, { ok: true }>["reason"]; retryAfterS?: number };

const DEBOUNCE_MS = 300;

const fmtKm = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`);

/**
 * Find your gym by name or area (gym-checkin.md "Place search"). A gym or place sets the pin; an area flies the map
 * there and lists the gyms around it. OpenStreetMap doesn't know every Indian gym, so the copy always points back to
 * "tap the map" / "use my location": search helps you get close, the pin you confirm is what counts.
 */
export function PlaceSearch({ near, signedIn, onPlace, onArea }: {
  /** the map's centre: results near it come first; "Gyms nearby" looks around it */
  near: LatLng | null;
  signedIn: boolean;
  /** a gym or named place: put the pin on it */
  onPlace: (p: Place, provider: string) => void;
  /** a locality / city / pincode: move the map there (no pin) */
  onArea: (p: Place) => void;
}) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<List | null>(null);
  const [status, setStatus] = useState<Status>({ s: "idle" });
  const [active, setActive] = useState(-1);
  const inflight = useRef<AbortController | null>(null);
  const nearRef = useRef(near);
  // text we put in the box ourselves (a picked area's name): showing it must not search again
  const settled = useRef<string | null>(null);
  const listId = useId();

  useEffect(() => {
    nearRef.current = near;
  });
  useEffect(() => () => inflight.current?.abort(), []);

  const run = async (req: PlacesRequest) => {
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    setStatus({ s: "loading", mode: req.mode });
    try {
      const out = await searchPlaces(req, ctl.signal);
      if (ctl.signal.aborted) return;
      if (!out.ok) {
        setList(null);
        return setStatus({ s: "error", reason: out.reason, retryAfterS: out.retryAfterS });
      }
      setList({ mode: req.mode, around: req.near, places: out.data.places, provider: out.data.provider, attribution: out.data.attribution });
      setActive(out.data.places.length ? 0 : -1);
      setStatus({ s: "idle" });
    } catch {
      // aborted by a newer request
    }
  };

  // typed search, debounced; shorter text clears a previous typed result (a "nearby" list stays)
  const text = q.trim();
  useEffect(() => {
    if (text.length < SEARCH_MIN_CHARS) {
      inflight.current?.abort();
      const t = setTimeout(() => {
        setStatus((s) => (s.s === "loading" && s.mode === "search" ? { s: "idle" } : s));
        setList((l) => (l?.mode === "search" ? null : l));
      }, 0);
      return () => clearTimeout(t);
    }
    if (text === settled.current) return;
    const t = setTimeout(() => void run({ mode: "search", q: text, near: nearRef.current }), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const nearby = (at: LatLng | null) => at && void run({ mode: "nearby", near: at });

  const pick = (p: Place) => {
    if (!list) return;
    navigator.vibrate?.(8);
    if (p.kind === "area") {
      onArea(p);
      settled.current = p.name.trim();
      setQ(p.name);
      nearby({ lat: p.lat, lng: p.lng }); // then: which gym in this area?
      return;
    }
    onPlace(p, list.provider);
    setQ("");
    setList(null);
  };

  const clear = () => {
    inflight.current?.abort();
    setQ("");
    setList(null);
    setStatus({ s: "idle" });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = list?.places.length ?? 0;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      setActive((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submits anything: Enter only picks the highlighted row
      if (list && active >= 0) pick(list.places[active]);
    } else if (e.key === "Escape" && (q || list)) {
      clear(); // the sheet stays open (data-escape-clears, components/Sheet.tsx)
    }
  };

  if (!signedIn)
    return (
      <p className="mt-2 flex items-start gap-2 rounded-2xl border border-dashed border-line-strong px-3 py-2.5 text-xs text-muted">
        <Search size={14} className="mt-0.5 shrink-0 text-faint" />
        Sign in to search by gym name or area. You can still use your location or tap the map.
      </p>
    );

  const open = !!list || status.s !== "idle";
  const loading = status.s === "loading";

  return (
    <div className="mt-2">
      <div className="flex gap-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search size={16} className="pointer-events-none absolute left-3.5 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Gym name or area"
            aria-label="Search gym or area"
            role="combobox"
            aria-expanded={!!list?.places.length}
            aria-controls={listId}
            aria-activedescendant={list && active >= 0 ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            enterKeyHint="search"
            data-escape-clears={q || list ? "" : undefined}
            className="h-12 w-full rounded-2xl border border-line-strong bg-bg/60 pl-10 pr-10 text-[15px] outline-none placeholder:text-faint focus:border-jamun/60"
          />
          {(q || list) && (
            <button onClick={clear} aria-label="Clear search" className="absolute right-2 grid size-8 place-items-center rounded-full text-faint hover:text-text">
              <X size={15} />
            </button>
          )}
        </label>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => nearby(near)}
          disabled={!near || (loading && status.mode === "nearby")}
          title="Gyms within 3 km of the map centre"
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-line-strong px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-40"
        >
          <Dumbbell size={15} className="text-jamun" /> <span>Gyms nearby</span>
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="mt-2 rounded-2xl border border-line-strong bg-surface-2 p-1.5">
              {loading ? (
                <div className="space-y-1.5 p-1" aria-label="Searching">
                  {[0, 1, 2].map((i) => <div key={i} className="skeleton h-11 rounded-xl" />)}
                </div>
              ) : status.s === "error" ? (
                <p className="px-2.5 py-2 text-sm text-muted">{errorText(status.reason, status.retryAfterS)}</p>
              ) : list && list.places.length ? (
                <>
                  {list.mode === "nearby" && (
                    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
                      Gyms within {fmtKm(NEARBY_RADIUS_M)}
                    </p>
                  )}
                  <ul id={listId} role="listbox" aria-label="Places" className="max-h-72 overflow-y-auto overscroll-contain">
                    {list.places.map((p, i) => (
                      <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                        <button
                          onClick={() => pick(p)}
                          onMouseEnter={() => setActive(i)}
                          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${i === active ? "bg-surface-3" : ""}`}
                        >
                          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${p.kind === "gym" ? "bg-jamun/15 text-jamun" : p.kind === "area" ? "bg-brass/15 text-brass" : "bg-surface text-muted"}`}>
                            {p.kind === "gym" ? <Dumbbell size={16} /> : p.kind === "area" ? <Navigation size={15} /> : <MapPin size={16} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{p.name}</span>
                            {p.label && <span className="block truncate text-xs text-muted">{p.label}</span>}
                          </span>
                          {list.around && <span className="shrink-0 text-xs text-faint tabular">{fmtKm(haversineM(list.around, p))}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Attribution list={list} />
                </>
              ) : list ? (
                <>
                  <p className="px-2.5 py-2 text-sm text-muted">
                    {list.mode === "nearby"
                      ? "No gyms on the map around here yet. Tap your gym on the map, or use your location when you're there."
                      : "No match. The map doesn't know every gym yet: try your area or pincode, then tap your gym on the map."}
                  </p>
                  <Attribution list={list} />
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Required by the provider's terms: shown wherever its results are. */
function Attribution({ list }: { list: List }) {
  return (
    <p className="px-2.5 pb-1 pt-1.5 text-[10px] text-faint">
      {list.attribution.map((a, i) => (
        <span key={a.href}>
          {i > 0 && " · "}
          <a href={a.href} target="_blank" rel="noreferrer" className="hover:text-muted hover:underline">{a.text}</a>
        </span>
      ))}
    </p>
  );
}

function errorText(reason: Exclude<PlacesOutcome, { ok: true }>["reason"], retryAfterS?: number) {
  switch (reason) {
    case "offline": return "You're offline. Use your location or tap the map.";
    case "rate_limited": return `That's a lot of searches. Try again in ${retryAfterS ?? 60} s, or tap the map.`;
    case "not_configured": return "Place search isn't set up yet. Use your location or tap the map.";
    case "signed_out": return "Sign in to search. You can still use your location or tap the map.";
    default: return "Search isn't working right now. Use your location or tap the map.";
  }
}
