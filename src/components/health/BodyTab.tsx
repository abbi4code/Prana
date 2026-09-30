"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Activity, ClipboardList, Droplets, HeartPulse, Ruler, Scale, Stethoscope, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import whoChart from "@/data/who-cvd-south-asia.json";
import { MeasurementsCard, PhotosCard } from "@/components/progress/BodyCards";
import { parseDay } from "@/lib/dates";
import { WAIST_LIMIT, WHTR_LIMIT, asianBmi, idrs, interheartPoints, interheartRisk, whoBand, whoCvdRisk, type WhoGrid } from "@/lib/health/scores";
import { bpCategory } from "@/lib/health/bp";
import { useHealth, type HealthData } from "@/lib/health/useHealth";
import { useStore } from "@/lib/store";
import { useTokens } from "@/lib/useTokens";
import { HealthQuestions, unanswered } from "./HealthQuestions";
import { BG, CardHead, FILL, Needs, SourceNote, TEXT, ghostPill, pill, type Tone } from "./ui";

const GRID = (whoChart as unknown as { grid: WhoGrid }).grid;
const short = (k: string) => parseDay(k).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Health → Body (D55): the report (BMI, waist, BP, heart and diabetes risk) + measurements and photos. */
export function BodyTab() {
  const hydrated = useStore((s) => s.hydrated);
  const h = useHealth();
  const [ask, setAsk] = useState(false);

  if (!hydrated)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="skeleton h-28" /><div className="skeleton h-28" /><div className="skeleton h-28" /><div className="skeleton h-28" /></div>
        <div className="grid gap-4 md:grid-cols-2"><div className="skeleton h-80" /><div className="skeleton h-80" /></div>
      </div>
    );

  return (
    <div className="space-y-4 lg:space-y-6">
      {!h.sex || !h.age || !h.heightCm ? (
        <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Add your sex, age and height (the goal calculator in Me) to see your body report.</p>
          <Link href="/me" className={pill}>Open Me</Link>
        </section>
      ) : (
        <ReportTiles h={h} />
      )}

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:gap-6">
        <HeartRiskCard h={h} />
        <BpCard h={h} />
        <InterheartCard h={h} onAsk={() => setAsk(true)} />
        <DiabetesCard h={h} onAsk={() => setAsk(true)} />
      </div>

      <section aria-labelledby="tape-h" className="space-y-3 pt-2">
        <h2 id="tape-h" className="font-display text-2xl font-semibold">Tape & photos</h2>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:gap-6">
          <MeasurementsCard />
          <PhotosCard />
        </div>
      </section>

      <HealthQuestions open={ask} onClose={() => setAsk(false)} />
    </div>
  );
}

// ── tiles ──

function Tile({ icon, label, value, unit, note, tone, delay = 0 }: { icon: React.ReactNode; label: string; value: React.ReactNode; unit?: string; note: React.ReactNode; tone: Tone; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: "spring", stiffness: 320, damping: 30 }} className="card flex flex-col p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{icon} {label}</p>
      <p className="mt-2 font-display text-3xl font-semibold leading-none tabular">
        {value}
        {unit && <span className="text-sm font-medium text-muted"> {unit}</span>}
      </p>
      <p className={`mt-2 text-xs font-semibold ${TEXT[tone]}`}>{note}</p>
    </motion.div>
  );
}

