"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle, CalendarDays, Check, ChevronRight, Dumbbell, Flag, Globe2, Handshake, LoaderCircle, Lock, Minus, Plus,
  Search, Share2, ShieldCheck, Timer, Trophy, UserPlus, Users, X,
} from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { ExercisePhoto } from "@/components/workout/ExercisePhoto";
import { addDays, dayKey, parseDay } from "@/lib/dates";
import { findExercises, getExercise, kgStep } from "@/lib/exercises";
import { challengeUrl, challenges, failText, social, type Challenge, type ChallengeKind } from "@/lib/social/api";
import { invalidate, useRemote } from "@/lib/social/state";
import { useUI } from "@/lib/store";
import { Avatar, Who } from "./Profile";
import { PersonSheet } from "./People";
import { DuelsSection } from "./Duels";
import { drawResultCard, shareResult } from "@/lib/akhadaShare";
import { avatarOf } from "@/lib/social/state";

const KINDS: { id: ChallengeKind; label: string; blurb: string; icon: typeof Dumbbell; tone: string }[] = [
  { id: "lift", label: "Lift target", blurb: "Hit a weight, e.g. deadlift 100 kg for 1–5 reps", icon: Dumbbell, tone: "text-jamun bg-jamun/15" },
  { id: "days", label: "Gym days", blurb: "Show up N days (active days)", icon: CalendarDays, tone: "text-leaf bg-leaf/15" },
  { id: "minutes", label: "Active minutes", blurb: "Total training minutes (max 120 a day count)", icon: Timer, tone: "text-sky bg-sky/15" },
  { id: "team_minutes", label: "Team goal", blurb: "Everyone's minutes add up to one goal", icon: Handshake, tone: "text-saffron bg-saffron/15" },
];
const kindOf = (k: ChallengeKind) => KINDS.find((x) => x.id === k)!;

