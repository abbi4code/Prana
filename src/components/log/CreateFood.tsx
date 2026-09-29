"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { useStore } from "@/lib/store";
import type { Category, Food } from "@/lib/types";

const KINDS: { cat: Category; label: string }[] = [
  { cat: "snack", label: "Snack" },
  { cat: "sabzi", label: "Meal" },
  { cat: "breakfast", label: "Breakfast" },
  { cat: "cereal", label: "Oats/muesli" },
  { cat: "sweet", label: "Sweet" },
  { cat: "beverage", label: "Drink" },
  { cat: "alcohol", label: "Alcohol" },
  { cat: "dairy", label: "Dairy" },
  { cat: "fruit", label: "Fruit" },
  { cat: "supplement", label: "Supplement" },
  { cat: "condiment", label: "Other" },
];

type Basis = "serving" | "100g";

/** "Create your own food": for anything missing, typically copied from a packet's label. */
export function CreateFood({ initialName, onBack, onCreated }: { initialName: string; onBack: () => void; onCreated: (f: Food) => void }) {
  const addCustomFood = useStore((s) => s.addCustomFood);
  const [name, setName] = useState(initialName);
  const [cat, setCat] = useState<Category>("snack");
  const [basis, setBasis] = useState<Basis>("serving");
  const [servingName, setServingName] = useState("serving");
  const [servingG, setServingG] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const grams = num(servingG);
  const k = num(kcal);
  // label values → per 100 g
  const scale = basis === "100g" ? 1 : grams ? 100 / grams : null;
  const per100 = (v: number | null) => (v == null || scale == null ? null : Math.round(v * scale * 10) / 10);

  const macroKcal = [p, c].reduce((t, v) => t + 4 * (num(v) ?? 0), 0) + 9 * (num(f) ?? 0);
  const macrosOff = k && (p || c || f) && Math.abs(macroKcal - k) / k > 0.25;
  const valid = name.trim().length > 1 && k != null && k >= 0 && grams != null && grams > 0 && scale != null;

  const save = () => {
    if (!valid) return;
    const unitLabel = `1 ${servingName.trim() || "serving"} (${grams} g)`;
    const food: Food = {
      id: `custom-${crypto.randomUUID()}`,
      name: name.trim(),
      hi: null,
      aliases: [],
      cat,
      diet: "veg",
      kcal: per100(k)!,
      p: per100(num(p)),
      c: per100(num(c)),
      f: per100(num(f)),
      fib: null,
      units: [
        { id: "serving", kind: "piece", label: unitLabel, g: grams! },
        { id: "g", kind: "g", label: "grams", g: 1 },
      ],
      du: "serving",
      conf: "user",
      src: "USER",
      fried: false,
      uncooked: false,
      note: null,
    };
    addCustomFood(food);
    onCreated(food);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">
        <div className="flex items-center gap-3 pt-1">
          <button onClick={onBack} aria-label="Back" className="-ml-2 grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
            <ChevronLeft size={24} />
          </button>
          <FoodIcon cat={cat} size={40} />
          <div>
            <h2 className="font-display text-xl font-semibold leading-tight">Create a food</h2>
            <p className="text-sm text-muted">Copy it from the packet label</p>
          </div>
        </div>

        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amul Taaza milk" className={input} autoFocus />
        </Field>

        <p className={labelCls}>Type</p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((x) => (
            <Pill key={x.cat} active={cat === x.cat} onClick={() => setCat(x.cat)}>{x.label}</Pill>
          ))}
        </div>

        <p className={labelCls}>Label values are for</p>
        <div className="flex rounded-2xl border border-line-strong bg-surface-2 p-1">
          {(["serving", "100g"] as Basis[]).map((b) => (
            <button
              key={b}
              onClick={() => setBasis(b)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${basis === b ? "bg-cream text-bg" : "text-muted"}`}
            >
              {b === "serving" ? "1 serving" : "100 g / 100 ml"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_7rem] gap-2">
          <Field label="Serving is called">
            <input value={servingName} onChange={(e) => setServingName(e.target.value)} placeholder="packet, glass, piece" className={input} />
          </Field>
          <Field label="Size (g/ml)">
            <input value={servingG} onChange={(e) => setServingG(e.target.value)} inputMode="decimal" placeholder="70" className={input} />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <Field label="kcal"><input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" className={input} /></Field>
          <Field label="Protein"><input value={p} onChange={(e) => setP(e.target.value)} inputMode="decimal" placeholder="g" className={input} /></Field>
          <Field label="Carbs"><input value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal" placeholder="g" className={input} /></Field>
          <Field label="Fat"><input value={f} onChange={(e) => setF(e.target.value)} inputMode="decimal" placeholder="g" className={input} /></Field>
        </div>

        {macrosOff && (
          <p className="mt-3 flex items-start gap-2 text-xs text-saffron">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            Protein, carbs and fat add up to ~{Math.round(macroKcal)} kcal, not {k}. Worth a second look at the label.
          </p>
        )}
        {valid && basis === "serving" && (
          <p className="mt-3 text-xs text-faint">Saved as {per100(k)} kcal per 100 g, so any amount works later.</p>
        )}
      </div>

      <div className="border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!valid}
          onClick={save}
          className="h-14 w-full rounded-2xl bg-gradient-to-r from-turmeric to-saffron text-base font-bold text-on-accent disabled:opacity-40"
        >
          Save &amp; log it
        </motion.button>
      </div>
    </div>
  );
}

const input = "w-full bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-faint";
const labelCls = "mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-faint";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block rounded-2xl border border-line-strong bg-surface-2 px-3 py-2 focus-within:border-turmeric/60">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-faint">{label}</span>
      {children}
    </label>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "border-cream bg-cream text-bg" : "border-line-strong bg-surface-2 text-text"}`}
    >
      {children}
    </button>
  );
}
