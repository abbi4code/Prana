"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Download, Share2 } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { RollingNumber } from "@/components/RollingNumber";
import { TIER_NAME } from "@/lib/badges";
import { getFood } from "@/lib/foods";
import { PR_LABEL, formatGain, formatPr } from "@/lib/records";
import { WHO_MOVE_MINUTES, WHO_STRENGTH_DAYS } from "@/lib/activity";
import { bestStreak, weekLabel, type FoodDot, type WorkoutDot, type WrappedWeek } from "@/lib/wrapped";
import { drawShareCard, saveBlob, shareOrSave } from "@/lib/wrappedShare";
import { useUI } from "@/lib/store";

export type CardDef = { id: string; glow: string; body: React.ReactNode };

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** The cards for a week, in order. Cards without data are left out (a food-only week has no training card). */
export function buildCards(w: WrappedWeek, name: string | null): CardDef[] {
  const cards: CardDef[] = [{ id: "cover", glow: "var(--color-saffron)", body: <Cover w={w} name={name} /> }];
  if (w.food.logged) cards.push({ id: "consistency", glow: "var(--color-leaf)", body: <Consistency w={w} /> });
  if (w.food.top.length) cards.push({ id: "plate", glow: "var(--color-brass)", body: <Plate w={w} /> });
  if (w.food.logged && (w.food.protein.goal > 0 || w.food.water.glasses > 0)) cards.push({ id: "habits", glow: "var(--color-sky)", body: <Habits w={w} /> });
  if (w.training && (w.training.workoutDays > 0 || w.training.visits > 0 || w.training.sets > 0)) cards.push({ id: "training", glow: "var(--color-jamun)", body: <Training w={w} /> });
  if (w.prs.length || w.badges.length) cards.push({ id: "wins", glow: "var(--color-turmeric)", body: <Wins w={w} /> });
  cards.push({ id: "share", glow: "var(--color-saffron)", body: <ShareCard w={w} name={name} /> });
  return cards;
}

