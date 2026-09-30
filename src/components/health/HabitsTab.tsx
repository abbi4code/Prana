"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { Beer, Check, Cigarette, CigaretteOff, CloudFog, Hourglass, IndianRupee, Leaf, Lock, Minus, Plus, Settings2, ShieldCheck, Sparkles, Wind } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { addDays, dayKey } from "@/lib/dates";
import {
  ALCOHOL_CANCERS, ALCOHOL_CANCER_SRC, ASIA_NOTE, HEAVY_EPISODE_G, STANDARD_DRINK_G, afMen, bpPayoff, breastPer10g, cirrhosisWomen, drinkBand, lifeYearsAt40, southAsiaLimits,
} from "@/lib/health/alcohol";
import {
  CUTTING_DOWN, CVD_AFTER_QUIT, LUNG_AFTER_QUIT, MILESTONES, WEIGHT_AFTER_QUIT, afterQuit, minutesRegained, oralAfterQuit, yearsGained,
} from "@/lib/health/quit";
import {
  CHEWING, HOOKAH_PER_SESSION, MINUTES_PER_CIGARETTE, SMOKING, TOBACCO_X_ALCOHOL, VAPE_FACTS, YEARS_LOST_INDIA, allCauseIndia, type Group, type Sex,
} from "@/lib/health/tobacco";
import { daysBetween, useHealth, type HealthData } from "@/lib/health/useHealth";
import { useStore } from "@/lib/store";
import type { HealthInfo, TobaccoKind } from "@/lib/types";
import { BG, CardHead, RiskRow, SourceNote, TEXT, pill, riskText, timesText, type Tone } from "./ui";

// Health → Habits (D55): tobacco + alcohol and what they do to the body. Opt-in; every number from the verified
// research (.claude/habits.md). Tone: what changes if you cut down or quit, never shame (D23).

const KINDS: { id: TobaccoKind; label: string; unit: string; units: string; icon: typeof Cigarette; tone: Tone }[] = [
  { id: "cigarette", label: "Cigarettes", unit: "cigarette", units: "cigarettes", icon: Cigarette, tone: "saffron" },
  { id: "bidi", label: "Bidis", unit: "bidi", units: "bidis", icon: Cigarette, tone: "brass" },
  { id: "chew", label: "Gutka · khaini", unit: "chew", units: "chews", icon: Leaf, tone: "leaf" },
  { id: "hookah", label: "Hookah", unit: "session", units: "sessions", icon: Wind, tone: "sky" },
  { id: "vape", label: "Vape", unit: "session", units: "sessions", icon: CloudFog, tone: "jamun" },
];
const GROUPS: { id: Group; label: string }[] = [
  { id: "heart", label: "Heart & blood vessels" },
  { id: "lungs", label: "Lungs" },
  { id: "cancer", label: "Cancer" },
  { id: "body", label: "Rest of the body" },
];
const smokedKind = (k: TobaccoKind) => k === "cigarette" || k === "bidi";
const fmt1 = (n: number) => (n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString());