function ReportTiles({ h }: { h: HealthData }) {
  const bmi = h.bmi ? asianBmi(h.bmi) : null;
  const waistLimit = h.sex ? WAIST_LIMIT[h.sex] : null;
  const cat = h.bpAvg ? bpCategory(h.bpAvg.sys, h.bpAvg.dia, h.bpAvg.n, h.lastBp ?? undefined) : null;
  const risk = h.sex && h.age && h.bpAvg && h.bmi ? whoCvdRisk(GRID, { sex: h.sex, age: h.age, smoker: h.tobacco.status === "current", sys: h.bpAvg.sys, bmi: h.bmi }) : null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
      <Tile icon={<Scale size={13} className="text-brass" />} label="BMI" value={h.bmi ?? "–"} note={bmi ? bmi.label : "Log your weight"} tone={bmi?.tone ?? "muted"} />
      <Tile
        icon={<Ruler size={13} className="text-brass" />} label="Waist" delay={0.04}
        value={h.waistCm ?? "–"} unit={h.waistCm ? "cm" : undefined}
        note={h.waistCm && waistLimit ? (h.waistCm >= waistLimit ? `At or above ${waistLimit} cm` : `Under ${waistLimit} cm`) : "Measure below"}
        tone={h.waistCm && waistLimit ? (h.waistCm >= waistLimit ? "saffron" : "leaf") : "muted"}
      />
      <Tile
        icon={<Droplets size={13} className="text-chilli" />} label="Blood pressure" delay={0.08}
        value={h.bpAvg ? `${h.bpAvg.sys}/${h.bpAvg.dia}` : "–"}
        note={cat ? cat.label : "Add a reading"} tone={cat?.tone ?? "muted"}
      />
      <Tile
        icon={<HeartPulse size={13} className="text-chilli" />} label="Heart · 10 yr" delay={0.12}
        value={risk ? `${risk.pct}%` : "–"}
        note={risk ? `WHO chart, ${whoBand(risk.pct).label}` : h.age && (h.age < 40 || h.age >= 75) ? "Chart covers 40–74" : "Needs BP + weight"}
        tone={risk ? whoBand(risk.pct).tone : "muted"}
      />
    </div>
  );
}

// ── WHO 10-year heart attack / stroke risk ──

