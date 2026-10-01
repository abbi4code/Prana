"use client";

import { useMemo } from "react";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { currentWeight } from "@/lib/energy";
import { getFood } from "@/lib/foods";
import { useStore } from "@/lib/store";
import type { TobaccoKind } from "@/lib/types";
import { HEAVY_EPISODE_G, KCAL_PER_G, ethanolG } from "./alcohol";

/** Days between two day keys (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);

/** How far back the daily tobacco average looks (fewer days if Habits was turned on more recently). */
const AVG_DAYS = 14;
/** Alcohol is averaged over 4 weeks: one party shouldn't swing the numbers. */
const ALC_DAYS = 28;

/**
 * Everything the Health tab reads (D55), derived from the store in one place: body numbers, smoking status and
 * amounts from the tobacco log (else the answers), alcohol from logged drinks.
 */
export function useHealth() {
  const profile = useStore((s) => s.profile);
  const weights = useStore((s) => s.weights);
  const measurements = useStore((s) => s.measurements);
  const bp = useStore((s) => s.bp);
  const habitDays = useStore((s) => s.habitDays);
  const health = useStore((s) => s.health);
  const entries = useStore((s) => s.entries);

  return useMemo(() => {
    const today = dayKey();
    const sex = profile?.sex ?? null;
    const age = profile?.age ?? null;
    const heightCm = profile?.heightCm ?? null;
    const weight = currentWeight(weights, profile);
    const bmi = weight && heightCm ? Math.round((weight.kg / (heightCm / 100) ** 2) * 10) / 10 : null;

    const withSite = (site: "waist" | "hips") => [...measurements].reverse().find((m) => m.cm[site] != null);
    const waistM = withSite("waist");
    const hipsM = withSite("hips");
    const waistCm = waistM?.cm.waist ?? null;
    const hipsCm = hipsM?.cm.hips ?? null;
    // waist ÷ hip only when both were measured within a month of each other
    const whr = waistM && hipsM && Math.abs(daysBetween(waistM.date, hipsM.date)) <= 31 ? Math.round((waistCm! / hipsCm!) * 100) / 100 : null;
    const whtr = waistCm && heightCm ? Math.round((waistCm / heightCm) * 100) / 100 : null;

    // blood pressure: average of the readings in the 7 days ending at the latest one (home readings vary day to day)
    const lastBp = bp.at(-1) ?? null;
    const bpWin = lastBp ? bp.filter((r) => r.date >= addDays(lastBp.date, -6) && r.date <= lastBp.date) : [];
    const bpAvg = bpWin.length
      ? { sys: Math.round(bpWin.reduce((t, r) => t + r.sys, 0) / bpWin.length), dia: Math.round(bpWin.reduce((t, r) => t + r.dia, 0) / bpWin.length), n: bpWin.length, date: lastBp!.date }
      : null;

    // tobacco: average a day over the last 14 days (or since Habits started), per kind
    // from Habits being turned on, or earlier if past days were filled in (Edit days)
    const first = habitDays[0]?.date;
    const since = health.habitsSince && first ? (first < health.habitsSince ? first : health.habitsSince) : health.habitsSince ?? first ?? today;
    const from = since > addDays(today, -(AVG_DAYS - 1)) ? since : addDays(today, -(AVG_DAYS - 1));
    const nDays = Math.max(1, daysBetween(from, today) + 1);
    const perDay: Record<TobaccoKind, number> = { cigarette: 0, bidi: 0, chew: 0, hookah: 0, vape: 0 };
    for (const d of habitDays) if (d.date >= from && d.date <= today) for (const [k, v] of Object.entries(d.counts)) perDay[k as TobaccoKind] += (v ?? 0) / nDays;
    const lastSmoke = [...habitDays].reverse().find((d) => (d.counts.cigarette ?? 0) + (d.counts.bidi ?? 0) > 0)?.date ?? null;
    const lastTobacco = [...habitDays].reverse().find((d) => Object.values(d.counts).some((v) => (v ?? 0) > 0))?.date ?? null;
    const loggedSmoke = perDay.cigarette + perDay.bidi;

    // smoking status: the log wins (smoked in the last 30 days = current), else the answers
    const smokedRecently = lastSmoke != null && daysBetween(lastSmoke, today) <= 30;
    const status: "never" | "former" | "current" = smokedRecently ? "current" : lastSmoke || health.smoker === "former" ? "former" : health.smoker ?? "never";
    const quitOn = status === "former" ? (lastSmoke ? addDays(lastSmoke, 1) : health.quitOn ?? null) : null;
    // amount a day: the log when there is one, else the usual amount they told us
    const smokes = loggedSmoke > 0 ? loggedSmoke : status === "current" ? health.pastPerDay ?? 0 : 0;
    const usualBefore = health.pastPerDay ?? (loggedSmoke > 0 ? loggedSmoke : null);

    // alcohol from logged drinks (D53: `alc` g per 100 g/ml)
    const alcFrom = addDays(today, -(ALC_DAYS - 1));
    const gByDay = new Map<string, number>();
    for (const e of entries) {
      if (e.date < alcFrom || e.date > today) continue;
      const g = ethanolG(e.grams, getFood(e.foodId)?.alc);
      if (g > 0) gByDay.set(e.date, (gByDay.get(e.date) ?? 0) + g);
    }
    const alcTotal = [...gByDay.values()].reduce((t, g) => t + g, 0);
    const week = [...gByDay].filter(([d]) => d > addDays(today, -7)).reduce((t, [, g]) => t + g, 0);
    const alcohol = {
      days: ALC_DAYS,
      gPerDay: alcTotal / ALC_DAYS,
      gPerWeek: (alcTotal / ALC_DAYS) * 7,
      thisWeekG: week,
      drinkingDays: gByDay.size,
      heavyDays: [...gByDay.values()].filter((g) => g >= HEAVY_EPISODE_G).length,
      kcal: Math.round(alcTotal * KCAL_PER_G),
      any: alcTotal > 0,
    };

    return {
      today, sex, age, heightCm, weight, bmi, waistCm, hipsCm, whr, whtr, bpAvg, lastBp,
      tobacco: { perDay, nDays, smokes, status, quitOn, lastSmoke, lastTobacco, usualBefore, since },
      alcohol, health,
    };
  }, [profile, weights, measurements, bp, habitDays, health, entries]);
}

export type HealthData = ReturnType<typeof useHealth>;
