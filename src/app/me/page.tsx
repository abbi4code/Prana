"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Download, Monitor, Moon, Sparkles, Sun, Trash } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { AccountCard } from "@/components/account/AccountCard";
import { EnergyCard } from "@/components/me/EnergyCard";
import { YourGymCard } from "@/components/workout/YourGymCard";
import { APP_NAME } from "@/lib/app";
import { suggestGoals } from "@/lib/nutrition";
import { useStore } from "@/lib/store";
import type { Goals, Profile } from "@/lib/types";

const ACTIVITY: { v: Profile["activity"]; label: string }[] = [
  { v: 1.2, label: "Desk job, little exercise" },
  { v: 1.375, label: "Light: walks / 1–3 workouts a week" },
  { v: 1.55, label: "Moderate: 3–5 workouts a week" },
  { v: 1.725, label: "Very active: daily hard training" },
];

export default function MePage() {
  const hydrated = useStore((s) => s.hydrated);
  const goals = useStore((s) => s.goals);
  const profile = useStore((s) => s.profile);
  if (!hydrated) return <div className="space-y-4"><div className="skeleton h-12" /><div className="skeleton h-96" /></div>;
  // keyed so the forms reset when stored values change
  return (
    <div className="space-y-4">
      <h1 className="font-display text-[2rem] font-semibold lg:text-4xl">Me</h1>
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-4 lg:space-y-6">
          <EnergyCard />
          <ProfileCard key={JSON.stringify(profile)} profile={profile} />
        </div>
        <div className="space-y-4 lg:space-y-6">
          <GoalsCard key={JSON.stringify(goals)} goals={goals} />
          <YourGymCard />
          <AppearanceCard />
          <MyFoodsCard />
          <DataCard />
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ profile }: { profile: Profile | null }) {
  const setProfile = useStore((s) => s.setProfile);
  const setGoals = useStore((s) => s.setGoals);
  const [p, setP] = useState<Profile>(profile ?? { sex: "male", age: 28, heightCm: 172, weightKg: 75, activity: 1.375, aim: "lose" });
  const suggestion = suggestGoals(p);

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-turmeric" />
        <h2 className="font-display text-lg font-semibold">Find my daily goal</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Segment value={p.sex} onChange={(sex) => setP({ ...p, sex })} options={[["male", "Male"], ["female", "Female"]]} />
        <Segment value={p.aim} onChange={(aim) => setP({ ...p, aim })} options={[["lose", "Lose"], ["maintain", "Keep"], ["gain", "Gain"]]} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <NumField label="Age" value={p.age} onChange={(age) => setP({ ...p, age })} />
        <NumField label="Height cm" value={p.heightCm} onChange={(heightCm) => setP({ ...p, heightCm })} />
        <NumField label="Weight kg" value={p.weightKg} onChange={(weightKg) => setP({ ...p, weightKg })} />
      </div>
      <select
        value={p.activity}
        onChange={(e) => setP({ ...p, activity: Number(e.target.value) as Profile["activity"] })}
        className="mt-2 h-12 w-full rounded-2xl border border-line-strong bg-surface-2 px-3 text-sm outline-none"
      >
        {ACTIVITY.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
      </select>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 p-4">
        <div>
          <p className="font-display text-3xl font-semibold tabular">{suggestion.kcal.toLocaleString("en-IN")}</p>
          <p className="text-xs text-muted">
            kcal/day · P {suggestion.p}g · C {suggestion.c}g · F {suggestion.f}g
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { setProfile(p); setGoals(suggestion); }}
          className="rounded-2xl bg-gradient-to-r from-turmeric to-saffron px-4 py-3 text-sm font-bold text-on-accent"
        >
          Use this
        </motion.button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        Mifflin–St Jeor estimate. {p.aim === "lose" ? "500 kcal below maintenance (~0.5 kg/week). " : p.aim === "gain" ? "300 kcal above maintenance. " : ""}
        Protein 1.6 g per kg body weight.
      </p>
    </section>
  );
}

