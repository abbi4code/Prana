"use client";

import { Drawer } from "vaul";
import { motion } from "motion/react";
import { Sheet } from "@/components/Sheet";
import { useStore } from "@/lib/store";
import type { HealthInfo } from "@/lib/types";

// The questions the Body scores need (D55): INTERHEART non-lab items + the Indian Diabetes Risk Score's activity and
// family history. Every answer saves at once (synced with the goals); "Not sure" counts as no, like the scores do.

type Q<K extends keyof HealthInfo> = { key: K; q: string; hint?: string; options: { v: NonNullable<HealthInfo[K]>; label: string }[] };
type AnyQ = Q<keyof HealthInfo>;

const YN = [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }, { v: "unsure", label: "Not sure" }] as const;
const BOOL = [{ v: true, label: "Yes" }, { v: false, label: "No" }] as const;

const GROUPS: { title: string; items: AnyQ[] }[] = [
  {
    title: "Medical",
    items: [
      { key: "diabetes", q: "Has a doctor told you that you have diabetes?", options: [...YN] },
      { key: "highBp", q: "Has a doctor told you that you have high blood pressure?", options: [...YN] },
      { key: "parentHeart", q: "Did either of your parents have a heart attack?", options: [...YN] },
      { key: "parentsDiabetes", q: "How many of your parents have (or had) diabetes?", options: [{ v: 0, label: "Neither" }, { v: 1, label: "One" }, { v: 2, label: "Both" }] },
    ] as AnyQ[],
  },
  {
    title: "Daily life",
    items: [
      {
        key: "activity", q: "How active are you?", hint: "Exercise plus work at home or on the job",
        options: [{ v: "vigorous", label: "Very: regular exercise or hard physical work" }, { v: "moderate", label: "Moderately" }, { v: "mild", label: "Lightly" }, { v: "none", label: "Mostly sitting, no exercise" }],
      },
      { key: "secondHand", q: "Are you around other people's smoke for an hour or more a week?", options: [...BOOL] },
      { key: "stress", q: "Stress at work or at home: several periods or all the time, in the past year?", options: [...BOOL] },
      { key: "lowMood", q: "Have you felt sad or low for 2 weeks or more in a row in the past year?", options: [...BOOL] },
    ] as AnyQ[],
  },
  {
    title: "Food",
    items: [
      { key: "saltyDaily", q: "Salty food or snacks at least once a day?", options: [...BOOL] },
      { key: "friedOften", q: "Deep-fried food, snacks or fast food 3 or more times a week?", options: [...BOOL] },
      { key: "fruitDaily", q: "Fruit at least once a day?", options: [...BOOL] },
      { key: "vegDaily", q: "Vegetables at least once a day?", options: [...BOOL] },
      { key: "meatTwiceDaily", q: "Meat or chicken twice a day or more?", options: [...BOOL] },
    ] as AnyQ[],
  },
];

/** Questions still unanswered (for "N to answer"). */
export const unanswered = (a: HealthInfo) => GROUPS.flatMap((g) => g.items).filter((q) => a[q.key] === undefined);

export function HealthQuestions({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} size={open ? "narrow" : undefined}>
      {open && <Questions onClose={onClose} />}
    </Sheet>
  );
}

function Questions({ onClose }: { onClose: () => void }) {
  const health = useStore((s) => s.health);
  const setHealth = useStore((s) => s.setHealth);
  const left = unanswered(health).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Health questions</Drawer.Title>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Body report</p>
        <h2 className="font-display text-2xl font-semibold">A few questions</h2>
        <p className="mt-1 text-sm text-muted">They feed your heart score and diabetes score. Saved as you tap; change them any time.</p>
        {GROUPS.map((g) => (
          <div key={g.title} className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{g.title}</p>
            <ul className="mt-2 space-y-2.5">
              {g.items.map((q) => (
                <li key={q.key} className="rounded-2xl border border-line-strong bg-surface-2/50 p-3.5">
                  <p className="text-sm font-semibold">{q.q}</p>
                  {q.hint && <p className="mt-0.5 text-xs text-muted">{q.hint}</p>}
                  <div className={`mt-2.5 ${q.options.length > 3 ? "grid grid-cols-1 gap-1.5 sm:grid-cols-2" : "flex flex-wrap gap-1.5"}`}>
                    {q.options.map((o) => {
                      const on = health[q.key] === o.v;
                      return (
                        <motion.button
                          key={String(o.v)}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setHealth({ [q.key]: o.v } as Partial<HealthInfo>)}
                          aria-pressed={on}
                          className={`rounded-full border px-3.5 py-1.5 text-left text-xs font-semibold transition-colors ${on ? "border-transparent bg-cream text-bg" : "border-line-strong text-muted hover:text-text"}`}
                        >
                          {o.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} className="h-14 w-full rounded-2xl bg-gradient-to-r from-turmeric to-saffron font-bold text-on-accent">
          {left ? `Done · ${left} left` : "Done"}
        </motion.button>
      </div>
    </div>
  );
}
