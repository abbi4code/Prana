"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, Mic, Minus, Plus, Search, Sparkles, TriangleAlert, X } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { RollingNumber } from "@/components/RollingNumber";
import { getFood, getUnit, matchFood, searchFoods } from "@/lib/foods";
import { logCorrection } from "@/lib/nl/corrections";
import { LOW_CONFIDENCE, confidenceOf, type Candidate } from "@/lib/nl/match";
import type { ParsedItem, ParsedLog } from "@/lib/nl/schema";
import { resolveUnit } from "@/lib/nl/units";
import { MEALS, fmtQty, portion, qtyOptions } from "@/lib/nutrition";
import { useStore, useUI } from "@/lib/store";
import type { LogSource, Meal } from "@/lib/types";

type Row = {
  key: number;
  said: ParsedItem;
  cands: Candidate[];
  confidence: number;
  foodId: string | null;
  unitId: string;
  qty: number;
  note?: string;
};

const MIN_MATCH = 0.45; // below this we don't guess; the row asks the user to pick

function buildRows(parsed: ParsedLog, history: ReadonlySet<string>): Row[] {
  return parsed.items.map((said, key) => {
    const cands = matchFood(said.name, 4, history);
    const top = cands[0];
    if (!top || top.score < MIN_MATCH) return { key, said, cands, confidence: 0, foodId: null, unitId: "", qty: said.qty ?? 1 };
    const r = resolveUnit(top.food, said.unit, said.qty);
    return { key, said, cands, confidence: confidenceOf(cands), foodId: top.food.id, ...r };
  });
}

/**
 * Step 6 of the pipeline (nl-logging.md): show what we understood, let the user fix anything, and only
 * then log. All numbers here come from the catalog + portion() maths, never from the AI.
 */
