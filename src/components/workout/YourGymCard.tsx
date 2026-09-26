"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Building2, MapPin, Pencil } from "lucide-react";
import { currentGym, hasLocation } from "@/lib/gym/gyms";
import { useStore } from "@/lib/store";

// the map (Leaflet) loads only when the sheet is opened
const GymSheet = dynamic(() => import("./GymSheet"), { ssr: false });

/** Me → "Your gym": what's saved, and the same settings sheet as the Gym card (edit, switch, remove). */
export function YourGymCard() {
  const gym = useStore((s) => currentGym(s.gyms));
  const [open, setOpen] = useState(false);
  const located = hasLocation(gym);

  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-semibold">Your gym</h2>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left transition-colors hover:bg-surface-3"
      >
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${gym ? "bg-jamun/15 text-jamun" : "bg-surface-3 text-faint"}`}>
          {gym ? <Building2 size={20} /> : <MapPin size={20} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{gym ? gym.name : "No gym saved"}</span>
          <span className="block truncate text-xs text-muted">
            {!gym ? "Save it for one-tap check-ins and visit tracking" : located ? `${gym.place?.label || "Location saved"} · ${gym.radiusM} m radius` : "No location yet: add one to verify visits"}
          </span>
        </span>
        <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-muted">
          {gym ? <><Pencil size={12} /> Edit</> : "Set up"}
        </span>
      </button>
      <GymSheet open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
