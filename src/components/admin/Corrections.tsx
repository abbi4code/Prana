"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getActivity, getExercise } from "@/lib/exercises";
import { getFood } from "@/lib/foods";
import { MEALS } from "@/lib/nutrition";
import { Empty, ago } from "./ui";

// What people fixed on the AI confirm card (parse_corrections, nl-logging.md). Each fix is a hint for
// data/aliases.json or a new eval case: "daal makhni" matched the wrong dal, a quantity was misheard…

type FoodSnap = { said?: string; foodId?: string | null; unitId?: string; qty?: number };
type WorkSnap = { said?: string; pick?: { kind: "lift" | "cardio"; id: string } | null };
type Snap = { day?: string; meal?: string; items?: FoodSnap[]; workouts?: WorkSnap[] };

const foodName = (id?: string | null) => (id ? getFood(id)?.name ?? id : "nothing");
const workName = (p?: WorkSnap["pick"]) => (p ? (p.kind === "lift" ? getExercise(p.id)?.name : getActivity(p.id)?.name) ?? p.id : "nothing");
const mealName = (m?: string) => MEALS.find((x) => x.id === m)?.label ?? m;

/** Plain-language changes between the first guess and what the user confirmed. */
export function correctionChanges(parsed: unknown, confirmed: unknown): string[] {
  const guess = ((parsed as { guess?: Snap } | null)?.guess ?? {}) as Snap;
  const final = (confirmed ?? {}) as Snap;
  const out: string[] = [];
  const gi = guess.items ?? [], fi = final.items ?? [];
  for (let i = 0; i < Math.max(gi.length, fi.length); i++) {
    const g = gi[i], f = fi[i];
    const said = g?.said ?? f?.said ?? "?";
    if (g && !f) out.push(`removed “${said}”`);
    else if (!g && f) out.push(`added ${foodName(f.foodId)}`);
    else if (g && f) {
      if (g.foodId !== f.foodId) out.push(`“${said}”: ${foodName(g.foodId)} → ${foodName(f.foodId)}`);
      else if (g.qty !== f.qty || g.unitId !== f.unitId) out.push(`“${said}”: amount ${g.qty ?? "?"} → ${f.qty ?? "?"}${g.unitId !== f.unitId ? " (unit changed)" : ""}`);
    }
  }
  const gw = guess.workouts ?? [], fw = final.workouts ?? [];
  for (let i = 0; i < Math.max(gw.length, fw.length); i++) {
    const g = gw[i], f = fw[i];
    const said = g?.said ?? f?.said ?? "?";
    if (g && !f) out.push(`removed workout “${said}”`);
    else if (g && f && JSON.stringify(g.pick) !== JSON.stringify(f.pick)) out.push(`“${said}”: ${workName(g.pick)} → ${workName(f.pick)}`);
  }
  if (guess.meal && final.meal && guess.meal !== final.meal) out.push(`meal ${mealName(guess.meal)} → ${mealName(final.meal)}`);
  if (guess.day && final.day && guess.day !== final.day) out.push("changed the day");
  return out.length ? out : ["numbers edited (sets, reps or minutes)"];
}

export function CorrectionList({ items, showUser = false }: {
  items: { id: string; raw: string; parsed: unknown; confirmed: unknown; at: string; user?: string; email?: string | null }[];
  showUser?: boolean;
}) {
  if (!items.length) return <Empty text="No corrections: the AI got every confirmed sentence right." />;
  return (
    <ul className="divide-y divide-line">
      {items.map((c) => (
        <li key={c.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 font-semibold">&ldquo;{c.raw}&rdquo;</p>
            <span className="shrink-0 text-[11px] text-faint">{ago(c.at)}</span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {correctionChanges(c.parsed, c.confirmed).map((t, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted">
                <ArrowRight size={12} className="mt-0.5 shrink-0 text-saffron" /> {t}
              </li>
            ))}
          </ul>
          {showUser && c.user && (
            <Link href={`/admin/u/${c.user}`} className="mt-1 inline-block text-[11px] font-semibold text-faint hover:text-text">{c.email ?? c.user}</Link>
          )}
        </li>
      ))}
    </ul>
  );
}