export function HabitsTab() {
  const hydrated = useStore((s) => s.hydrated);
  const h = useHealth();
  const [setup, setSetup] = useState(false);

  if (!hydrated) return <div className="space-y-4"><div className="skeleton h-40" /><div className="skeleton h-96" /></div>;

  const on = !!h.health.habitsOn;
  const kinds = h.health.kinds ?? [];
  const smokes = kinds.some(smokedKind) || h.tobacco.status !== "never";

  return (
    <div className="space-y-4 lg:space-y-6">
      {!on ? (
        <OptIn onStart={() => setSetup(true)} />
      ) : (
        <>
          {/* phone: one column in the order below (the columns are `contents`, children ordered); lg: two columns, the left one sticky */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
            <div className="contents lg:sticky lg:top-6 lg:block lg:space-y-6">
              <div className="order-1"><Counter h={h} kinds={kinds} onSettings={() => setSetup(true)} /></div>
              {smokes && <div className="order-3"><QuitCard h={h} /></div>}
              {smokes && <div className="order-4"><LifeCard h={h} /></div>}
            </div>
            <div className="contents lg:block lg:space-y-6">
              {smokes && <div className="order-2"><BodyImpact h={h} /></div>}
              {kinds.includes("chew") && <div className="order-5"><ChewCard h={h} /></div>}
              {kinds.includes("hookah") && <div className="order-6"><HookahCard /></div>}
              {kinds.includes("vape") && <div className="order-7"><VapeCard /></div>}
              <div className="order-8"><AlcoholCard h={h} /></div>
              {smokes && h.alcohol.any && <div className="order-9"><TogetherCard /></div>}
            </div>
          </div>
          <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-xs text-faint">
            <Lock size={12} /> Only on your Health tab: never on Akhada, Weekly Wrapped or share cards.
          </p>
        </>
      )}
      <SetupSheet open={setup} onClose={() => setSetup(false)} />
    </div>
  );
}

// ── opt-in ──

function OptIn({ onStart }: { onStart: () => void }) {
  return (
    <section className="card relative overflow-hidden p-6 lg:p-8">
      <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-saffron/10 blur-3xl" />
      <div className="flex gap-2">
        <span className="grid size-11 place-items-center rounded-2xl bg-saffron/15 text-saffron"><Cigarette size={20} /></span>
        <span className="grid size-11 place-items-center rounded-2xl bg-turmeric/15 text-turmeric"><Beer size={20} /></span>
        <span className="grid size-11 place-items-center rounded-2xl bg-leaf/15 text-leaf"><Leaf size={20} /></span>
      </div>
      <h2 className="mt-4 font-display text-3xl font-semibold leading-tight">What your habits do to your body</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Cigarettes, bidis, gutka, hookah, vape and drinks: see the risk to your heart, lungs and more at the amount you actually use, and what
        changes when you cut down or quit.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {[
          [Sparkles, "Numbers from medical studies, with the study behind each one (Indian data where it exists)"],
          [Lock, "Private: never on Akhada, Weekly Wrapped or share cards"],
          [ShieldCheck, "No judging: it shows what gets better, day by day"],
        ].map(([Icon, text], i) => {
          const I = Icon as typeof Sparkles;
          return (
            <li key={i} className="flex items-start gap-2.5 text-muted">
              <I size={16} className="mt-0.5 shrink-0 text-turmeric" /> {text as string}
            </li>
          );
        })}
      </ul>
      <motion.button whileTap={{ scale: 0.97 }} onClick={onStart} className="mt-6 h-13 w-full rounded-2xl bg-gradient-to-r from-turmeric to-saffron px-6 py-3.5 font-bold text-on-accent sm:w-auto">
        Turn on Habits
      </motion.button>
    </section>
  );
}

// ── setup / settings ──

function SetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} size={open ? "narrow" : undefined}>
      {open && <Setup onClose={onClose} />}
    </Sheet>
  );
}