const fmtDay = (d: string) => parseDay(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const unit = (c: Pick<Challenge, "kind" | "target">) => (c.kind === "lift" ? "kg" : c.kind === "days" ? (c.target === 1 ? "day" : "days") : "min");
const goalText = (c: Challenge) =>
  c.kind === "lift" ? `${c.exerciseName ?? "Lift"} ${c.target} kg × ${c.maxReps === 1 ? "1 rep" : `1–${c.maxReps} reps`}` : `${c.target} ${unit(c)}${c.kind === "team_minutes" ? " together" : ""}`;
function daysLeft(c: Challenge) {
  const today = dayKey();
  if (c.state === "upcoming") return `starts ${fmtDay(c.startsOn)}`;
  if (c.state === "ended") return `ended ${fmtDay(c.endsOn)}`;
  const n = Math.round((parseDay(c.endsOn).getTime() - parseDay(today).getTime()) / 86_400_000);
  return n === 0 ? "last day" : `${n + 1} days left`;
}

/** Challenges tab: invites, yours, and open ones to join. */
export function ChallengesTab() {
  const router = useRouter();
  const showToast = useUI((s) => s.showToast);
  const { data, result, reload } = useRemote("challenges", () => challenges.list());
  const [creating, setCreating] = useState(false);
  const open = (id: string) => router.push(`/akhada/c/${id}`);

  const groups = useMemo(() => {
    const mine = data?.mine ?? [];
    return {
      invites: mine.filter((c) => c.myStatus === "invited" && c.state !== "ended"),
      live: mine.filter((c) => c.myStatus === "joined" && c.state === "live"),
      upcoming: mine.filter((c) => c.myStatus === "joined" && c.state === "upcoming"),
      ended: mine.filter((c) => c.myStatus === "joined" && c.state === "ended"),
    };
  }, [data]);

  const respond = async (c: Challenge, accept: boolean) => {
    const r = accept ? await challenges.join(c.id) : await challenges.decline(c.id);
    if (!r.ok) return showToast(failText(r));
    invalidate("challenge");
    void reload();
    if (accept) open(c.id);
  };

  return (
    <div className="space-y-5">
      <DuelsSection />

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setCreating(true)}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-jamun to-chilli font-bold text-white shadow-[0_10px_30px_-12px_var(--color-jamun)]"
      >
        <Plus size={19} /> New challenge
      </motion.button>

      {!data && result && !result.ok ? (
        <p className="card p-4 text-sm text-muted">{failText(result)}</p>
      ) : !data ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}</div>
      ) : (
        <>
          {groups.invites.length > 0 && (
            <Group title="Invites">
              {groups.invites.map((c) => (
                <div key={c.id} className="card p-4">
                  <CardTop c={c} onOpen={() => open(c.id)} />
                  <p className="mt-2 text-sm text-muted">{c.creator ? <><b className="text-text">{c.creator.name}</b> challenged you</> : "You're invited"} · {c.members} in</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => respond(c, false)} className="h-11 rounded-xl border border-line-strong text-sm font-semibold">Not this time</button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => respond(c, true)} className="h-11 rounded-xl bg-cream text-sm font-bold text-bg">Accept</motion.button>
                  </div>
                </div>
              ))}
            </Group>
          )}
          {groups.live.length > 0 && <Group title="Live">{groups.live.map((c) => <ChallengeCard key={c.id} c={c} onOpen={() => open(c.id)} />)}</Group>}
          {groups.upcoming.length > 0 && <Group title="Starting soon">{groups.upcoming.map((c) => <ChallengeCard key={c.id} c={c} onOpen={() => open(c.id)} />)}</Group>}
          {!groups.invites.length && !groups.live.length && !groups.upcoming.length && (
            <div className="card p-6 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted"><Trophy size={22} /></span>
              <p className="mt-3 font-semibold">No challenges yet</p>
              <p className="mt-1 text-sm text-muted">Start one with friends, or join an open challenge below.</p>
            </div>
          )}
          <Group title="Open to everyone">
            {data.open.length === 0 ? (
              <p className="px-1 text-sm text-muted">None right now. Make one and set it to “Everyone”.</p>
            ) : (
              data.open.map((c) => <ChallengeCard key={c.id} c={c} onOpen={() => open(c.id)} />)
            )}
          </Group>
          {groups.ended.length > 0 && <Group title="Finished">{groups.ended.map((c) => <ChallengeCard key={c.id} c={c} onOpen={() => open(c.id)} />)}</Group>}
        </>
      )}
      <CreateChallengeSheet open={creating} onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); void reload(); open(c.id); }} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{title}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function CardTop({ c, onOpen }: { c: Challenge; onOpen: () => void }) {
  const k = kindOf(c.kind);
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 text-left">
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${k.tone}`}><k.icon size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{c.title}</span>
        <span className="block truncate text-xs text-muted">{goalText(c)} · {daysLeft(c)}</span>
      </span>
      {c.audience === "open" ? <Globe2 size={15} className="shrink-0 text-faint" aria-label="Open to everyone" /> : <Lock size={14} className="shrink-0 text-faint" aria-label="Invite only" />}
      <ChevronRight size={16} className="shrink-0 text-faint" />
    </button>
  );
}

function ChallengeCard({ c, onOpen }: { c: Challenge; onOpen: () => void }) {
  const pct = c.mine ? Math.min(1, c.kind === "team_minutes" ? (c.team ?? c.mine.value) / c.target : c.mine.value / c.target) : 0;
  return (
    <div className="card p-4">
      <CardTop c={c} onOpen={onOpen} />
      {c.mine ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <motion.div className={`h-full origin-left rounded-full ${c.mine.done ? "bg-leaf" : "bg-jamun"}`} initial={{ scaleX: 0 }} animate={{ scaleX: pct }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <p className="mt-1.5 flex justify-between text-xs text-muted">
            <span>{c.mine.done ? <span className="font-semibold text-leaf">Done ✓</span> : `You: ${fmtNum(c.mine.value)} ${unit(c)}`}</span>
            <span className="flex items-center gap-1"><Users size={12} /> {c.members}</span>
          </p>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted"><Users size={12} /> {c.members} joined{c.creator ? ` · by ${c.creator.name}` : ""}</p>
      )}
    </div>
  );
}

const fmtNum = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toFixed(1));

// ── create ──
function CreateChallengeSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: Challenge) => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open && <CreateForm onClose={onClose} onCreated={onCreated} />}
    </Sheet>
  );
}

const LENGTHS = [7, 14, 30];

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Challenge) => void }) {
  const showToast = useUI((s) => s.showToast);
  const { data: friends } = useRemote("friends", () => social.friends());
  const [kind, setKind] = useState<ChallengeKind>("lift");
  const [exId, setExId] = useState<string>("deadlift");
  const [exQuery, setExQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [kg, setKg] = useState(100);
  const [reps, setReps] = useState(5);
  const [days, setDays] = useState(7);
  const [target, setTarget] = useState<Record<ChallengeKind, number>>({ lift: 100, days: 5, minutes: 300, team_minutes: 600 });
  const [start, setStart] = useState<"today" | "tomorrow" | "monday">("today");
  const [audience, setAudience] = useState<"invite" | "open">("invite");
  const [invite, setInvite] = useState<string[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ex = getExercise(exId);
  const today = dayKey();
  const nextMonday = (() => { const d = parseDay(today).getDay(); return addDays(today, d === 1 ? 7 : (8 - d) % 7 || 7); })();
  const startsOn = start === "today" ? today : start === "tomorrow" ? addDays(today, 1) : nextMonday;
  const value = kind === "lift" ? kg : Math.min(target[kind], kind === "days" ? days : kind === "minutes" ? 120 * days : 100000);
  const auto = kind === "lift" ? `${ex?.name ?? "Lift"} ${kg} kg` : kind === "days" ? `${value} gym days in ${days}` : kind === "minutes" ? `${value} active minutes` : `Team ${value} minutes`;
  const finalTitle = (title ?? auto).trim();
  const lifts = useMemo(() => findExercises(exQuery, { group: null, sub: null, equip: null }).filter((e) => e.load === "external").slice(0, 30), [exQuery]);

  const setT = (k: ChallengeKind, v: number) => setTarget((t) => ({ ...t, [k]: v }));
  const create = async () => {
    if (busy || finalTitle.length < 3) return;
    setBusy(true);
    const r = await challenges.create({
      title: finalTitle.slice(0, 60), kind, target: value, exercise: kind === "lift" ? exId : undefined, exerciseName: ex?.name,
      maxReps: reps, verifiedOnly, audience, startsOn, days, invite: audience === "invite" ? invite : [],
    });
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    invalidate("challenge");
    showToast("Challenge created. Share the link to bring people in.");
    onCreated(r.data);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-5 pt-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Akhada</p>
          <Drawer.Title className="font-display text-2xl font-semibold">New challenge</Drawer.Title>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line-strong text-muted"><X size={18} /></button>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => { setKind(k.id); setTitle(null); }}
              aria-pressed={kind === k.id}
              className={`rounded-2xl border p-3 text-left transition-colors ${kind === k.id ? "border-cream bg-surface-2" : "border-line-strong hover:bg-surface-2/60"}`}
            >
              <span className={`grid size-9 place-items-center rounded-xl ${k.tone}`}><k.icon size={17} /></span>
              <span className="mt-2 block text-sm font-semibold">{k.label}</span>
              <span className="block text-[11px] leading-snug text-muted">{k.blurb}</span>
            </button>
          ))}
        </div>

        {kind === "lift" && (
          <div className="mt-5 space-y-3">
            <button onClick={() => setPicking((v) => !v)} className="flex w-full items-center gap-3 rounded-2xl border border-line-strong p-2.5 text-left">
              {ex && <ExercisePhoto ex={ex} className="size-12 shrink-0 rounded-xl" />}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Exercise</span>
                <span className="block truncate font-semibold">{ex?.name ?? "Pick an exercise"}</span>
              </span>
              <ChevronRight size={16} className={`text-faint transition-transform ${picking ? "rotate-90" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {picking && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <label className="relative flex items-center">
                    <Search size={15} className="pointer-events-none absolute left-3 text-faint" />
                    <input value={exQuery} onChange={(e) => setExQuery(e.target.value)} placeholder="Search lifts" className="h-11 w-full rounded-xl border border-line-strong bg-bg/60 pl-9 pr-3 text-sm outline-none focus:border-jamun/60" />
                  </label>
                  <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto overscroll-contain">
                    {lifts.map((e) => (
                      <li key={e.id}>
                        <button onClick={() => { setExId(e.id); setPicking(false); setTitle(null); setKg((k) => Math.max(kgStep(e.equip), Math.round(k / kgStep(e.equip)) * kgStep(e.equip))); }} className={`flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-surface-2 ${e.id === exId ? "bg-surface-2" : ""}`}>
                          <ExercisePhoto ex={e} className="size-10 shrink-0 rounded-lg" />
                          <span className="truncate text-sm font-semibold">{e.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
            <Stepper label={ex && (ex.equip === "dumbbell" || ex.equip === "kettlebell") ? "Target (kg each)" : "Target (kg)"} value={kg} step={ex ? kgStep(ex.equip) : 2.5} min={1} max={500} onChange={(v) => { setKg(v); setTitle(null); }} suffix="kg" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Counts for sets of</p>
              <div className="mt-1.5 flex gap-1.5">
                {[1, 3, 5].map((n) => (
                  <button key={n} onClick={() => setReps(n)} aria-pressed={reps === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold ${reps === n ? "border-transparent bg-cream text-bg" : "border-line-strong text-muted"}`}>
                    {n === 1 ? "1 rep" : `1–${n} reps`}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">A real logged set at or above the target. High-rep sets don&apos;t count as a max.</p>
            </div>
          </div>
        )}
        {kind === "days" && <div className="mt-5"><Stepper label="Active days needed" value={Math.min(target.days, days)} step={1} min={1} max={days} onChange={(v) => { setT("days", v); setTitle(null); }} suffix={`of ${days}`} /></div>}
        {kind === "minutes" && <div className="mt-5"><Stepper label="Active minutes (each)" value={Math.min(target.minutes, 120 * days)} step={30} min={30} max={120 * days} onChange={(v) => { setT("minutes", v); setTitle(null); }} suffix="min" /></div>}
        {kind === "team_minutes" && <div className="mt-5"><Stepper label="Team goal" value={target.team_minutes} step={60} min={60} max={20000} onChange={(v) => { setT("team_minutes", v); setTitle(null); }} suffix="min" /></div>}

        {(kind === "lift" || kind === "days") && (
          <button onClick={() => setVerifiedOnly((v) => !v)} role="switch" aria-checked={verifiedOnly} className="mt-3 flex w-full items-start gap-3 rounded-2xl border border-line-strong bg-surface-2 p-3.5 text-left">
            <ShieldCheck size={18} className={`mt-0.5 shrink-0 ${verifiedOnly ? "text-leaf" : "text-faint"}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Only GPS-verified counts</span>
              <span className="block text-xs text-muted">{kind === "lift" ? "The set must be logged during a verified gym visit." : "Only days with a verified gym visit count."}</span>
            </span>
            <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${verifiedOnly ? "bg-leaf" : "bg-surface-3"}`}>
              <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${verifiedOnly ? "right-0.5" : "left-0.5"}`} />
            </span>
          </button>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Length</p>
            <div className="mt-1.5 flex gap-1.5">
              {LENGTHS.map((n) => (
                <button key={n} onClick={() => { setDays(n); setTitle(null); }} aria-pressed={days === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold ${days === n ? "border-transparent bg-cream text-bg" : "border-line-strong text-muted"}`}>{n}d</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Starts</p>
            <select value={start} onChange={(e) => setStart(e.target.value as typeof start)} className="mt-1.5 h-10 w-full rounded-xl border border-line-strong bg-surface-2 px-2 text-sm font-semibold outline-none">
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="monday">Monday {fmtDay(nextMonday)}</option>
            </select>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted">{fmtDay(startsOn)} – {fmtDay(addDays(startsOn, days - 1))}</p>

        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Who</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button onClick={() => setAudience("invite")} aria-pressed={audience === "invite"} className={`flex items-center gap-2 rounded-2xl border p-3 text-left text-sm ${audience === "invite" ? "border-cream bg-surface-2" : "border-line-strong"}`}>
              <Lock size={16} /> <span><b className="block">Invite</b><span className="text-xs text-muted">Friends + your link</span></span>
            </button>
            <button onClick={() => setAudience("open")} aria-pressed={audience === "open"} className={`flex items-center gap-2 rounded-2xl border p-3 text-left text-sm ${audience === "open" ? "border-cream bg-surface-2" : "border-line-strong"}`}>
              <Globe2 size={16} /> <span><b className="block">Everyone</b><span className="text-xs text-muted">Anyone can join</span></span>
            </button>
          </div>
          {audience === "invite" && (
            <div className="mt-3">
              {!friends ? (
                <div className="skeleton h-12" />
              ) : friends.friends.length === 0 ? (
                <p className="text-sm text-muted">No friends yet. Create it and share the link instead.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {friends.friends.map((f) => {
                    const on = invite.includes(f.handle);
                    return (
                      <li key={f.handle}>
                        <button onClick={() => setInvite((l) => (on ? l.filter((h) => h !== f.handle) : [...l, f.handle]))} aria-pressed={on} className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-semibold ${on ? "border-transparent bg-cream text-bg" : "border-line-strong text-muted"}`}>
                          <Avatar id={f.avatar} size={26} /> {f.name.split(" ")[0]} {on && <Check size={14} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <label className="mt-5 block">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Title</span>
          <input value={title ?? auto} onChange={(e) => setTitle(e.target.value.slice(0, 60))} className="mt-1 h-12 w-full rounded-2xl border border-line-strong bg-bg/60 px-4 font-semibold outline-none focus:border-jamun/60" />
        </label>
      </div>
      <div className="shrink-0 border-t border-line bg-surface px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={create} disabled={busy || finalTitle.length < 3 || (kind === "lift" && !ex)} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-jamun to-chilli py-3.5 font-bold text-white disabled:opacity-50">
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Trophy size={18} />} Create challenge
        </motion.button>
      </div>
    </div>
  );
}

function Stepper({ label, value, step, min, max, onChange, suffix }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void; suffix: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <button onClick={() => onChange(clamp(value - step))} aria-label="Less" className="grid size-12 place-items-center rounded-xl border border-line-strong"><Minus size={18} /></button>
        <label className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-2">
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(0, v))); }}
            onBlur={() => onChange(clamp(value || min))}
            className="w-20 bg-transparent text-right font-display text-2xl font-semibold tabular outline-none"
            aria-label={label}
          />
          <span className="text-sm text-muted">{suffix}</span>
        </label>
        <button onClick={() => onChange(clamp(value + step))} aria-label="More" className="grid size-12 place-items-center rounded-xl border border-line-strong"><Plus size={18} /></button>
      </div>
    </div>
  );
}

// ── one challenge ──
export function ChallengeView({ id, code }: { id: string; code: string | null }) {
  const router = useRouter();
  const showToast = useUI((s) => s.showToast);
  const { data: c, result, reload } = useRemote(`challenge:${id}`, () => challenges.get(id, code));
  const [person, setPerson] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [disputing, setDisputing] = useState<{ handle: string; workoutId: string } | null>(null);

  if (!c) {
    if (result && !result.ok)
      return (
        <div className="card p-6 text-center">
          <p className="font-semibold">{failText(result)}</p>
          <Link href="/akhada?tab=challenges" className="mt-4 inline-flex h-11 items-center rounded-xl bg-cream px-5 text-sm font-bold text-bg">All challenges</Link>
        </div>
      );
    return <div className="space-y-3"><div className="skeleton h-40" /><div className="skeleton h-64" /></div>;
  }

  const k = kindOf(c.kind);
  const joined = c.myStatus === "joined";
  const act = async (fn: () => Promise<{ ok: true } | { ok: false; reason: Parameters<typeof failText>[0]["reason"]; retryAfterS?: number }>, done?: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    invalidate("challenge");
    if (done) showToast(done);
    void reload();
  };
  const share = async () => {
    const url = challengeUrl(c);
    const text = `${c.title}: ${goalText(c)}. Join me on Prana!`;
    if (navigator.share) {
      try { await navigator.share({ title: c.title, text, url }); return; } catch (e) { if (e instanceof DOMException && e.name === "AbortError") return; }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    showToast("Challenge link copied.");
  };
  const teamPct = c.kind === "team_minutes" ? Math.min(1, (c.team ?? 0) / c.target) : 0;

  return (
    <div className="space-y-4">
      <section className="card relative overflow-hidden p-5">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-jamun opacity-20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${k.tone}`}><k.icon size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{k.label} · {c.audience === "open" ? "Open to everyone" : "Invite only"}</p>
            <h1 className="font-display text-2xl font-semibold leading-tight lg:text-3xl">{c.title}</h1>
            <p className="mt-1 text-sm text-muted">{goalText(c)}{c.verifiedOnly ? " · GPS-verified only" : ""}</p>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-xs">
          <Chip>{fmtDay(c.startsOn)} – {fmtDay(c.endsOn)}</Chip>
          <Chip tone={c.state === "live" ? "leaf" : undefined}>{c.state === "live" ? "Live · " : ""}{daysLeft(c)}</Chip>
          <Chip><Users size={12} /> {c.members}/{c.maxMembers}</Chip>
          {c.creator && <Chip>by {c.creator.name}</Chip>}
        </div>
        {c.kind === "team_minutes" && (
          <div className="relative mt-4">
            <p className="flex justify-between text-sm"><span className="font-semibold">Team</span><span className="tabular">{fmtNum(c.team ?? 0)} / {c.target} min</span></p>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-surface-3">
              <motion.div className="h-full origin-left rounded-full bg-gradient-to-r from-saffron to-turmeric" initial={{ scaleX: 0 }} animate={{ scaleX: teamPct }} transition={{ duration: 0.9 }} />
            </div>
          </div>
        )}
        <div className="relative mt-4 flex flex-wrap gap-2">
          {!joined && c.state !== "ended" && (
            <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => act(() => challenges.join(c.id, code), "You're in. Let's go!")} className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-jamun to-chilli px-5 text-sm font-bold text-white disabled:opacity-60">
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} {c.myStatus === "invited" ? "Accept challenge" : "Join challenge"}
            </motion.button>
          )}
          {c.myStatus === "invited" && <button onClick={() => act(() => challenges.decline(c.id))} className="h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold">Decline</button>}
          {joined && c.state !== "ended" && (
            <>
              <button onClick={share} className="flex h-11 items-center gap-2 rounded-xl bg-cream px-4 text-sm font-bold text-bg"><Share2 size={16} /> Share link</button>
              <button onClick={() => setInviting(true)} className="flex h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-semibold"><UserPlus size={16} /> Invite</button>
            </>
          )}
        </div>
      </section>

      {c.state === "ended" && <Results c={c} />}

      <section className="card p-2">
        <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{c.state === "ended" ? (c.list?.[0]?.progress.final ? "Final standings" : "Standings (provisional)") : "Standings"}</p>
        <ol>
          {(c.list ?? []).map((m, i) => {
            const pct = c.kind === "team_minutes" ? Math.min(1, m.progress.value / Math.max(1, c.target / Math.max(1, c.members))) : Math.min(1, m.progress.value / c.target);
            const lift = m.progress.lift;
            return (
              <li key={m.handle} className={`rounded-2xl px-2.5 py-2.5 ${m.me ? "bg-turmeric/10" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-display text-lg font-semibold text-muted">{placeMark(m, c.list ?? [])}</span>
                  <button onClick={() => !m.me && setPerson(m.handle)} className="min-w-0 flex-1 text-left"><Who c={m} size={36} sub={m.creator ? "creator" : undefined} /></button>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-xl font-semibold tabular">{fmtNum(m.progress.value)}<span className="text-xs text-muted"> {unit(c)}</span></span>
                    {lift && <span className="text-[11px] text-muted">× {lift.reps} · {fmtDay(lift.date)}</span>}
                  </span>
                </div>
                <div className="ml-9 mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <motion.div className={`h-full origin-left rounded-full ${m.progress.done ? "bg-leaf" : "bg-jamun"}`} initial={{ scaleX: 0 }} animate={{ scaleX: pct }} transition={{ duration: 0.8, delay: i * 0.04 }} />
                </div>
                {lift && (
                  <div className="ml-9 mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {lift.verified ? (
                      <span className="flex items-center gap-1 rounded-full bg-leaf/15 px-2 py-0.5 font-semibold text-leaf"><ShieldCheck size={11} /> Verified at the gym</span>
                    ) : (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-muted">Self-reported</span>
                    )}
                    {lift.flagged && <span className="flex items-center gap-1 rounded-full bg-saffron/15 px-2 py-0.5 font-semibold text-saffron"><AlertTriangle size={11} /> Big jump</span>}
                    {lift.disputes > 0 && <span className="rounded-full bg-chilli/10 px-2 py-0.5 font-semibold text-chilli">{lift.disputes} dispute{lift.disputes === 1 ? "" : "s"}</span>}
                    {!m.me && joined && !lift.verified && (
                      <button onClick={() => setDisputing({ handle: m.handle, workoutId: lift.workoutId })} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-faint hover:text-chilli"><Flag size={11} /> Dispute</button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {c.kind === "lift" && (
        <p className="px-1 text-xs text-muted">
          Log your set in the Workout tab ({c.exerciseName}, {c.maxReps === 1 ? "1 rep" : `1–${c.maxReps} reps`}, {c.target} kg or more). Check in at your gym first to get the ✓. Sets synced more than 2 days late don&apos;t count; if most of the others dispute an unverified set, it stops counting.
        </p>
      )}

      {joined && (
        <div className="flex flex-wrap gap-2 px-1">
          {c.isCreator && c.state === "upcoming" && (
            <button onClick={() => act(() => challenges.cancel(c.id), "Challenge cancelled.").then(() => router.push("/akhada?tab=challenges"))} className="text-sm text-chilli hover:underline">Cancel challenge</button>
          )}
          {!(c.isCreator && c.state === "upcoming") && c.state !== "ended" && (
            <button onClick={() => act(() => challenges.leave(c.id), "You left the challenge.")} className="text-sm text-faint hover:text-chilli">Leave challenge</button>
          )}
        </div>
      )}

      <PersonSheet handle={person} onClose={() => setPerson(null)} challenge={c.id} />
      <InviteSheet open={inviting} c={c} onClose={() => setInviting(false)} onDone={() => { setInviting(false); void reload(); }} />
      <DisputeSheet target={disputing} onClose={() => setDisputing(null)} onSubmit={async (reason) => {
        if (!disputing) return;
        await act(() => challenges.dispute(c.id, disputing.handle, disputing.workoutId, reason), "Dispute sent.");
        setDisputing(null);
      }} />
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "leaf" }) {
  return <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${tone === "leaf" ? "bg-leaf/15 text-leaf" : "bg-surface-2 text-muted"}`}>{children}</span>;
}

function InviteSheet({ open, c, onClose, onDone }: { open: boolean; c: Challenge; onClose: () => void; onDone: () => void }) {
  const { data: friends } = useRemote(open ? "friends" : null, () => social.friends());
  const showToast = useUI((s) => s.showToast);
  const [pick, setPick] = useState<string[]>([]);
  const inIt = new Set((c.list ?? []).map((m) => m.handle));
  const send = async () => {
    const r = await challenges.invite(c.id, pick);
    if (!r.ok) return showToast(failText(r));
    showToast(`Invited ${pick.length}.`);
    setPick([]);
    onDone();
  };
  return (
    <Sheet open={open} onClose={onClose} size="narrow">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between px-5 pt-1">
          <Drawer.Title className="font-display text-2xl font-semibold">Invite friends</Drawer.Title>
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line-strong text-muted"><X size={18} /></button>
        </div>
        <ul className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-5 pt-3">
          {!friends ? <li className="skeleton h-12" /> : friends.friends.filter((f) => !inIt.has(f.handle)).length === 0 ? (
            <li className="py-4 text-sm text-muted">Everyone you know is already in. Share the link for others.</li>
          ) : friends.friends.filter((f) => !inIt.has(f.handle)).map((f) => {
            const on = pick.includes(f.handle);
            return (
              <li key={f.handle}>
                <button onClick={() => setPick((l) => (on ? l.filter((h) => h !== f.handle) : [...l, f.handle]))} className={`flex w-full items-center gap-2 rounded-2xl p-2 text-left ${on ? "bg-surface-2" : ""}`}>
                  <span className="min-w-0 flex-1"><Who c={f} /></span>
                  <span className={`grid size-6 place-items-center rounded-full border ${on ? "border-transparent bg-leaf text-bg" : "border-line-strong"}`}>{on && <Check size={14} />}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="shrink-0 border-t border-line px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">
          <button onClick={send} disabled={!pick.length} className="h-12 w-full rounded-2xl bg-cream font-bold text-bg disabled:opacity-40">Invite {pick.length || ""}</button>
        </div>
      </div>
    </Sheet>
  );
}

function DisputeSheet({ target, onClose, onSubmit }: { target: { handle: string } | null; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Sheet open={!!target} onClose={onClose} size="narrow">
      {target && (
        <div className="flex h-full min-h-0 flex-col px-5">
          <Drawer.Title className="pt-1 font-display text-2xl font-semibold">Dispute this lift?</Drawer.Title>
          <p className="mt-2 text-sm text-muted">
            @{target.handle}&apos;s best set wasn&apos;t logged during a verified gym visit. If most of the other members dispute it, it stops counting. Be fair: disputes are visible to the group.
          </p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder="Why? (optional)" rows={3} className="mt-3 w-full rounded-2xl border border-line-strong bg-bg/60 p-3 text-sm outline-none focus:border-chilli/60" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={onClose} className="h-12 rounded-2xl border border-line-strong font-semibold">Cancel</button>
            <button onClick={() => { onSubmit(reason); setReason(""); }} className="h-12 rounded-2xl bg-chilli font-bold text-white">Dispute</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];
type Member = NonNullable<Challenge["list"]>[number];
/** Equal results share a place: the stored place once settled, else the first member with the same done + value. */
const placeOf = (m: Member, list: Member[]) =>
  m.progress.place ?? 1 + list.findIndex((x) => x.progress.done === m.progress.done && x.progress.value === m.progress.value);
const placeMark = (m: Member, list: Member[]) => {
  const p = placeOf(m, list);
  return m.progress.done ? (MEDALS[p - 1] ?? "✓") : p;
};

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

/** After the last day: podium, your result, share. Provisional until late logs can't arrive (end + 3 days). */
function Results({ c }: { c: Challenge }) {
  const showToast = useUI((s) => s.showToast);
  const list = c.list ?? [];
  const final = !!list[0]?.progress.final;
  const me = list.find((m) => m.me);
  const place = (m: Member) => placeOf(m, list);
  const team = c.kind === "team_minutes";
  const podium = list.filter((m) => m.progress.done).slice(0, 3);
  const finalOn = addDays(c.endsOn, 3);
  const myLine = !me
    ? null
    : team
      ? me.progress.done ? "Team goal reached. Everyone finished! 🤝" : "The team didn't reach the goal this time."
      : me.progress.done
        ? place(me) === 1 && list.length > 1
          ? list.filter((m) => m.progress.done && place(m) === 1).length > 1 ? "Joint winners! 👑" : "You won! 👑"
          : `You finished ${ordinal(place(me))} of ${list.length}`
        : `You reached ${fmtNum(me.progress.value)} ${unit(c)}. Next time!`;

  const share = async () => {
    if (!me) return;
    const won = !team && me.progress.done && place(me) === 1 && list.length > 1;
    const blob = await drawResultCard({
      kicker: "Challenge result",
      emoji: won ? "👑" : me.progress.done ? "🎖️" : "💪",
      headline: won ? "Champion" : team ? (me.progress.done ? "Team goal done" : "Team effort") : me.progress.done ? `${ordinal(place(me))} of ${list.length}` : "Showed up",
      title: c.title,
      big: team ? `${fmtNum(c.team ?? 0)} min` : `${fmtNum(me.progress.value)} ${unit(c)}`,
      sub: `${fmtDay(c.startsOn)} – ${fmtDay(c.endsOn)} · goal ${goalText(c)}`,
      people: list.slice(0, 4).map((m) => ({ emoji: avatarOf(m.avatar).emoji, name: m.name, value: `${fmtNum(m.progress.value)} ${unit(c)}`, me: m.me })),
      tone: won ? "win" : me.progress.done ? "done" : "plain",
    });
    const r = await shareResult(blob, `prana-challenge-${c.id.slice(0, 8)}.png`, `${c.title} on Prana`);
    if (r === "saved") showToast("Image saved.");
  };

  return (
    <section className="card relative overflow-hidden p-5">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 size-56 -translate-x-1/2 rounded-full bg-turmeric opacity-20 blur-3xl" />
      <p className="relative text-center text-xs font-semibold uppercase tracking-wider text-muted">{final ? "Results" : "Provisional results"}</p>
      {podium.length > 0 && !team && (
        <div className="relative mt-4 flex items-end justify-center gap-3">
          {[podium[1], podium[0], podium[2]].map((m, i) =>
            m ? (
              <motion.div key={m.handle} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }} className="flex w-24 flex-col items-center">
                <Avatar id={m.avatar} size={i === 1 ? 64 : 48} />
                <p className="mt-1 max-w-full truncate text-xs font-semibold">{m.name.split(" ")[0]}</p>
                <div className={`mt-1 grid w-full place-items-center rounded-t-xl bg-surface-2 font-display text-xl ${i === 1 ? "h-20" : i === 0 ? "h-14" : "h-10"}`}>
                  {MEDALS[place(m) - 1] ?? "✓"}
                </div>
              </motion.div>
            ) : (
              <div key={i} className="w-24" />
            ),
          )}
        </div>
      )}
      {myLine && <p className="relative mt-4 text-center font-display text-xl font-semibold">{myLine}</p>}
      {!final && <p className="relative mt-1 flex items-center justify-center gap-1 text-xs text-muted"><Timer size={12} /> Logs can still arrive for the last days. Final on {fmtDay(finalOn)}.</p>}
      {me && (
        <div className="relative mt-4 flex justify-center">
          <motion.button whileTap={{ scale: 0.97 }} onClick={share} className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-turmeric to-saffron px-5 text-sm font-bold text-on-accent">
            <Share2 size={16} /> Share result
          </motion.button>
        </div>
      )}
    </section>
  );
}