function HeartRiskCard({ h }: { h: HealthData }) {
  const setHealth = useStore((s) => s.setHealth);
  const smoker = h.tobacco.status === "current";
  const unknownSmoking = h.health.smoker == null && !h.tobacco.lastTobacco;

  // the chart, and what moves it: the same chart with one thing changed
  const { risk, whatIf } = useMemo(() => {
    const inputs = h.sex && h.age && h.bpAvg && h.bmi ? { sex: h.sex, age: h.age, smoker, sys: h.bpAvg.sys, bmi: h.bmi } : null;
    const risk = inputs ? whoCvdRisk(GRID, inputs) : null;
    if (!inputs || !risk) return { risk, whatIf: [] };
    const out: { label: string; pct: number }[] = [];
    if (smoker) out.push({ label: "If you didn't smoke", pct: whoCvdRisk(GRID, { ...inputs, smoker: false })!.pct });
    if (inputs.sys >= 140) out.push({ label: `With BP ${inputs.sys >= 160 ? "140–159" : "under 140"}`, pct: whoCvdRisk(GRID, { ...inputs, sys: inputs.sys >= 160 ? 150 : 130 })!.pct });
    if (inputs.bmi >= 25) out.push({ label: `With BMI ${inputs.bmi >= 30 ? "25–29" : "under 25"}`, pct: whoCvdRisk(GRID, { ...inputs, bmi: inputs.bmi >= 30 ? 27 : 24 })!.pct });
    return { risk, whatIf: out.filter((w) => w.pct < risk.pct) };
  }, [h.sex, h.age, h.bpAvg, h.bmi, smoker]);
  const band = risk ? whoBand(risk.pct) : null;

  return (
    <section className="card flex flex-col p-5">
      <CardHead icon={<HeartPulse size={14} className="text-chilli" />} label="Heart attack & stroke" sub="Chance in the next 10 years" />

      {risk && band ? (
        <>
          <div className="mt-4 flex items-end gap-4">
            <p className={`font-display text-6xl font-semibold leading-none tabular ${TEXT[band.tone]}`}>
              {risk.pct}<span className="text-2xl">%</span>
            </p>
            <div className="pb-1">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BG[band.tone]} ${TEXT[band.tone]}`}>{band.label}</span>
              <p className="mt-1.5 text-xs text-muted">age {risk.ageBand} · BP {risk.sbpBand} · BMI {risk.bmiBand} · {smoker ? "smoker" : "non-smoker"}</p>
            </div>
          </div>
          <RiskScale pct={risk.pct} />

          {whatIf.length > 0 && (
            <ul className="mt-4 space-y-2">
              {whatIf.map((w) => (
                <li key={w.label} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm">
                  <span className="text-muted">{w.label}</span>
                  <span className="font-display text-lg font-semibold tabular text-leaf">
                    {w.pct}% <span className="text-xs font-sans font-semibold text-muted">(−{risk.pct - w.pct})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {(h.health.diabetes === "yes" || risk.pct >= 10) && (
            <p className="mt-3 rounded-2xl bg-saffron/10 px-4 py-3 text-xs leading-relaxed text-saffron">
              {h.health.diabetes === "yes"
                ? "With diabetes this chart underestimates your risk: ask your doctor for the lab-based chart (it uses your sugar and cholesterol)."
                : "WHO advises a check-up with a doctor at 10 % or more: they can do the full test with cholesterol."}
            </p>
          )}
        </>
      ) : (
        <Needs
          items={[
            ...(!h.sex || !h.age ? [{ label: "Sex and age", action: <Link href="/me" className={ghostPill}>Me</Link> }] : []),
            ...(h.age && (h.age < 40 || h.age >= 75) ? [{ label: `The chart covers ages 40–74 (you're ${h.age})` }] : []),
            ...(!h.bpAvg ? [{ label: "A blood-pressure reading (card beside)" }] : []),
            ...(!h.bmi ? [{ label: "Your weight (Progress) and height (Me)" }] : []),
          ]}
        >
          WHO&apos;s chart for South Asia turns age, sex, smoking, blood pressure and BMI into a 10-year risk.
        </Needs>
      )}

      {unknownSmoking && (
        <div className="mt-4 rounded-2xl bg-surface-2 p-3.5">
          <p className="text-xs font-semibold text-muted">Do you smoke (cigarettes or bidis)?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["never", "Never"], ["former", "I quit"], ["current", "Yes"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setHealth({ smoker: v })} className={ghostPill}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <SourceNote
        className="mt-auto pt-3"
        ids={["who2019"]}
        note="WHO's non-laboratory chart for South Asia (India, Bangladesh, Bhutan, Nepal, Pakistan): a screening tool, not a diagnosis. It was built mostly on European and American cohorts and recalibrated to South Asia; BP is your 7-day average."
      />
    </section>
  );
}