function Setup({ onClose }: { onClose: () => void }) {
  const health = useStore((s) => s.health);
  const setHealth = useStore((s) => s.setHealth);
  const today = dayKey();
  const [kinds, setKinds] = useState<TobaccoKind[]>(health.kinds ?? ["cigarette"]);
  const [smoker, setSmoker] = useState<NonNullable<HealthInfo["smoker"]>>(health.smoker ?? "current");
  const [perDay, setPerDay] = useState(health.pastPerDay ? String(health.pastPerDay) : "");
  const [years, setYears] = useState(health.yearsSmoked ? String(health.yearsSmoked) : "");
  const [quitOn, setQuitOn] = useState(health.quitOn ?? "");
  const [price, setPrice] = useState<Partial<Record<TobaccoKind, string>>>(() => Object.fromEntries(Object.entries(health.price ?? {}).map(([k, v]) => [k, String(v)])));
  const num = (s: string) => (s.trim() ? Math.max(0, Math.min(200, parseFloat(s))) : undefined);

  const save = () => {
    setHealth({
      habitsOn: true,
      habitsSince: health.habitsSince ?? today,
      kinds,
      smoker,
      pastPerDay: num(perDay),
      yearsSmoked: num(years),
      quitOn: smoker === "former" && quitOn ? quitOn : undefined,
      price: Object.fromEntries(Object.entries(price).map(([k, v]) => [k, num(v ?? "")]).filter(([, v]) => v != null)),
    });
    navigator.vibrate?.(12);
    onClose();
  };
  const toggle = (k: TobaccoKind) => setKinds((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Habits setup</Drawer.Title>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Habits</p>
        <h2 className="font-display text-2xl font-semibold">{health.habitsOn ? "Your settings" : "Set up"}</h2>

        <p className="mt-5 text-sm font-semibold">What do you use?</p>
        <p className="text-xs text-muted">Each gets a counter. Drinks come from what you log in food (beer, whisky…).</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const on = kinds.includes(k.id);
            return (
              <motion.button key={k.id} whileTap={{ scale: 0.95 }} onClick={() => toggle(k.id)} aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold ${on ? "border-transparent bg-cream text-bg" : "border-line-strong text-muted"}`}>
                <k.icon size={15} /> {k.label}
              </motion.button>
            );
          })}
        </div>

        <p className="mt-6 text-sm font-semibold">Cigarettes or bidis, right now?</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {([["current", "I smoke"], ["former", "I quit"], ["never", "Never smoked"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setSmoker(v)} aria-pressed={smoker === v}
              className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${smoker === v ? "border-transparent bg-cream text-bg" : "border-line-strong text-muted"}`}>{l}</button>
          ))}
        </div>

        {smoker !== "never" && (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Field label={smoker === "former" ? "Used to smoke, a day" : "Usually smoke, a day"} value={perDay} onChange={setPerDay} suffix="no." />
            <Field label="For how many years" value={years} onChange={setYears} suffix="yrs" />
            {smoker === "former" && (
              <label className="col-span-2 flex flex-col rounded-2xl border border-line-strong bg-bg/60 px-3.5 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Last cigarette on</span>
                <input type="date" max={today} value={quitOn} onChange={(e) => setQuitOn(e.target.value)} className="bg-transparent text-base font-semibold outline-none" />
              </label>
            )}
          </div>
        )}

        {kinds.length > 0 && (
          <>
            <p className="mt-6 text-sm font-semibold">Price (optional)</p>
            <p className="text-xs text-muted">₹ for one, to count what it costs you.</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {KINDS.filter((k) => kinds.includes(k.id)).map((k) => (
                <Field key={k.id} label={`One ${k.unit}`} value={price[k.id] ?? ""} onChange={(v) => setPrice({ ...price, [k.id]: v })} suffix="₹" />
              ))}
            </div>
          </>
        )}

        {health.habitsOn && (
          <button onClick={() => { setHealth({ habitsOn: false }); onClose(); }} className="mt-8 text-sm font-semibold text-muted underline-offset-4 hover:text-chilli hover:underline">
            Turn off Habits (your logs are kept)
          </button>
        )}
      </div>
      <div className="border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={save} className="h-14 w-full rounded-2xl bg-gradient-to-r from-turmeric to-saffron font-bold text-on-accent">
          {health.habitsOn ? "Save" : "Start"}
        </motion.button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <label className="flex flex-col rounded-2xl border border-line-strong bg-bg/60 px-3.5 py-2.5 focus-within:border-turmeric/60">
      <span className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</span>
      <span className="flex items-baseline gap-1">
        <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="–"
          className="w-full min-w-0 bg-transparent font-display text-xl font-semibold outline-none tabular placeholder:text-faint" />
        <span className="text-xs text-muted">{suffix}</span>
      </span>
    </label>
  );
}

// ── today's counter ──