export function ConfirmParse({ text, source, parsed, initialMeal, date, onBack, onLogged }: {
  text: string;
  source: Exclude<LogSource, "manual">;
  parsed: ParsedLog;
  initialMeal: Meal;
  date: string;
  onBack: () => void;
  onLogged: (ids: string[], meal: Meal) => void;
}) {
  const addEntries = useStore((s) => s.addEntries);
  const entries = useStore((s) => s.entries);
  // foods this user actually logs: they win ties ("biryani" → the one you usually have)
  const history = useMemo(() => new Set(entries.map((e) => e.foodId)), [entries]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rows are built once per parse, not on every new log
  const initial = useMemo(() => buildRows(parsed, history), [parsed]);
  const [rows, setRows] = useState<Row[]>(initial);
  const [meal, setMeal] = useState<Meal>(parsed.meal ?? initialMeal);

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const pick = (key: number, foodId: string) => {
    const row = rows.find((r) => r.key === key)!;
    const food = getFood(foodId)!;
    update(key, { foodId, confidence: 1, ...resolveUnit(food, row.said.unit, row.said.qty), note: undefined });
    navigator.vibrate?.(8);
  };

  const lines = rows.map((r) => {
    const food = r.foodId ? getFood(r.foodId) : undefined;
    const unit = food ? getUnit(food, r.unitId) : undefined;
    return { r, food, unit, n: food && unit ? portion(food, unit, r.qty) : null };
  });
  const total = lines.reduce((t, l) => ({ kcal: t.kcal + (l.n?.kcal ?? 0), p: t.p + (l.n?.p ?? 0) }), { kcal: 0, p: 0 });
  const unresolved = rows.filter((r) => !r.foodId).length;

  const confirm = () => {
    const items = rows.filter((r) => r.foodId).map((r) => ({ foodId: r.foodId!, unitId: r.unitId, qty: r.qty }));
    if (!items.length || unresolved) return;
    const ids = addEntries(items, meal, date, { source, rawInput: text });
    ids.forEach((id) => useUI.getState().markFresh(id));

    // learning signal: what changed between our first guess and what the user confirmed
    const guess = { meal: parsed.meal ?? initialMeal, items: initial.map((r) => ({ said: r.said, foodId: r.foodId, unitId: r.unitId, qty: r.qty })) };
    const final = { meal, items: rows.map((r) => ({ said: r.said, foodId: r.foodId, unitId: r.unitId, qty: r.qty })) };
    if (JSON.stringify(guess) !== JSON.stringify(final)) logCorrection(text, { parse: parsed, guess }, final);

    navigator.vibrate?.(12);
    onLogged(ids, meal);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex items-center gap-2 pt-1">
          <button onClick={onBack} aria-label="Back" className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
            <ChevronLeft size={24} />
          </button>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold leading-tight">
              <Sparkles size={17} className="text-turmeric" /> Check &amp; log
            </h2>
            <p className="flex items-center gap-1.5 truncate text-sm text-muted">
              {source === "voice" && <Mic size={13} className="shrink-0" />}
              <span className="truncate italic">“{text}”</span>
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2.5">
          <AnimatePresence initial={false}>
            {lines.map(({ r, food, unit, n }, i) => (
              <motion.li
                key={r.key}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className={`rounded-2xl border p-3 ${food ? "border-line bg-surface-2" : "border-dashed border-saffron/50 bg-saffron/5"}`}
              >
                {food && unit && n ? (
                  <MatchedRow
                    row={r}
                    food={food}
                    unitKind={unit.kind}
                    kcal={n.kcal}
                    grams={n.grams}
                    onQty={(qty) => update(r.key, { qty })}
                    onUnit={(unitId) => {
                      const u = getUnit(food, unitId);
                      update(r.key, { unitId, qty: u.kind === "g" ? Math.max(10, Math.round(n.grams / 10) * 10) : 1, note: undefined });
                    }}
                    onPick={(id) => pick(r.key, id)}
                    onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  />
                ) : (
                  <UnmatchedRow row={r} onPick={(id) => pick(r.key, id)} onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {!rows.length && <p className="py-8 text-center text-sm text-muted">Nothing left to log. Go back to search instead.</p>}

        <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Meal</p>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {MEALS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMeal(m.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${meal === m.id ? "bg-cream text-bg" : "bg-surface-2 text-muted"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-faint">
          AI only read your words. Every calorie here comes from Prana&apos;s food data. Nothing is saved until you tap Log.
        </p>
      </div>

      <div className="flex items-center gap-4 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        <div className="shrink-0">
          <p className="font-display text-2xl font-semibold leading-none"><RollingNumber value={total.kcal} /></p>
          <p className="mt-1 text-[11px] text-muted tabular">kcal · P {Math.round(total.p)}g</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!rows.length || unresolved > 0}
          onClick={confirm}
          className="h-14 flex-1 rounded-2xl bg-gradient-to-r from-turmeric to-saffron text-base font-bold text-on-accent disabled:opacity-40"
        >
          {unresolved ? `Pick ${unresolved} food${unresolved === 1 ? "" : "s"} first` : `Log ${rows.length} item${rows.length === 1 ? "" : "s"} to ${MEALS.find((m) => m.id === meal)!.label}`}
        </motion.button>
      </div>
    </div>
  );
}

function MatchedRow({ row, food, unitKind, kcal, grams, onQty, onUnit, onPick, onRemove }: {
  row: Row;
  food: NonNullable<ReturnType<typeof getFood>>;
  unitKind: Parameters<typeof qtyOptions>[0];
  kcal: number;
  grams: number;
  onQty: (q: number) => void;
  onUnit: (id: string) => void;
  onPick: (foodId: string) => void;
  onRemove: () => void;
}) {
  const [swapping, setSwapping] = useState(false);
  const opts = qtyOptions(unitKind);
  const unsure = row.confidence < LOW_CONFIDENCE;
  const alts = row.cands.filter((c) => c.food.id !== food.id).slice(0, 3);
  const step = (dir: 1 | -1) => onQty(Math.max(opts.min, Math.round((row.qty + dir * opts.step) * 100) / 100));

  return (
    <>
      <div className="flex items-center gap-3">
        <FoodIcon cat={food.cat} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{food.name}</p>
          {row.said.name !== food.name.toLowerCase() && <p className="truncate text-xs text-faint">you said “{row.said.name}”</p>}
        </div>
        <span className="font-display text-lg font-semibold tabular">
          {food.fried && <span className="text-muted">~</span>}
          {kcal}
        </span>
        <button onClick={onRemove} aria-label={`Remove ${food.name}`} className="grid size-8 place-items-center rounded-full text-faint hover:text-chilli">
          <X size={16} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <Step onClick={() => step(-1)} label="Less"><Minus size={14} /></Step>
        <span className="w-10 text-center text-sm font-bold tabular">{unitKind === "g" ? row.qty : fmtQty(row.qty)}</span>
        <Step onClick={() => step(1)} label="More"><Plus size={14} /></Step>
        <select
          value={row.unitId}
          onChange={(e) => onUnit(e.target.value)}
          className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface px-2 py-1.5 text-xs text-muted outline-none"
        >
          {food.units.map((u) => <option key={u.id} value={u.id}>{u.kind === "g" ? "grams" : u.label}</option>)}
        </select>
        <span className="shrink-0 text-xs text-faint tabular">{grams} g</span>
      </div>

      {row.note && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-saffron">
          <TriangleAlert size={12} className="shrink-0" /> {row.note}
        </p>
      )}
      {grams > 1000 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-chilli">
          <TriangleAlert size={12} className="shrink-0" /> That&apos;s {grams.toLocaleString("en-IN")} g. Check the amount.
        </p>
      )}

      {(unsure || swapping) && (
        <div className="mt-2.5">
          {unsure && !swapping && <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-saffron">Did you mean?</p>}
          <div className="flex flex-wrap gap-1.5">
            {alts.map((c) => (
              <button key={c.food.id} onClick={() => onPick(c.food.id)} className="rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-semibold hover:border-turmeric/60">
                {c.food.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {swapping ? (
        <FoodPicker initial={row.said.name} onPick={(id) => { onPick(id); setSwapping(false); }} onCancel={() => setSwapping(false)} />
      ) : (
        <button onClick={() => setSwapping(true)} className="mt-2 text-xs font-semibold text-muted underline-offset-2 hover:text-text hover:underline">
          Wrong food? Change it
        </button>
      )}
    </>
  );
}

function UnmatchedRow({ row, onPick, onRemove }: { row: Row; onPick: (id: string) => void; onRemove: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <TriangleAlert size={16} className="shrink-0 text-saffron" />
        <p className="min-w-0 flex-1 text-sm">
          Couldn&apos;t find <span className="font-semibold">“{row.said.name}”</span>. Pick the closest food:
        </p>
        <button onClick={onRemove} aria-label="Remove" className="grid size-8 place-items-center rounded-full text-faint hover:text-chilli">
          <X size={16} />
        </button>
      </div>
      <FoodPicker initial={row.said.name} onPick={onPick} />
    </>
  );
}

/** Inline search for swapping or choosing a food on the confirm card. */
function FoodPicker({ initial, onPick, onCancel }: { initial: string; onPick: (id: string) => void; onCancel?: () => void }) {
  const [q, setQ] = useState(initial);
  const results = useMemo(() => searchFoods(q, 5), [q]);
  return (
    <div className="mt-2 rounded-xl border border-line-strong bg-surface p-1.5">
      <label className="flex items-center gap-2 px-1.5 py-1">
        <Search size={14} className="text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-sm outline-none" />
        {onCancel && <button onClick={onCancel} aria-label="Cancel" className="text-muted"><X size={14} /></button>}
      </label>
      {results.map((f) => (
        <button key={f.id} onClick={() => onPick(f.id)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-surface-2">
          <FoodIcon cat={f.cat} size={26} />
          <span className="truncate">{f.name}</span>
        </button>
      ))}
      {!results.length && <p className="px-2 py-1 text-xs text-faint">No match. Try another word.</p>}
    </div>
  );
}

function Step({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={onClick} aria-label={label} className="grid size-7 place-items-center rounded-full border border-line-strong text-muted hover:text-text">
      {children}
    </motion.button>
  );
}