function RiskScale({ pct }: { pct: number }) {
  // WHO colour bands: 0–5–10–20–30+ on a 0–40 scale
  const stops: [number, Tone][] = [[5, "leaf"], [10, "turmeric"], [20, "saffron"], [30, "chilli"], [40, "chilli"]];
  let prev = 0;
  return (
    <div className="relative mt-4">
      <div className="flex h-2 overflow-hidden rounded-full">
        {stops.map(([to, tone], i) => {
          const w = ((to - prev) / 40) * 100;
          prev = to;
          return <div key={i} style={{ width: `${w}%`, background: FILL[tone], opacity: i === 4 ? 0.7 : 0.9 }} />;
        })}
      </div>
      <motion.div
        className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-[3px] border-surface bg-text shadow"
        initial={{ left: "0%" }}
        animate={{ left: `${Math.min(100, (pct / 40) * 100)}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
      />
      <div className="mt-1.5 flex justify-between text-[10px] text-faint tabular"><span>0</span><span>10</span><span>20</span><span>30</span><span>40%</span></div>
    </div>
  );
}

// ── blood pressure log ──

function BpCard({ h }: { h: HealthData }) {
  const bp = useStore((s) => s.bp);
  const saveBp = useStore((s) => s.saveBp);
  const deleteBp = useStore((s) => s.deleteBp);
  const tk = useTokens();
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [pulse, setPulse] = useState("");
  const todayReading = bp.find((r) => r.date === h.today);
  const cat = h.bpAvg ? bpCategory(h.bpAvg.sys, h.bpAvg.dia, h.bpAvg.n, h.lastBp ?? undefined) : null;
  const s = parseInt(sys), d = parseInt(dia), p = parseInt(pulse);
  const valid = s >= 70 && s <= 260 && d >= 40 && d <= 160 && s > d && (!pulse || (p >= 30 && p <= 220));
  const series = bp.slice(-30).map((r) => ({ ...r, label: short(r.date) }));

  const save = () => {
    if (!valid) return;
    saveBp({ id: todayReading?.id ?? `bp-${crypto.randomUUID()}`, date: h.today, sys: s, dia: d, ...(pulse ? { pulse: p } : {}), createdAt: todayReading?.createdAt ?? Date.now() });
    setSys(""); setDia(""); setPulse("");
    navigator.vibrate?.(12);
  };

  return (
    <section className="card flex flex-col p-5">
      <CardHead
        icon={<Stethoscope size={14} className="text-chilli" />} label="Blood pressure"
        sub={h.bpAvg ? `Average of ${h.bpAvg.n} ${h.bpAvg.n === 1 ? "day" : "days"}, up to 7` : "From a home BP machine (upper arm), sitting, after 5 minutes' rest"}
      />
      {h.bpAvg && (
        <div className="mt-3 flex items-end gap-3">
          <p className="font-display text-5xl font-semibold leading-none tabular">
            {h.bpAvg.sys}<span className="text-muted">/</span>{h.bpAvg.dia}
            <span className="text-sm font-sans font-medium text-muted"> mmHg</span>
          </p>
          {cat && <span className={`mb-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${BG[cat.tone]} ${TEXT[cat.tone]}`}>{cat.label}</span>}
        </div>
      )}
      {cat?.advice && <p className={`mt-2 text-xs leading-relaxed ${TEXT[cat.tone]}`}>{cat.advice}</p>}

      {series.length > 1 && (
        <div className="-ml-3 mt-4 h-40">
          <ResponsiveContainer>
            <LineChart data={series}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis domain={["dataMin - 10", "dataMax + 10"]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<BpTip />} />
              <Line dataKey="sys" stroke={tk.chilli} strokeWidth={2.5} dot={{ r: 2.5, fill: tk.chilli, strokeWidth: 0 }} type="monotone" />
              <Line dataKey="dia" stroke={tk.sky} strokeWidth={2.5} dot={{ r: 2.5, fill: tk.sky, strokeWidth: 0 }} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <form
        className="mt-auto pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex gap-2">
          <BpInput value={sys} onChange={setSys} label="Top" placeholder={todayReading ? String(todayReading.sys) : "120"} />
          <BpInput value={dia} onChange={setDia} label="Bottom" placeholder={todayReading ? String(todayReading.dia) : "80"} />
          <BpInput value={pulse} onChange={setPulse} label="Pulse" placeholder="opt." />
          <motion.button whileTap={{ scale: 0.95 }} disabled={!valid} className="h-14 shrink-0 rounded-2xl bg-cream px-4 font-bold text-bg disabled:opacity-40">
            {todayReading ? "Update" : "Log"}
          </motion.button>
        </div>
        {bp.length > 0 && (
          <ul className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 lg:flex-wrap">
            {[...bp].reverse().slice(0, 10).map((r) => (
              <li key={r.id} className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-3 pr-1.5 text-xs">
                <span className="text-muted">{short(r.date)}</span>
                <span className="font-semibold tabular">{r.sys}/{r.dia}</span>
                {r.pulse && <span className="text-faint tabular">♥{r.pulse}</span>}
                <button type="button" onClick={() => deleteBp(r.id)} aria-label={`Remove reading from ${short(r.date)}`} className="grid size-5 place-items-center rounded-full text-faint hover:text-chilli">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      <SourceNote
        className="pt-3"
        ids={["ish2020", "igh2019", "icmr2026"]}
        note="How to measure: upper-arm machine (wrist and finger ones are less accurate), sitting after 5 minutes' rest, two readings a minute apart morning and evening for 3–7 days; log the average of the day. Home readings run lower than clinic ones, so the home limit is 135/85 (clinic: 140/90)."
      />
    </section>
  );
}

function BpInput({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  return (
    <label className="flex h-14 min-w-0 flex-1 flex-col justify-center rounded-2xl border border-line-strong bg-bg/60 px-3 focus-within:border-turmeric/60">
      <span className="text-[10px] font-bold uppercase tracking-wider text-faint">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={`${label} number`}
        className="w-full min-w-0 bg-transparent font-display text-lg font-semibold outline-none tabular placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-faint"
      />
    </label>
  );
}

function BpTip({ active, payload }: { active?: boolean; payload?: { payload: { date: string; sys: number; dia: number; pulse?: number } }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <p className="text-muted">{short(r.date)}</p>
      <p className="font-bold tabular">{r.sys}/{r.dia} mmHg{r.pulse ? ` · pulse ${r.pulse}` : ""}</p>
    </div>
  );
}

// ── INTERHEART heart score (no blood test) ──

function InterheartCard({ h, onAsk }: { h: HealthData; onAsk: () => void }) {
  const a = h.health;
  const smoking = h.tobacco.status === "current" ? Math.max(1, Math.round(h.tobacco.smokes)) : h.tobacco.status === "former" ? ("former" as const) : ("never" as const);
  const score = h.sex && h.age
    ? interheartPoints({
        sex: h.sex, age: h.age, smoking, whr: h.whr,
        secondHand: a.secondHand, diabetes: a.diabetes === "yes", highBp: a.highBp === "yes", parentHeart: a.parentHeart === "yes",
        stress: a.stress, lowMood: a.lowMood, saltyDaily: a.saltyDaily, friedOften: a.friedOften, fruitDaily: a.fruitDaily, vegDaily: a.vegDaily,
        meatTwiceDaily: a.meatTwiceDaily, sedentary: a.activity === "mild" || a.activity === "none",
      })
    : null;
  const missing = unanswered(a).length + (h.whr == null ? 1 : 0);
  const pct = score ? interheartRisk(score.total) : null;
  const tone: Tone = pct == null ? "muted" : pct < 5 ? "leaf" : pct < 10 ? "turmeric" : pct < 20 ? "saffron" : "chilli";
  const changeable = score?.items.filter((i) => i.changeable) ?? [];
  const fixed = score?.items.filter((i) => !i.changeable) ?? [];

  return (
    <section className="card flex flex-col p-5">
      <CardHead
        icon={<Activity size={14} className="text-jamun" />} label="Heart score" sub="No blood test needed"
        right={<button onClick={onAsk} className={missing ? pill : ghostPill}><ClipboardList size={13} /> {missing ? `${missing} to answer` : "Edit answers"}</button>}
      />
      {score && pct != null ? (
        <>
          <div className="mt-4 flex items-end gap-4">
            <p className={`font-display text-6xl font-semibold leading-none tabular ${TEXT[tone]}`}>
              {pct < 10 ? pct.toFixed(1) : Math.round(pct)}<span className="text-2xl">%</span>
            </p>
            <p className="pb-1 text-xs leading-snug text-muted">
              chance of a heart attack, stroke or heart failure in the next 7 years
              <span className="block font-semibold text-text tabular">{score.total} of 48 points</span>
            </p>
          </div>
          {missing > 0 && <p className="mt-2 text-xs text-saffron">{missing} {missing === 1 ? "answer is" : "answers are"} missing, so this may read low.</p>}

          {changeable.length > 0 && (
            <>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-faint">You can change</p>
              <PointList items={changeable} tone="saffron" />
            </>
          )}
          {fixed.length > 0 && (
            <>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-faint">Can&apos;t change</p>
              <PointList items={fixed} tone="muted" />
            </>
          )}
        </>
      ) : (
        <Needs items={[{ label: "Sex and age", action: <Link href="/me" className={ghostPill}>Me</Link> }]} />
      )}
      <SourceNote
        className="mt-auto pt-3"
        ids={["joseph2018"]}
        note="INTERHEART's non-laboratory score (smoking, diabetes, BP, family history, waist ÷ hip, stress, mood, diet, activity), turned into a 7-year risk with the PURE study's recalibration for South Asia (12,130 people). Right about 2 times in 3 for South Asians. Waist ÷ hip comes from your tape measurements."
      />
    </section>
  );
}

function PointList({ items, tone }: { items: { id: string; label: string; points: number }[]; tone: Tone }) {
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">{i.label}</span>
          <span className={`font-semibold tabular ${TEXT[tone]}`}>+{i.points}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Indian Diabetes Risk Score ──

function DiabetesCard({ h, onAsk }: { h: HealthData; onAsk: () => void }) {
  const r = h.sex && h.age ? idrs({ sex: h.sex, age: h.age, waistCm: h.waistCm, activity: h.health.activity, parentsDiabetes: h.health.parentsDiabetes }) : null;
  const tone: Tone = !r ? "muted" : r.band === "high" ? "saffron" : r.band === "moderate" ? "turmeric" : "leaf";
  const needs = [
    ...(!h.sex || !h.age ? [{ label: "Sex and age", action: <Link href="/me" className={ghostPill}>Me</Link> }] : []),
    ...(h.waistCm == null ? [{ label: "Your waist (Tape below)" }] : []),
    ...(!h.health.activity || h.health.parentsDiabetes == null ? [{ label: "Activity and family history", action: <button onClick={onAsk} className={ghostPill}>Answer</button> }] : []),
  ];
  return (
    <section className="card flex flex-col p-5">
      <CardHead icon={<Droplets size={14} className="text-sky" />} label="Diabetes risk" sub="Indian Diabetes Risk Score" />
      {h.health.diabetes === "yes" ? (
        <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-sm text-muted">You told us you have diabetes: this screening score is for finding undiagnosed diabetes, so it isn&apos;t shown.</p>
      ) : r ? (
        <>
          <div className="mt-4 flex items-end gap-4">
            <p className={`font-display text-6xl font-semibold leading-none tabular ${TEXT[tone]}`}>{r.score}</p>
            <div className="pb-1">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${BG[tone]} ${TEXT[tone]}`}>{r.band} risk</span>
              <p className="mt-1.5 text-xs text-muted">out of 100 · 60 or more = get a sugar test</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {r.parts.map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-xs"><span className="text-muted">{p.label}</span><span className="font-semibold tabular">{p.points}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <motion.div className="h-full rounded-full" style={{ background: FILL[tone] }} initial={{ width: 0 }} animate={{ width: `${(p.points / 30) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
                </div>
              </div>
            ))}
          </div>
          <AnimatePresence>
            {r.band === "high" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-2xl bg-saffron/10 px-4 py-3 text-xs leading-relaxed text-saffron">
                In a Chennai follow-up, 28 % of people scoring 60 or more developed diabetes within 8 years (6 % of low scorers; Mohan &amp; Anbalagan 2013). A fasting sugar or HbA1c test settles it.
              </motion.p>
            )}
          </AnimatePresence>
        </>
      ) : (
        <Needs items={needs}>Age, waist, activity and family history: a score made and tested in India.</Needs>
      )}
      <SourceNote
        className="mt-auto pt-3"
        ids={["mohan2005"]}
        note={`A screening score, not a diagnosis: at the 60 cut-off it found about 6 in 10 undiagnosed cases across India (ICMR-INDIAB, 113,043 people). Waist is measured with your tape; Indian waist limits are ${WAIST_LIMIT.male} cm for men and ${WAIST_LIMIT.female} cm for women, waist ÷ height ${WHTR_LIMIT}.`}
      />
    </section>
  );
}