function Counter({ h, kinds, onSettings }: { h: HealthData; kinds: TobaccoKind[]; onSettings: () => void }) {
  const habitDays = useStore((s) => s.habitDays);
  const addTobacco = useStore((s) => s.addTobacco);
  const day = habitDays.find((d) => d.date === h.today);
  const shown = KINDS.filter((k) => kinds.includes(k.id));
  const lastWord = h.tobacco.lastTobacco ? (h.tobacco.lastTobacco === h.today ? "today" : `${daysBetween(h.tobacco.lastTobacco, h.today)} days ago`) : null;

  return (
    <section className="card p-5">
      <CardHead icon={<Hourglass size={14} className="text-turmeric" />} label="Today"
        sub={lastWord ? `Last one ${lastWord}` : "Tap + each time: honest numbers give honest results"}
        right={<button onClick={onSettings} aria-label="Habits settings" className="grid size-9 place-items-center rounded-full text-faint hover:bg-surface-2 hover:text-text"><Settings2 size={17} /></button>} />
      {shown.length ? (
        <ul className="mt-4 space-y-2">
          {shown.map((k) => {
            const n = day?.counts[k.id] ?? 0;
            const avg = h.tobacco.perDay[k.id];
            return (
              <li key={k.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-2.5">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${BG[k.tone]} ${TEXT[k.tone]}`}><k.icon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{k.label}</span>
                  <span className="block text-[11px] text-muted tabular">{avg > 0 ? `${fmt1(avg)} a day, last ${h.tobacco.nDays} days` : "none lately"}</span>
                </span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => addTobacco(h.today, k.id, -1)} disabled={!n} aria-label={`One less ${k.unit}`}
                  className="grid size-9 place-items-center rounded-full border border-line-strong text-muted disabled:opacity-30"><Minus size={16} /></motion.button>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={n} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
                    className="w-8 text-center font-display text-2xl font-semibold tabular">{n}</motion.span>
                </AnimatePresence>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => { addTobacco(h.today, k.id, 1); navigator.vibrate?.(8); }} aria-label={`One more ${k.unit}`}
                  className="grid size-9 place-items-center rounded-full bg-cream text-bg"><Plus size={16} strokeWidth={2.6} /></motion.button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No tobacco counters: drinks you log in food still show below.</p>
      )}
    </section>
  );
}

// ── body impact (per disease, with a "what if" slider) ──

function BodyImpact({ h }: { h: HealthData }) {
  const current = Math.round(h.tobacco.smokes);
  const [pick, setPick] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const x = pick ?? (current > 0 ? current : 10);
  const sex = h.sex as Sex | null;
  const quitting = h.tobacco.status === "former";

  if (!sex)
    return (
      <section className="card p-5">
        <CardHead icon={<Cigarette size={14} className="text-saffron" />} label="What it does to your body" />
        <p className="mt-3 text-sm text-muted">The studies give different numbers for men and women: add your sex in Me first.</p>
        <Link href="/me" className={`${pill} mt-3`}>Open Me</Link>
      </section>
    );

  const models = SMOKING.filter((m) => !m.only || m.only === sex);
  const allCause = allCauseIndia(h.tobacco.perDay.bidi > h.tobacco.perDay.cigarette ? 0 : x, h.tobacco.perDay.bidi > h.tobacco.perDay.cigarette ? x : 0, sex);

  return (
    <section className="card p-5">
      <CardHead icon={<Cigarette size={14} className="text-saffron" />} label="What it does to your body"
        sub={quitting ? "If you went back to smoking" : current > 0 ? `At your ${current} a day, vs a non-smoker` : "Drag to see any amount, vs a non-smoker"} />

      <div className="mt-4 rounded-2xl bg-surface-2 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted">Smoking</p>
          <p className="font-display text-3xl font-semibold tabular">{x}<span className="text-sm font-sans font-medium text-muted"> a day</span></p>
        </div>
        <input type="range" min={1} max={40} value={x} onChange={(e) => setPick(parseInt(e.target.value))} aria-label="Cigarettes or bidis a day"
          className="mt-2 w-full accent-[var(--color-saffron)]" data-vaul-no-drag />
        <div className="mt-1 flex items-center justify-between text-[11px] text-faint">
          <span>1</span>
          {pick != null && current > 0 && pick !== current ? (
            <button onClick={() => setPick(null)} className="font-semibold text-turmeric">Back to your {current} a day</button>
          ) : <span>cigarettes + bidis</span>}
          <span>40</span>
        </div>
      </div>

      {allCause && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line-strong px-4 py-3">
          <span className="text-sm">
            <span className="font-semibold">Death from disease, age 30–69</span>
            <span className="block text-[11px] text-muted">Indian data · {allCause.label}</span>
          </span>
          <span className={`font-display text-2xl font-semibold tabular ${TEXT.chilli}`}>{timesText(allCause.rr)}</span>
        </div>
      )}

      {GROUPS.map((g) => {
        const rows = models.filter((m) => m.group === g.id);
        if (!rows.length) return null;
        return (
          <div key={g.id} className="mt-4">
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-faint">{g.label}</p>
            <ul className="mt-1">
              {rows.map((m) => {
                const r = m.at(x, sex);
                if (!r) return null;
                return (
                  <li key={m.id}>
                    <RiskRow name={m.name} rr={r.rr} lo={r.lo} hi={r.hi} measure={r.measure} capped={r.capped} sub={m.dose ? undefined : "any amount"}
                      active={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)} />
                    <AnimatePresence initial={false}>
                      {open === m.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-3">
                          <SourceNote ids={[m.src]} note={m.note} className="pb-2" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted">
        Numbers compare people like you who smoke with people who don&apos;t: what happens to a group, not a prediction for you. Bidis count like cigarettes
        (INTERHEART does the same; in Indian data bidis are at least as harmful). Tap a row for the study.
      </p>
    </section>
  );
}

// ── quitting ──

function QuitCard({ h }: { h: HealthData }) {
  const sex = (h.sex ?? "male") as Sex;
  const minutesEach = MINUTES_PER_CIGARETTE[sex];
  const status = h.tobacco.status;
  const quitDays = h.tobacco.quitOn ? Math.max(0, daysBetween(h.tobacco.quitOn, h.today)) : null;
  const before = h.tobacco.usualBefore ?? 0;
  const longest = useLongestRun();

  if (status === "former" && quitDays != null) {
    const years = quitDays / 365;
    const cvd = afterQuit(CVD_AFTER_QUIT, years);
    const lung = afterQuit(LUNG_AFTER_QUIT, years);
    const won = minutesRegained(before, quitDays, minutesEach);
    const month = Math.floor(quitDays / 30.4);
    const weight = month >= 1 && month <= 12 ? [...WEIGHT_AFTER_QUIT].reverse().find((w) => w.months <= month) : null;
    return (
      <section className="card overflow-hidden p-5">
        <CardHead icon={<CigaretteOff size={14} className="text-leaf" />} label="Smoke-free" />
        <p className="mt-3 font-display text-5xl font-semibold leading-none text-leaf tabular">
          {quitDays}<span className="text-lg font-sans font-medium text-muted"> {quitDays === 1 ? "day" : "days"}</span>
        </p>
        {before > 0 && (
          <p className="mt-2 text-sm text-muted">
            About <b className="font-semibold text-text tabular">{fmtDuration(won)}</b> of life expectancy won back ({before} a day not smoked × ~{minutesEach} min each, a population average).
          </p>
        )}
        <Milestones days={quitDays} />
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Stat label="Heart & stroke" value={`−${Math.round((1 - cvd.hr) * 100)}%`} sub={`vs still smoking (${cvd.label})`} />
          <Stat label="Lung cancer" value={`−${Math.round((1 - lung.hr) * 100)}%`} sub={`vs still smoking (${lung.label})`} />
          <Stat label="Mouth & throat cancer" value={`−${Math.round((1 - oralAfterQuit(years)) * 100)}%`} sub="vs still smoking" />
          {longest != null && <Stat label="Longest run" value={`${longest}d`} sub="without smoking" />}
        </div>
        {weight && (
          <p className="mt-3 rounded-2xl bg-sky/10 px-4 py-3 text-xs leading-relaxed text-sky">
            People who quit gain about {weight.kg} kg by month {weight.months} on average (some lose, some gain more). The heart benefit still wins, and
            your calorie log here is the best way to keep it small.
          </p>
        )}
        <SourceNote className="mt-3" ids={["sg1990", "kambam1986", "duncan2019", "tindle2018", "possenti2026", "jackson2025", "aubin2012"]}
          note="Heart and lung figures are for heavy smokers (20+ pack-years) in the Framingham study. The popular '20 minutes / 2–12 weeks' steps are left out: no study measured their timing." />
      </section>
    );
  }

  // still smoking: what quitting would bring
  const perWeek = Math.round(h.tobacco.perDay.cigarette * 7);
  const gain = h.age ? yearsGained(h.age) : null;
  return (
    <section className="card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-leaf/10 blur-3xl" />
      <CardHead icon={<CigaretteOff size={14} className="text-leaf" />} label="If you quit today" />
      {gain && (
        <p className="mt-3 text-sm text-muted">
          British doctors who stopped by {gain.age} lived about <b className="font-display text-2xl font-semibold text-leaf">{gain.age === 60 ? "3+" : gain.years}</b> years longer than those who kept smoking.
        </p>
      )}
      {perWeek > 0 && (
        <p className="mt-2 text-sm text-muted">Each week off wins back about <b className="font-semibold text-text tabular">{fmtDuration(perWeek * minutesEach)}</b> of life expectancy (population average).</p>
      )}
      <Milestones days={0} />
      <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted">
        Cutting down is a good first step for your lungs (lung cancer about {Math.round((1 - CUTTING_DOWN.lungCancer.hr) * 100)} % lower when heavy smokers halved it), but
        the heart barely changes: people who halved their smoking had about the same heart risk as before, people who quit had about half.
      </p>
      <SourceNote className="mt-3" ids={["doll2004", "sg1990", "kambam1986", "godtfredsen2005", "hackshaw2018", "jackson2025"]} />
    </section>
  );
}

function Milestones({ days }: { days: number }) {
  return (
    <ol className="relative mt-4 space-y-3 pl-6">
      <span className="absolute bottom-2 left-[9px] top-2 w-0.5 rounded-full bg-surface-3" />
      {MILESTONES.map((m) => {
        const done = days >= m.days;
        const pct = Math.min(1, days / m.days);
        return (
          <li key={m.title} className="relative">
            <span className={`absolute -left-6 top-0.5 grid size-5 place-items-center rounded-full ${done ? "bg-leaf text-bg" : "border-2 border-surface-3 bg-surface"}`}>
              {done && <Check size={12} strokeWidth={3} />}
            </span>
            <p className={`text-sm font-semibold ${done ? "text-leaf" : ""}`}>{m.title}</p>
            <p className="text-xs text-muted">{m.text}</p>
            {!done && days > 0 && pct > 0.02 && (
              <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-leaf" style={{ width: `${pct * 100}%` }} /></div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Longest run of days without cigarettes / bidis since Habits started (a relapse never erases it). */
function useLongestRun() {
  const habitDays = useStore((s) => s.habitDays);
  const since = useStore((s) => s.health.habitsSince);
  const today = dayKey();
  return useMemo(() => {
    if (!since) return null;
    const smokeDays = habitDays.filter((d) => d.date >= since && (d.counts.cigarette ?? 0) + (d.counts.bidi ?? 0) > 0).map((d) => d.date);
    let best = 0, prev = addDays(since, -1);
    for (const d of [...smokeDays, addDays(today, 1)]) {
      best = Math.max(best, daysBetween(prev, d) - 1);
      prev = d;
    }
    return best;
  }, [habitDays, since, today]);
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold leading-none text-leaf tabular">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 48) return `${Math.round(minutes / 60)} hours`;
  return `${Math.round(minutes / 60 / 24)} days`;
}

// ── life + money ──

function LifeCard({ h }: { h: HealthData }) {
  const habitDays = useStore((s) => s.habitDays);
  const price = h.health.price ?? {};
  const sex = (h.sex ?? "male") as Sex;
  const from7 = addDays(h.today, -6), from30 = addDays(h.today, -29);
  const sum = (from: string, k: TobaccoKind) => habitDays.filter((d) => d.date >= from && d.date <= h.today).reduce((t, d) => t + (d.counts[k] ?? 0), 0);
  const cigWeek = sum(from7, "cigarette");
  const spent = KINDS.reduce((t, k) => t + sum(from30, k.id) * (price[k.id] ?? 0), 0);
  const lost = YEARS_LOST_INDIA[sex];
  if (h.tobacco.status === "never") return null;
  return (
    <section className="card p-5">
      <CardHead icon={<Hourglass size={14} className="text-saffron" />} label="Life & money" />
      <p className="mt-3 text-sm text-muted">
        In Indian data, {sex === "male" ? "men" : "women"} who smoke die about <b className="font-display text-2xl font-semibold text-saffron">{lost.years} years</b> earlier than those who don&apos;t (range {lost.lo}–{lost.hi}).
      </p>
      {cigWeek > 0 && (
        <p className="mt-2 text-sm text-muted">
          This week&apos;s {cigWeek} cigarettes ≈ <b className="font-semibold text-text tabular">{fmtDuration(cigWeek * MINUTES_PER_CIGARETTE[sex])}</b> of life expectancy, as a population average.
        </p>
      )}
      {spent > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <IndianRupee size={18} className="text-turmeric" />
          <p className="text-sm">
            <b className="font-display text-xl font-semibold tabular">₹{Math.round(spent).toLocaleString("en-IN")}</b>
            <span className="text-muted"> in the last 30 days · ₹{Math.round((spent * 365) / 30).toLocaleString("en-IN")} a year at this rate</span>
          </p>
        </div>
      )}
      <SourceNote className="mt-3" ids={["jha2008", "jackson2025"]} />
    </section>
  );
}

// ── chewing, hookah, vape ──

function ChewCard({ h }: { h: HealthData }) {
  const smokesToo = h.tobacco.status === "current";
  const rows = [
    { name: "Mouth cancer", ...CHEWING.oral, sub: "South Asian studies" },
    ...(h.sex === "female" ? [{ name: "Mouth cancer, paan with tobacco (women)", ...CHEWING.paanWomen, sub: "Indian subcontinent" }] : []),
    { name: "Food-pipe cancer", ...CHEWING.oesophagus, sub: "Mumbai men" },
    smokesToo ? { name: "Heart attack, smoking + chewing", ...CHEWING.smokeAndChew, sub: "52 countries" } : { name: "Heart attack", ...CHEWING.heart, sub: "52 countries" },
  ];
  return (
    <section className="card p-5">
      <CardHead icon={<Leaf size={14} className="text-leaf" />} label="Gutka · khaini · paan" sub="Chewing tobacco vs people who don't use it" />
      <ul className="mt-3">
        {rows.map((r) => <li key={r.name}><RiskRow name={r.name} rr={r.rr} lo={r.lo} hi={r.hi} sub={r.sub} vs="a non-user's" /></li>)}
      </ul>
      <p className="mt-2 px-3 text-xs text-muted">About half of mouth cancer in India is linked to paan with tobacco. No study pooled a per-chew curve, so these are for any regular use.</p>
      <SourceNote className="mt-2 px-3" ids={["gupta2014", "guha2014", "pednekar2011", "teo2006"]} />
    </section>
  );
}

function HookahCard() {
  const s = HOOKAH_PER_SESSION;
  return (
    <section className="card p-5">
      <CardHead icon={<Wind size={14} className="text-sky" />} label="Hookah" sub="One session vs one cigarette (what you breathe in)" />
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Big value={`${s.tarX}×`} label="tar" />
        <Big value={`${s.coX}×`} label="carbon monoxide" />
        <Big value={s.nicotineCigs} label="cigarettes' nicotine" />
      </div>
      <SourceNote className="mt-3" ids={[s.src]} note={s.note} />
    </section>
  );
}

function VapeCard() {
  const tone = { conclusive: "leaf", substantial: "turmeric", moderate: "saffron", none: "muted" } as const;
  return (
    <section className="card p-5">
      <CardHead icon={<CloudFog size={14} className="text-jamun" />} label="Vape" sub="What's known so far" />
      <ul className="mt-3 space-y-2">
        {VAPE_FACTS.map((f) => (
          <li key={f.text} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-muted">{f.text}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${BG[tone[f.level]]} ${TEXT[tone[f.level]]}`}>
              {f.level === "none" ? "not known yet" : `${f.level} evidence`}
            </span>
          </li>
        ))}
      </ul>
      <SourceNote className="mt-3" ids={["nasem2018"]} note="The US National Academies' review of all e-cigarette studies to 2017, graded by strength of evidence." />
    </section>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-3 text-center">
      <p className="font-display text-2xl font-semibold text-saffron tabular">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}

// ── alcohol ──

function AlcoholCard({ h }: { h: HealthData }) {
  const a = h.alcohol;
  const sex = h.sex as Sex | null;
  const limits = h.age && sex ? southAsiaLimits(h.age, sex) : null;
  const band = drinkBand(a.gPerDay);
  const life = lifeYearsAt40(a.gPerWeek);
  const bp = bpPayoff(a.gPerDay);
  const drinksWeek = a.gPerWeek / STANDARD_DRINK_G;
  const cancers = band ? ALCOHOL_CANCERS.filter((c) => !c.only || c.only === sex) : [];
  const liver = sex === "female" ? cirrhosisWomen(a.gPerDay) : null;
  const lowestPct = limits ? Math.min(100, (a.gPerDay / Math.max(limits.noHarmG, 1)) * 100) : 0;

  return (
    <section className="card p-5">
      <CardHead icon={<Beer size={14} className="text-turmeric" />} label="Alcohol" sub={`From the drinks you logged, last ${a.days} days`} />
      {!a.any ? (
        <p className="mt-3 text-sm text-muted">No drinks logged in the last 4 weeks. Log them like food (search “beer”, “whisky peg”…) and this card fills in.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Big value={`${Math.round(a.gPerWeek)} g`} label="alcohol a week" />
            <Big value={fmt1(drinksWeek)} label="drinks a week (10 g)" />
            <Big value={`${a.heavyDays}`} label={`days with ${HEAVY_EPISODE_G} g+`} />
          </div>
          {a.heavyDays > 0 && (
            <p className="mt-2 text-xs text-saffron">{HEAVY_EPISODE_G} g in one sitting (about three 60 ml pegs of whisky) is what India&apos;s NCD survey and WHO call heavy drinking.</p>
          )}

          {limits && (
            <div className="mt-4 rounded-2xl bg-surface-2 p-4">
              <p className="text-sm">
                For South Asians aged {limits.band}, health risk is lowest at about <b className="tabular">{fmt1(limits.lowestG)} g</b> a day; above
                <b className="tabular"> {fmt1(limits.noHarmG)} g</b> the harm outweighs any benefit. You average <b className="tabular">{fmt1(a.gPerDay)} g</b>.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
                <motion.div className="h-full rounded-full" style={{ background: a.gPerDay > limits.noHarmG ? "var(--color-chilli)" : "var(--color-leaf)" }}
                  initial={{ width: 0 }} animate={{ width: `${Math.max(3, lowestPct)}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
              </div>
              <p className="mt-1 text-[11px] text-faint">bar full = the no-net-harm amount for your age</p>
            </div>
          )}

          {life && (
            <p className="mt-3 text-sm text-muted">
              At {life.band}, life expectancy at 40 was <b className="font-semibold text-saffron">{life.text}</b> than for people drinking up to 100 g a week.
            </p>
          )}

          {band && (
            <>
              <p className="mt-4 px-3 text-[11px] font-bold uppercase tracking-wider text-faint">Cancer at your level ({band}: {band === "light" ? "up to 12.5" : band === "moderate" ? "12.5–50" : "over 50"} g a day)</p>
              <ul className="mt-1">
                {cancers.map((c) => {
                  const r = c[band];
                  return <li key={c.id}><RiskRow name={c.name} rr={r.rr} lo={r.lo} hi={r.hi} vs="a non-drinker's" /></li>;
                })}
              </ul>
              {band === "light" && <p className="mt-1 px-3 text-xs text-muted">{ASIA_NOTE}</p>}
            </>
          )}

          <ul className="mt-3 space-y-1.5 px-3 text-sm text-muted">
            {bp && <li>Cutting down by about half would lower blood pressure by about <b className="text-text">{bp.sys}/{bp.dia} mmHg</b>.</li>}
            {sex === "female" && a.gPerDay >= 5 && <li>Breast cancer: about <b className="text-text">+{Math.round((breastPer10g(a.gPerDay) - 1) * 100)} %</b> at your level (+7 % per 10 g a day).</li>}
            {sex === "male" && a.gPerDay >= 6 && <li>Irregular heartbeat: about <b className="text-text">+{Math.round((afMen(a.gPerDay) - 1) * 100)} %</b> (+8 % per drink a day).</li>}
            {liver && <li>Liver cirrhosis: about <b className="text-text">{timesText(liver.rr)}</b> a non-drinker&apos;s risk (women).</li>}
            <li>Calories from alcohol alone: <b className="text-text tabular">{a.kcal.toLocaleString("en-IN")} kcal</b> in 4 weeks.</li>
          </ul>
        </>
      )}
      <SourceNote className="mt-3" ids={["gbd2022", "wood2018", ALCOHOL_CANCER_SRC, "roerecke2017", "hamajima2002", "jiang2022", "roerecke2019", "ncdir2018"]}
        note="A standard drink is 10 g of alcohol (India's NCD survey and WHO). The lowest-risk and no-net-harm amounts are the Global Burden of Disease values for South Asia." />
    </section>
  );
}

function TogetherCard() {
  const t = TOBACCO_X_ALCOHOL;
  return (
    <section className="card p-5">
      <CardHead icon={<Sparkles size={14} className="text-chilli" />} label="Smoking + drinking together" sub="Mouth, throat and voice-box cancer vs neither" />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <span />
        <span className="font-semibold text-muted">No alcohol</span>
        <span className="font-semibold text-muted">3+ drinks a day</span>
        {["1–20 a day", "20+ a day"].map((tob) => (
          <Row3 key={tob} tob={tob} none={t.grid.find((g) => g.tobacco === tob && g.alcohol === "none")!.or} heavy={t.grid.find((g) => g.tobacco === tob && g.alcohol === "3+ drinks a day")!.or} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Together they multiply: {riskText(t.grid[5].or)} for heavy smoking and heavy drinking, vs {riskText(t.grid[4].or)} for heavy smoking alone.</p>
      <SourceNote className="mt-2" ids={[t.src]} note="Pooled from 17 studies; tobacco counts include chewing. India was not in this pool; Indian oral-cancer studies found the same multiplying effect with paan." />
    </section>
  );
}

function Row3({ tob, none, heavy }: { tob: string; none: number; heavy: number }) {
  return (
    <>
      <span className="self-center text-left font-semibold text-muted">Smoke {tob}</span>
      <span className="rounded-xl bg-saffron/10 py-2 font-display text-lg font-semibold text-saffron">{none.toFixed(1)}×</span>
      <span className="rounded-xl bg-chilli/15 py-2 font-display text-lg font-semibold text-chilli">{heavy >= 10 ? Math.round(heavy) : heavy.toFixed(1)}×</span>
    </>
  );
}