/** Children rise in one after another (reduced motion: fade only). */
function Rise({ i, children, className = "" }: { i: number; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 + i * 0.09, type: "spring", stiffness: 260, damping: 26 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted">{children}</p>
);

function Cover({ w, name }: { w: WrappedWeek; name: string | null }) {
  return (
    <div className="flex h-full flex-col">
      <Rise i={0}><Kicker>Weekly Wrapped</Kicker></Rise>
      <Rise i={1}><p className="mt-1 text-lg font-semibold">{name ? `${name}'s week` : "Your week"} · {weekLabel(w.from)}</p></Rise>
      <div className="my-auto">
        <Rise i={2}>
          <motion.span
            className="block text-7xl"
            initial={{ scale: 0.4, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 12 }}
            aria-hidden
          >
            {w.persona.emoji}
          </motion.span>
        </Rise>
        <Rise i={3}><h2 className="mt-4 font-display text-5xl font-semibold leading-[1.05]">{w.persona.title}</h2></Rise>
        <Rise i={4}><p className="mt-3 text-lg text-muted">{w.persona.line}</p></Rise>
      </div>
      <Rise i={5}><p className="text-sm text-faint">Tap to see your week →</p></Rise>
    </div>
  );
}

function FoodDots({ dots }: { dots: FoodDot[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-7 gap-2">
      {dots.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <motion.span
            initial={{ scale: reduce ? 1 : 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.35 + i * 0.07, type: "spring", stiffness: 420, damping: 18 }}
            className={`grid size-9 place-items-center rounded-full text-sm ${
              d === "on" ? "bg-leaf text-bg" : d === "logged" ? "bg-turmeric/45" : d === "skip" ? "border-2 border-brass text-brass" : "border border-line-strong"
            }`}
            aria-label={d === "on" ? "on target" : d === "logged" ? "logged" : d === "skip" ? "celebration day" : "not logged"}
          >
            {d === "on" ? "✓" : d === "skip" ? "✦" : ""}
          </motion.span>
          <span className="text-[11px] font-bold text-faint">{LETTERS[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Consistency({ w }: { w: WrappedWeek }) {
  const f = w.food;
  const streak = bestStreak(w);
  return (
    <div className="flex h-full flex-col">
      <Rise i={0}><Kicker>Showing up</Kicker></Rise>
      <div className="my-auto">
        <Rise i={1}>
          <p className="font-display text-[5.5rem] font-semibold leading-none tabular">
            <RollingNumber value={f.logged} /><span className="text-4xl text-muted">/7</span>
          </p>
        </Rise>
        <Rise i={2}><p className="mt-2 text-xl font-semibold">{f.logged === 7 ? "Every single day, logged." : `day${f.logged === 1 ? "" : "s"} logged`}</p></Rise>
        <Rise i={3} className="mt-8"><FoodDots dots={f.dots} /></Rise>
        <Rise i={4}>
          <p className="mt-8 text-lg">
            <span className="font-display text-3xl font-semibold text-leaf">{f.onTarget}</span>{" "}
            {f.onTarget === 1 ? "day" : "days"} on target
          </p>
        </Rise>
        {streak && (
          <Rise i={5}>
            <p className="mt-2 text-lg">
              <span aria-hidden>🔥</span> <span className="font-semibold">{streak.n}-day</span> {streak.label} streak going into next week
            </p>
          </Rise>
        )}
      </div>
    </div>
  );
}

function Plate({ w }: { w: WrappedWeek }) {
  const [mvp, ...rest] = w.food.top;
  const cat = getFood(mvp.foodId)?.cat;
  return (
    <div className="flex h-full flex-col">
      <Rise i={0}><Kicker>Your plate</Kicker></Rise>
      <div className="my-auto">
        <Rise i={1}><p className="text-lg text-muted">Your MVP this week</p></Rise>
        <Rise i={2} className="mt-3 flex items-center gap-4">
          {cat && <FoodIcon cat={cat} size={72} />}
          <div className="min-w-0">
            <p className="font-display text-4xl font-semibold leading-tight">{mvp.name}</p>
            <p className="text-lg text-brass">logged {mvp.count} {mvp.count === 1 ? "time" : "times"}</p>
          </div>
        </Rise>
        {rest.length > 0 && (
          <Rise i={3}>
            <ul className="mt-6 space-y-2">
              {rest.map((f, i) => (
                <li key={f.foodId} className="flex items-baseline gap-3 text-lg">
                  <span className="font-display text-muted">#{i + 2}</span>
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-muted tabular">×{f.count}</span>
                </li>
              ))}
            </ul>
          </Rise>
        )}
        <Rise i={4} className="mt-8 grid grid-cols-2 gap-3">
          {w.food.chai > 0 && <Stat big={`${w.food.chai}`} small={w.food.chai === 1 ? "cup of chai ☕" : "cups of chai ☕"} tone="text-brass" />}
          {w.food.newFoods.length > 0 && <Stat big={`${w.food.newFoods.length}`} small={w.food.newFoods.length === 1 ? "new dish tried" : "new dishes tried"} tone="text-turmeric" />}
        </Rise>
      </div>
    </div>
  );
}

function Stat({ big, small, tone }: { big: string; small: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/70 p-3.5">
      <p className={`font-display text-3xl font-semibold tabular ${tone}`}>{big}</p>
      <p className="mt-0.5 text-sm text-muted">{small}</p>
    </div>
  );
}

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
      <motion.div
        className={`h-full origin-left rounded-full ${tone}`}
        initial={{ scaleX: reduce ? pct : 0 }}
        animate={{ scaleX: pct }}
        transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function Habits({ w }: { w: WrappedWeek }) {
  const p = w.food.protein;
  const water = w.food.water;
  return (
    <div className="flex h-full flex-col">
      <Rise i={0}><Kicker>Habits</Kicker></Rise>
      <div className="my-auto space-y-8">
        {p.goal > 0 && (
          <Rise i={1}>
            <p className="text-lg text-muted">Protein</p>
            <p className="font-display text-5xl font-semibold tabular text-chilli">
              {p.days}<span className="text-2xl text-muted">/7 days</span>
            </p>
            <p className="mb-3 mt-1 text-base">hit your {p.goal} g goal · about {p.avg} g a day</p>
            <Bar value={p.avg} max={p.goal} tone="bg-chilli" />
          </Rise>
        )}
        {water.glasses > 0 && (
          <Rise i={2}>
            <p className="text-lg text-muted">Water</p>
            <p className="font-display text-5xl font-semibold tabular text-sky">
              {water.glasses}<span className="text-2xl text-muted"> glasses</span>
            </p>
            <p className="mb-3 mt-1 text-base">{water.days ? `8+ glasses on ${water.days} ${water.days === 1 ? "day" : "days"}` : "Aim for 8 a day next week"}</p>
            <Bar value={water.days} max={7} tone="bg-sky" />
          </Rise>
        )}
      </div>
    </div>
  );
}

function WorkoutDots({ dots }: { dots: WorkoutDot[] }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {dots.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <span
            className={`grid size-9 place-items-center rounded-full text-sm ${
              d === "hit" ? "bg-jamun text-white" : d === "rest" ? "border-2 border-jamun/40 text-jamun" : "border border-line-strong"
            }`}
            aria-label={d === "hit" ? "workout" : d === "rest" ? "rest day" : "no workout"}
          >
            {d === "hit" ? "🔥" : d === "rest" ? "🌙" : ""}
          </span>
          <span className="text-[11px] font-bold text-faint">{LETTERS[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Training({ w }: { w: WrappedWeek }) {
  const t = w.training!;
  const tiles: [string, string][] = [];
  if (t.sets) tiles.push([`${t.sets}`, t.sets === 1 ? "set" : "sets"]);
  if (t.volumeKg) tiles.push([t.volumeKg.toLocaleString("en-IN"), "kg lifted"]);
  if (t.minutes) tiles.push([`${t.minutes}`, "minutes moving"]);
  if (t.kcal) tiles.push([`~${t.kcal.toLocaleString("en-IN")}`, "kcal burned"]);
  if (t.visits) tiles.push([`${t.visits}`, `gym visit${t.visits === 1 ? "" : "s"} · ${Math.floor(t.gymMinutes / 60)} h ${t.gymMinutes % 60} m`]);
  return (
    <div className="flex h-full flex-col">
      <Rise i={0}><Kicker>Training</Kicker></Rise>
      <div className="my-auto">
        <Rise i={1}>
          <p className="font-display text-[5.5rem] font-semibold leading-none tabular text-jamun">
            <RollingNumber value={t.workoutDays} />
          </p>
          <p className="mt-1 text-xl font-semibold">workout {t.workoutDays === 1 ? "day" : "days"}</p>
        </Rise>
        <Rise i={2} className="mt-6"><WorkoutDots dots={t.dots} /></Rise>
        {t.top && (
          <Rise i={3}><p className="mt-6 text-lg">Favourite move: <span className="font-semibold">{t.top.name}</span> <span className="text-muted">({t.top.sets} sets)</span></p></Rise>
        )}
        {tiles.length > 0 && (
          <Rise i={4} className="mt-5 grid grid-cols-2 gap-3">
            {tiles.slice(0, 4).map(([big, small]) => <Stat key={small} big={big} small={small} tone="text-jamun" />)}
          </Rise>
        )}
        <Rise i={5} className="mt-5 space-y-3 text-sm">
          <div>
            <p className="mb-1.5 flex justify-between text-muted"><span>Cardio (WHO: {WHO_MOVE_MINUTES} min a week)</span><span className="tabular">{t.move} min</span></p>
            <Bar value={t.move} max={WHO_MOVE_MINUTES} tone="bg-jamun" />
          </div>
          <div>
            <p className="mb-1.5 flex justify-between text-muted"><span>Strength (WHO: {WHO_STRENGTH_DAYS} days)</span><span className="tabular">{t.strengthDays} days</span></p>
            <Bar value={t.strengthDays} max={WHO_STRENGTH_DAYS} tone="bg-jamun" />
          </div>
        </Rise>
      </div>
    </div>
  );
}

function Wins({ w }: { w: WrappedWeek }) {
  return (
    <div className="flex h-full flex-col">
      <Rise i={0}><Kicker>Wins</Kicker></Rise>
      <div className="my-auto space-y-8">
        {w.prs.length > 0 && (
          <Rise i={1}>
            <p className="font-display text-4xl font-semibold"><span aria-hidden>🏆</span> {w.prs.length} personal record{w.prs.length === 1 ? "" : "s"}</p>
            <ul className="mt-4 space-y-2.5">
              {w.prs.slice(0, 4).map((h) => (
                <li key={`${h.workoutId}-${h.kind}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/70 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{h.name}</p>
                    <p className="text-sm text-muted">{PR_LABEL[h.kind]} · {formatPr(h.kind, h)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-leaf/15 px-2.5 py-1 text-xs font-bold text-leaf">{formatGain(h)}</span>
                </li>
              ))}
            </ul>
            {w.prs.length > 4 && <p className="mt-2 text-sm text-muted">+{w.prs.length - 4} more</p>}
          </Rise>
        )}
        {w.badges.length > 0 && (
          <Rise i={2}>
            <p className="font-display text-3xl font-semibold">Badges earned</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {w.badges.slice(0, 6).map((b) => (
                <span key={`${b.id}-${b.tier}`} className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-2/70 px-3 py-1.5 text-sm font-semibold">
                  <span aria-hidden>{b.emoji}</span> {b.name}{b.tier != null && <span className="text-muted">· {TIER_NAME[b.tier]}</span>}
                </span>
              ))}
            </div>
          </Rise>
        )}
      </div>
    </div>
  );
}

/** Last card: the share image (drawn on the device) + Share / Save. */
function ShareCard({ w, name }: { w: WrappedWeek; name: string | null }) {
  const showToast = useUI((s) => s.showToast);
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let dead = false;
    drawShareCard(w, name)
      .then((blob) => {
        if (dead) return;
        url = URL.createObjectURL(blob);
        setImg({ blob, url });
      })
      .catch(() => !dead && setFailed(true));
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [w, name]);

  const share = async () => {
    if (!img || busy) return;
    setBusy(true);
    const r = await shareOrSave(img.blob, w);
    setBusy(false);
    if (r === "saved") showToast("Image saved.");
  };

  return (
    <div className="flex h-full flex-col">
      <Rise i={0}><Kicker>Share your week</Kicker></Rise>
      <Rise i={1} className="relative mx-auto my-auto aspect-[9/16] h-[min(52vh,30rem)] overflow-hidden rounded-3xl border border-line-strong shadow-2xl shadow-black/40">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local blob URL, not a remote image
          <img src={img.url} alt={`Weekly Wrapped image: ${w.persona.title}, ${w.food.onTarget} of 7 days on target`} className="size-full object-cover" />
        ) : failed ? (
          <p className="grid size-full place-items-center p-6 text-center text-sm text-muted">Couldn&apos;t draw the image on this device.</p>
        ) : (
          <div className="skeleton size-full rounded-none" />
        )}
      </Rise>
      <Rise i={2} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={share}
          disabled={!img || busy}
          className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-turmeric to-saffron py-3.5 font-bold text-on-accent disabled:opacity-50"
        >
          <Share2 size={18} /> Share
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => img && saveBlob(img.blob, `prana-wrapped-${w.from}.png`)}
          disabled={!img}
          aria-label="Save image"
          className="grid size-13 place-items-center rounded-2xl border border-line-strong disabled:opacity-50"
        >
          <Download size={18} />
        </motion.button>
      </Rise>
      <Rise i={3}><p className="mt-2 text-center text-xs text-faint">Habits only: no calories eaten or body weight in the image.</p></Rise>
    </div>
  );
}
