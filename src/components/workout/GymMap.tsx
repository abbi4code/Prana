"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Circle, LatLngExpression, Map as LMap, Marker } from "leaflet";

type LatLng = { lat: number; lng: number };
type Leaflet = typeof import("leaflet");

const INDIA: LatLngExpression = [22.5, 79];

/**
 * Gym location picker (D30 phase 3): Leaflet + OpenStreetMap tiles (free, attribution kept).
 * Tap the map or drag the pin to place the gym; the jamun circle is the check-in radius, the dashed one the
 * last reading's accuracy. Leaflet is loaded on demand, only when this map is shown.
 */
export function GymMap({ pin, radiusM, accuracy, onPick, start, onView, focus, className = "" }: {
  pin: LatLng | null;
  radiusM: number;
  accuracy?: { at: LatLng; m: number } | null;
  onPick: (p: LatLng) => void;
  /** where to open when there's no pin yet (e.g. near your old gym when switching); read once */
  start?: LatLng | null;
  /** the visible centre after every pan/zoom (place search prefers results near it) */
  onView?: (center: LatLng, zoom: number) => void;
  /** fly here without placing the pin (a searched area); a new `n` flies again to the same spot */
  focus?: { at: LatLng; zoom: number; n: number } | null;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const lib = useRef<Leaflet | null>(null);
  const map = useRef<LMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  const acc = useRef<Circle | null>(null);
  const pick = useRef(onPick);
  const view = useRef(onView);
  const startAt = useRef(start);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    pick.current = onPick;
    view.current = onView;
  });

  // create the map once
  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (dead || !box.current) return;
      lib.current = L;
      const s = startAt.current;
      const m = L.map(box.current, { zoomControl: false, attributionControl: true, center: s ? [s.lat, s.lng] : INDIA, zoom: s ? 14 : 4 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).addTo(m);
      L.control.zoom({ position: "bottomright" }).addTo(m);
      m.attributionControl.setPrefix(false);
      m.on("click", (e) => pick.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
      const report = () => {
        const c = m.getCenter();
        view.current?.({ lat: c.lat, lng: c.lng }, m.getZoom());
      };
      m.on("moveend", report);
      report();
      map.current = m;
      setReady(true);
      // the sheet is still animating in: measure again once it has its final size
      setTimeout(() => m.invalidateSize(), 450);
    })();
    return () => {
      dead = true;
      map.current?.remove();
      map.current = marker.current = circle.current = acc.current = null;
    };
  }, []);

  // pin + radius follow the props; the view flies to a new pin
  const pinKey = pin ? `${pin.lat.toFixed(6)},${pin.lng.toFixed(6)}` : "";
  useEffect(() => {
    const L = lib.current, m = map.current;
    if (!ready || !L || !m) return;
    if (!pin) {
      marker.current?.remove();
      circle.current?.remove();
      marker.current = circle.current = null;
      return;
    }
    const at: LatLngExpression = [pin.lat, pin.lng];
    if (!marker.current) {
      marker.current = L.marker(at, {
        draggable: true,
        icon: L.divIcon({ className: "gym-pin", html: "<span></span>", iconSize: [28, 28], iconAnchor: [14, 14] }),
        keyboard: true,
        title: "Your gym",
      }).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        pick.current({ lat: p.lat, lng: p.lng });
      });
      circle.current = L.circle(at, { radius: radiusM, className: "gym-radius", interactive: false }).addTo(m);
    } else {
      marker.current.setLatLng(at);
      circle.current?.setLatLng(at);
    }
    // show the whole check-in circle around the new pin
    const area = circle.current!.getBounds();
    if (!m.getBounds().contains(area) || m.getZoom() < 15) m.flyToBounds(area.pad(0.3), { duration: 0.8, maxZoom: 18 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pinKey stands for pin
  }, [ready, pinKey]);

  useEffect(() => {
    circle.current?.setRadius(radiusM);
  }, [radiusM, ready]);

  const focusN = focus?.n ?? 0;
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !focus) return;
    m.flyTo([focus.at.lat, focus.at.lng], focus.zoom, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focusN stands for focus
  }, [ready, focusN]);

  const accKey = accuracy ? `${accuracy.at.lat},${accuracy.at.lng},${accuracy.m}` : "";
  useEffect(() => {
    const L = lib.current, m = map.current;
    if (!ready || !L || !m) return;
    acc.current?.remove();
    acc.current = accuracy ? L.circle([accuracy.at.lat, accuracy.at.lng], { radius: accuracy.m, className: "gym-accuracy", interactive: false }).addTo(m) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accKey stands for accuracy
  }, [ready, accKey]);

  return (
    <div className={`relative isolate overflow-hidden rounded-3xl border border-line-strong ${className}`} data-vaul-no-drag>
      <div ref={box} className="gym-map size-full" aria-label="Map: tap to place your gym" />
      {!ready && <div className="skeleton absolute inset-0 rounded-none" />}
    </div>
  );
}
