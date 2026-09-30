"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Replace, Sparkles, X } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { useAuth } from "@/lib/auth";
import { ownVersion, swapToChecked, useFoodNews, type FoodNews as News } from "@/lib/foodNews";
import { getFood } from "@/lib/foods";
import { mealForNow } from "@/lib/nutrition";
import { useUI } from "@/lib/store";

// "Your food is in Prana now" (D54 phase 5): a card on Today for each food this person asked for (or had to make
// themselves) that has since been added or found under another name. Log it, swap your own version for the checked
// one, or dismiss; each card shows once.

const SOURCE: Record<string, string> = {
  INDB: "INDB 2024", IFCT2017: "IFCT 2017", USDA: "USDA FoodData Central", DERIVED: "a recipe of sourced ingredients", MFR_LABEL: "the official label",
};
const SHOWN = 2;

export function FoodNews() {
  const signedIn = useAuth((s) => s.status === "signedIn");
  const items = useFoodNews((s) => s.items);
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (signedIn) void useFoodNews.getState().load();
  }, [signedIn]);

  const visible = all ? items : items.slice(0, SHOWN);
  return (
    <AnimatePresence initial={false}>
      {visible.map((n) => <NewsCard key={n.id} n={n} />)}
      {!all && items.length > SHOWN && (
        <motion.button key="more" layout onClick={() => setAll(true)} className="mb-4 w-full text-center text-xs font-semibold text-muted hover:text-text lg:mb-6">
          and {items.length - SHOWN} more food{items.length - SHOWN === 1 ? "" : "s"} you asked for
        </motion.button>
      )}
    </AnimatePresence>
  );
}

function NewsCard({ n }: { n: News }) {
  const food = getFood(n.foodId);
  const [own] = useState(() => ownVersion(n));
  if (!food) return null;
  const seen = () => useFoodNews.getState().seen([n.id]);

  const log = () => {
    seen();
    useUI.getState().openAdd(mealForNow(), food.id);
  };
  const swap = () => {
    if (!own) return;
    const undo = swapToChecked(own, food);
    seen();
    useUI.getState().showToast(`Using ${food.name} now. Old logs keep their numbers`, { label: "Undo", run: undo });
  };

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, x: 40, height: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="overflow-hidden"
    >
      <div className="card relative mb-4 overflow-hidden p-4 lg:mb-6">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-leaf opacity-20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="relative shrink-0">
            <FoodIcon cat={food.cat} size={48} />
            <motion.span
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 500, damping: 18 }}
              className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-leaf text-bg shadow"
            >
              <Sparkles size={13} />
            </motion.span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[17px] font-semibold leading-tight">
              {n.status === "found" ? <><span className="text-leaf">{food.name}</span> is in Prana now</> : <>“{n.name}” now finds <span className="text-leaf">{food.name}</span></>}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-muted">
              {n.status === "found"
                ? <>You asked for it. Checked against {SOURCE[food.src] ?? food.src}.</>
                : <>You asked for it: it was here under another name.</>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={log}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-turmeric to-saffron px-3.5 text-sm font-bold text-on-accent">
                <Plus size={16} strokeWidth={2.6} /> Log it
              </motion.button>
              {own && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={swap}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-leaf/40 bg-leaf/10 px-3 text-sm font-semibold text-leaf">
                  <Replace size={15} /> Use it instead of mine
                </motion.button>
              )}
            </div>
            {own && (
              <p className="mt-2 text-xs text-faint">
                You made “{own.name}” yourself. Swapping moves your thalis to the checked one; your past logs keep their numbers.
              </p>
            )}
          </div>
          <button onClick={seen} aria-label="Dismiss" className="relative grid size-8 shrink-0 place-items-center rounded-full text-faint hover:text-text">
            <X size={16} />
          </button>
        </div>
      </div>
    </motion.section>
  );
}
