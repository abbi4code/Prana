"use client";

import { Bike, Dumbbell, Flower2, Footprints, Mountain, PersonStanding, Sun, Timer, Trophy, Waves, Wind, Zap } from "lucide-react";
import { photoUrl } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";

/**
 * Start + end photos (free-exercise-db) cross-fading, so the movement reads like a slow GIF.
 * Exercises without photos get the brass dumbbell art instead.
 */
export function ExercisePhoto({ ex, animate = false, className = "" }: {
  ex: Pick<Exercise, "id" | "photo" | "frames" | "name" | "equip">;
  animate?: boolean;
  className?: string;
}) {
  if (!ex.photo)
    return (
      <div className={`relative grid aspect-[3/2] place-items-center overflow-hidden bg-surface-2 ${className}`}>
        <GymArt kind={ex.equip === "kettlebell" ? "kettlebell" : "dumbbell"} />
      </div>
    );
  return (
    <div className={`relative aspect-[3/2] overflow-hidden bg-[#f4f4f2] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP in /public; cached offline by sw.js */}
      <img src={photoUrl(ex.id, 0)} alt={`${ex.name}, start position`} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      {animate && ex.frames > 1 && (
        // eslint-disable-next-line @next/next/no-img-element -- see above
        <img src={photoUrl(ex.id, 1)} alt="" aria-hidden loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover opacity-0 animate-flip" />
      )}
    </div>
  );
}

/** Flat brass gym art in the FoodIcon style, for exercises that have no photo. */
function GymArt({ kind }: { kind: "dumbbell" | "kettlebell" }) {
  return (
    <svg viewBox="0 0 48 48" className="size-16" aria-hidden>
      <ellipse cx="24" cy="41" rx="15" ry="2.2" fill="#000" opacity="0.18" />
      {kind === "dumbbell" ? (
        <>
          <rect x="15" y="21.5" width="18" height="5" rx="2.5" fill="#9aa3ad" />
          <rect x="7" y="14" width="7" height="20" rx="2.5" fill="#b98535" />
          <rect x="34" y="14" width="7" height="20" rx="2.5" fill="#b98535" />
          <rect x="5" y="17" width="3" height="14" rx="1.5" fill="#8a5d22" />
          <rect x="40" y="17" width="3" height="14" rx="1.5" fill="#8a5d22" />
          <path d="M9,16 v16" stroke="#f6d796" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M36,16 v16" stroke="#f6d796" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M16,17 C16,8 32,8 32,17" stroke="#8a5d22" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M11,28 C11,19 37,19 37,28 C37,36 31,40 24,40 C17,40 11,36 11,28 Z" fill="#b98535" />
          <path d="M15,27 C15,32 18,36 22,37.5" stroke="#f6d796" strokeOpacity="0.7" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

const ACTIVITY_ICON: Record<string, typeof Bike> = {
  "treadmill-walk": Footprints, "incline-walk": Mountain, "outdoor-walk": Footprints, "treadmill-run": Wind, running: Wind,
  "stationary-cycle": Bike, elliptical: PersonStanding, "rowing-machine": Waves, "stair-climber": Mountain,
  "skipping-rope": Timer, swimming: Waves, cricket: Trophy, badminton: Trophy, football: Trophy,
  "yoga-hatha": Flower2, "yoga-power": Flower2, pranayama: Wind, "surya-namaskar": Sun, hiit: Zap, zumba: Zap,
};

export function ActivityIcon({ id, size = 44 }: { id: string; size?: number }) {
  const Icon = ACTIVITY_ICON[id] ?? Dumbbell;
  return (
    <span className="grid shrink-0 place-items-center rounded-2xl bg-jamun/12 text-jamun" style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.48)} strokeWidth={2.1} />
    </span>
  );
}