function GoalsCard({ goals }: { goals: Goals }) {
  const setGoals = useStore((s) => s.setGoals);
  const [g, setG] = useState(goals);
  const dirty = JSON.stringify(g) !== JSON.stringify(goals);
  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-semibold">Daily goals</h2>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <NumField label="kcal" value={g.kcal} onChange={(kcal) => setG({ ...g, kcal })} />
        <NumField label="Protein" value={g.p} onChange={(v) => setG({ ...g, p: v })} />
        <NumField label="Carbs" value={g.c} onChange={(v) => setG({ ...g, c: v })} />
        <NumField label="Fat" value={g.f} onChange={(v) => setG({ ...g, f: v })} />
      </div>
      {dirty && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setGoals(g)}
          className="mt-3 h-12 w-full rounded-2xl bg-cream font-bold text-bg"
        >
          Save goals
        </motion.button>
      )}
    </section>
  );
}

type ThemeChoice = "system" | "light" | "dark";
const THEMES: { v: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { v: "system", label: "System", icon: Monitor },
  { v: "light", label: "Light", icon: Sun },
  { v: "dark", label: "Dark", icon: Moon },
];

/** Per-device preference (localStorage), applied before paint by the script in app/layout.tsx. */
function AppearanceCard() {
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    try {
      const t = typeof window !== "undefined" ? localStorage.getItem("prana-theme") : null;
      return t === "light" || t === "dark" ? t : "system";
    } catch {
      return "system";
    }
  });
  const choose = (t: ThemeChoice) => {
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem("prana-theme");
      else localStorage.setItem("prana-theme", t);
    } catch {}
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };
  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-semibold">Appearance</h2>
      <div className="mt-3 flex rounded-2xl border border-line-strong bg-surface-2 p-1">
        {THEMES.map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => choose(v)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ${theme === v ? "text-bg" : "text-muted hover:text-text"}`}
          >
            {theme === v && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <Icon size={15} className="relative" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MyFoodsCard() {
  const foods = useStore((s) => s.customFoods);
  const remove = useStore((s) => s.removeCustomFood);
  if (!foods.length) return null;
  return (
    <section className="card p-5">
      <h2 className="font-display text-lg font-semibold">My foods</h2>
      <p className="text-xs text-muted">Foods you created. Past logs keep their values if you delete one.</p>
      <ul className="mt-3 space-y-1">
        {foods.map((f) => {
          const u = f.units[0];
          return (
            <li key={f.id} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
              <FoodIcon cat={f.cat} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.name}</p>
                <p className="truncate text-xs text-muted">
                  {u.label} · {Math.round((f.kcal * u.g) / 100)} kcal
                </p>
              </div>
              <button
                onClick={() => confirm(`Delete "${f.name}"?`) && remove(f.id)}
                aria-label={`Delete ${f.name}`}
                className="grid size-9 place-items-center rounded-full text-faint hover:bg-chilli/10 hover:text-chilli"
              >
                <Trash size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DataCard() {
  const exportData = () => {
    const { entries, goals, profile, weights, water, workouts, fitness } = useStore.getState();
    const blob = new Blob([JSON.stringify({ entries, goals, profile, weights, water, workouts, fitness }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${APP_NAME.toLowerCase()}-backup.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-display text-lg font-semibold">Account</h2>
      <AccountCard />
      <button onClick={exportData} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-strong font-semibold">
        <Download size={17} /> Download backup
      </button>
    </section>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="rounded-2xl border border-line-strong bg-surface-2 px-3 py-2 focus-within:border-turmeric/60">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-faint">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent font-display text-lg font-semibold outline-none tabular"
      />
    </label>
  );
}

function Segment<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-2xl border border-line-strong bg-surface-2 p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${value === v ? "bg-cream text-bg" : "text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
