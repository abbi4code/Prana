"use client";

import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { Check, Flame, Search, X } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { FOODS, STARTER_IDS, getFood, searchFoods } from "@/lib/foods";
import { addDays, dayKey } from "@/lib/dates";
import { MEALS } from "@/lib/nutrition";
import { useStore, useUI } from "@/lib/store";
import { useIsDesktop } from "@/lib/useMediaQuery";
import type { Food, Meal } from "@/lib/types";
import { FoodDetail } from "./FoodDetail";

export function LogSheet() {
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.close);
  const desktop = useIsDesktop();

  // phone: bottom sheet; desktop: panel sliding in from the right
  return (
    <Drawer.Root
      key={desktop ? "side" : "bottom"}
      open={!!sheet}
      onOpenChange={(o) => !o && close()}
      direction={desktop ? "right" : "bottom"}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]" />
        <Drawer.Content
          className={`fixed z-50 flex flex-col border-line-strong bg-surface outline-none after:hidden ${
            desktop
              ? "inset-y-3 right-3 w-[460px] rounded-[2rem] border pt-5 shadow-2xl shadow-black/60"
              : "inset-x-0 bottom-0 mx-auto h-[92dvh] max-w-md rounded-t-[2rem] border-t"
          }`}
          style={desktop ? ({ "--initial-transform": "calc(100% + 12px)" } as React.CSSProperties) : undefined}
        >
          {!desktop && <div className="mx-auto mb-2 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />}
          {sheet?.mode === "add" && <AddFlow key="add" meal={sheet.meal} />}
          {sheet?.mode === "edit" && <EditFlow key={sheet.entryId} entryId={sheet.entryId} />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function AddFlow({ meal: initialMeal }: { meal: Meal }) {
  const date = useUI((s) => s.date) ?? dayKey();
  const close = useUI((s) => s.close);
  const addEntry = useStore((s) => s.addEntry);
  const entries = useStore((s) => s.entries);
  const desktop = useIsDesktop();

  const [meal, setMeal] = useState(initialMeal);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [added, setAdded] = useState<{ name: string; kcal: number }[]>([]);

  // recents: last distinct foods; frequent: most logged in the last 30 days
  const { recent, frequent } = useMemo(() => {
    const since = addDays(date, -30);
    const counts = new Map<string, number>();
    const lastUnit = new Map<string, { unitId: string; qty: number }>();
    const recentIds: string[] = [];
    for (const e of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!recentIds.includes(e.foodId)) recentIds.push(e.foodId);
      if (!lastUnit.has(e.foodId)) lastUnit.set(e.foodId, { unitId: e.unitId, qty: e.qty });
      if (e.date >= since) counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1);
    }
    const freq = [...counts.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const pick = (ids: string[]) => ids.map(getFood).filter(Boolean) as Food[];
    return {
      recent: pick(recentIds.slice(0, 8)).map((f) => ({ food: f, last: lastUnit.get(f.id) })),
      frequent: pick(freq.filter((id) => !recentIds.slice(0, 8).includes(id)).slice(0, 8)),
    };
  }, [entries, date]);

  const results = useMemo(() => searchFoods(query), [query]);
  const lastFor = (id: string) => recent.find((r) => r.food.id === id)?.last;

  if (selected) {
    const last = lastFor(selected.id);
    return (
      <>
      <Drawer.Title className="sr-only">{selected.name}</Drawer.Title>
      <FoodDetail
        food={selected}
        initial={{ unitId: last?.unitId ?? selected.du, qty: last?.qty ?? 1, meal }}
        confirmLabel={(m) => `Add to ${m}`}
        onBack={() => setSelected(null)}
        onConfirm={(v) => {
          addEntry(selected.id, v.unitId, v.qty, v.meal, date);
          const e = useStore.getState().entries.at(-1);
          setAdded((a) => [...a, { name: selected.name, kcal: e?.kcal ?? 0 }]);
          setMeal(v.meal);
          setSelected(null);
          setQuery("");
          navigator.vibrate?.(12);
        }}
      />
      </>
    );
  }

  const showingSearch = query.trim().length > 0;
  const starter = STARTER_IDS.map(getFood).filter(Boolean) as Food[];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Log food</Drawer.Title>
      <div className="px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Add food</h2>
          <button
            onClick={close}
            className={`rounded-full px-4 py-2 text-sm font-bold ${added.length ? "bg-leaf text-bg" : "text-muted"}`}
          >
            {added.length ? `Done · ${added.length}` : <X size={20} />}
          </button>
        </div>

        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {MEALS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMeal(m.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                meal === m.id ? "bg-cream text-bg" : "bg-surface-2 text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-line-strong bg-bg/60 px-4 py-3.5 focus-within:border-turmeric/60">
          <Search size={19} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="dal, roti, dahi, chai…"
            className="w-full bg-transparent text-base outline-none placeholder:text-faint"
            autoComplete="off"
            autoFocus={desktop}
            enterKeyHint="search"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear" className="text-muted">
              <X size={18} />
            </button>
          )}
        </label>

        <AnimatePresence>
          {added.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5"
            >
              {added.map((a, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-leaf/15 px-3 py-1 text-xs font-semibold text-leaf"
                >
                  <Check size={13} /> {a.name} · {a.kcal}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1.5rem+var(--safe-bottom))]">
        {showingSearch ? (
          results.length ? (
            <FoodList foods={results} onPick={setSelected} />
          ) : (
            <p className="px-2 py-10 text-center text-sm text-muted">
              No match for “{query}”. Try another name. {FOODS.length} foods so far, more coming.
            </p>
          )
        ) : (
          <>
            {recent.length > 0 && <Section title="Recent" foods={recent.map((r) => r.food)} onPick={setSelected} />}
            {frequent.length > 0 && <Section title="You eat these often" foods={frequent} onPick={setSelected} />}
            {recent.length === 0 && <Section title="Popular" foods={starter} onPick={setSelected} />}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, foods, onPick }: { title: string; foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <div className="mt-3">
      <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{title}</p>
      <FoodList foods={foods} onPick={onPick} />
    </div>
  );
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <ul>
      {foods.map((f) => {
        const u = f.units.find((x) => x.id === f.du)!;
        return (
          <li key={f.id}>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => onPick(f)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2 active:bg-surface-2"
            >
              <FoodIcon cat={f.cat} size={42} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{f.name}</span>
                  {f.uncooked && <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">Uncooked</span>}
                </p>
                <p className="truncate text-[13px] text-muted">
                  {u.label} {f.hi && <span className="text-faint">· {f.hi}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 text-right">
                {f.fried && <Flame size={13} className="text-saffron" />}
                <span className="font-display font-semibold tabular">{Math.round((f.kcal * u.g) / 100)}</span>
                <span className="text-xs text-muted">kcal</span>
              </div>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}

function EditFlow({ entryId }: { entryId: string }) {
  const entry = useStore((s) => s.entries.find((e) => e.id === entryId));
  const updateEntry = useStore((s) => s.updateEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const close = useUI((s) => s.close);
  const food = entry && getFood(entry.foodId);
  if (!entry || !food) return null;

  return (
    <>
      <Drawer.Title className="sr-only">Edit {entry.name}</Drawer.Title>
      <FoodDetail
        food={food}
        initial={{ unitId: entry.unitId, qty: entry.qty, meal: entry.meal }}
        confirmLabel={() => "Save"}
        onConfirm={(v) => {
          updateEntry(entry.id, v);
          close();
        }}
        onDelete={() => {
          removeEntry(entry.id);
          close();
        }}
      />
    </>
  );
}
