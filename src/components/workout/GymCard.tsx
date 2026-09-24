"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Check, CloudOff, Crosshair, LoaderCircle, MapPin, MapPinOff, RotateCcw, Settings2, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { dayKey } from "@/lib/dates";
import { checkIn, checkOut, type CheckInResult, type Loc } from "@/lib/gym/actions";
import { isIosChrome, permissionState, readLocation, unblockSteps, type Reading } from "@/lib/gym/location";
import type { Verdict } from "@/lib/gym/schema";
import { activeVisit, clock, duration, finishedVisits } from "@/lib/gym/visits";
import { useStore, useUI } from "@/lib/store";

// the map (Leaflet) loads only when the gym sheet is opened
const GymSheet = dynamic(() => import("./GymSheet"), { ssr: false });

/** Ticks once a second while `on`; returns the device clock (callers add the server skew). */
export function useTick(on: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [on]);
  return now;
}

/** The visit in progress (server copy or saved on this phone), or null. */
export function useActiveVisit() {
  const visits = useStore((s) => s.visits);
  const local = useStore((s) => s.localVisits);
  const pending = useStore((s) => s.pendingCheckout);
  return useMemo(() => activeVisit(visits, local, pending?.visitId ?? null), [visits, local, pending]);
}

/** Where the check-in flow is. Everything happens inside the card; nothing ever blocks checking in. */
type Step =
  | { s: "idle" }
  | { s: "explain" } // our own screen, BEFORE the browser's permission prompt
  | { s: "locating" }
  | { s: "sending" }
  | { s: "denied" }
  | { s: "failed"; reason: "unavailable" | "timeout" | "unsupported" }
  | { s: "confirm"; verdict: Verdict; reading: Reading }
  | { s: "ending" };

/**
 * Gym check-in (D30): "I'm at the gym" → (location check) → live timer → Done.
 * The timer is `now − started_at` from a stored timestamp, so it's right after closing and reopening the app.
 */
export function GymCard() {
  const gym = useStore((s) => s.gyms[0] ?? null);
  const visits = useStore((s) => s.visits);
  const local = useStore((s) => s.localVisits);
  const pending = useStore((s) => s.pendingCheckout);
  const consent = useStore((s) => s.locationConsent);
  const setConsent = useStore((s) => s.setLocationConsent);
  const skew = useUI((s) => s.clockSkew);
  const showToast = useUI((s) => s.showToast);
  const auth = useAuth((s) => s.status);
  const signedIn = auth === "signedIn";
  const active = useActiveVisit();
  const tick = useTick(!!active);
  const [step, setStep] = useState<Step>({ s: "idle" });
  const [editing, setEditing] = useState(false);

  const month = dayKey().slice(0, 7);
  const thisMonth = useMemo(
    () => finishedVisits(visits, local, pending).filter((v) => dayKey(new Date(v.start)).slice(0, 7) === month).length,
    [visits, local, pending, month],
  );

  if (!gym) return <SetupGym onOpen={() => setEditing(true)} sheet={<GymSheet open={editing} onClose={() => setEditing(false)} />} />;

  const hasLocation = gym.lat != null && gym.lng != null;
  // verification needs: signed in, a gym location, and the app setting on (layer 1). Guests: phone-only timer.
  const canVerify = signedIn && hasLocation && consent !== false;
  const now = tick ? tick + (active?.offline ? 0 : skew) : 0;
  const busy = step.s === "locating" || step.s === "sending" || step.s === "ending";

  const finish = (r: CheckInResult) => {
    if (r.kind === "error") {
      showToast(r.message);
      return setStep({ s: "idle" });
    }
    if (r.kind === "confirm") return; // handled by the caller (needs the reading)
    setStep({ s: "idle" });
    navigator.vibrate?.(12);
    const v = r.verdict?.verification;
    if (r.offline && signedIn) showToast("No signal. Visit saved on your phone, it will sync.");
    else if (v === "verified") showToast(`Checked in · location verified${r.verdict?.distanceM != null ? ` (${r.verdict.distanceM} m away)` : ""}`);
    else if (signedIn) showToast("Checked in (not verified)");
  };

  const plain = async (loc: Loc) => {
    setStep({ s: "sending" });
    finish(await checkIn(gym.id, loc));
  };

  /** Read the location (may show the browser prompt: only ever after a tap), then let the server judge it. */
  const attempt = async () => {
    setStep({ s: "locating" });
    if ((await permissionState()) === "denied") return setStep({ s: "denied" });
    const r = await readLocation();
    if (!r.ok) return setStep(r.reason === "permission_denied" ? { s: "denied" } : { s: "failed", reason: r.reason });
    setStep({ s: "sending" });
    const res = await checkIn(gym.id, { status: "ok", reading: r.reading });
    if (res.kind === "confirm") return setStep({ s: "confirm", verdict: res.verdict, reading: r.reading });
    finish(res);
  };

  const start = () => {
    if (busy) return;
    if (!canVerify) return void plain({ status: "off" });
    if (consent === null) return setStep({ s: "explain" }); // first time: explain before the browser asks
    void attempt();
  };

  const done = async () => {
    if (busy || !active) return;
    setStep({ s: "ending" });
    let loc: Loc = { status: "off" };
    if (canVerify && consent === true && !active.offline) {
      // one reading for end_verification; never blocks leaving
      if ((await permissionState()) === "denied") loc = { status: "permission_denied" };
      else {
        const r = await readLocation({ timeoutMs: 10_000, maxAgeMs: 30_000 });
        loc = r.ok ? { status: "ok", reading: r.reading } : { status: r.reason === "permission_denied" ? "permission_denied" : "unavailable" };
      }
    }
    const r = await checkOut(loc);
    setStep({ s: "idle" });
    navigator.vibrate?.([10, 40, 10]);
    if (!r.ok) showToast(r.message);
    else showToast(`Visit saved${r.ms ? ` · ${duration(r.ms)}` : ""}${r.offline && signedIn ? " (will sync)" : ""}`);
  };

  // locating / sending keep the idle panel (only the button label changes), so nothing jumps around
  const panel = active ? "live" : step.s === "locating" || step.s === "sending" || step.s === "ending" ? "idle" : step.s;

  return (
    <section className="card relative overflow-hidden p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-16 size-52 rounded-full blur-3xl transition-opacity duration-700"
        style={{ background: "var(--color-jamun)", opacity: active ? 0.3 : 0 }}
      />
      <header className="relative flex items-center gap-2">
        <span className="relative grid size-2.5 place-items-center">
          {active && <motion.span className="absolute inset-0 rounded-full bg-jamun" animate={{ scale: [1, 2.4], opacity: [0.6, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />}
          <span className={`size-2.5 rounded-full ${active ? "bg-jamun" : hasLocation ? "bg-leaf" : "bg-line-strong"}`} />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wider text-muted">{active ? `At ${gym.name}` : gym.name}</p>
        <button onClick={() => setEditing(true)} aria-label="Gym settings" className="grid size-8 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-text">
          <Settings2 size={16} />
        </button>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={panel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="relative mt-3">
          {active ? (
            <>
              <p className="font-display text-6xl font-semibold leading-none tracking-tight tabular">{now ? clock(now - active.startedAt) : " "}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                since {new Date(active.startedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                {active.offline ? (
                  <Tag icon={<CloudOff size={11} />}>{signedIn ? "saved on phone, will sync" : "on this phone"}</Tag>
                ) : active.verification === "verified" ? (
                  <Tag tone="leaf" icon={<ShieldCheck size={11} />}>location verified</Tag>
                ) : (
                  <Tag icon={<ShieldQuestion size={11} />}>not verified</Tag>
                )}
              </p>
              <PrimaryButton onClick={done} busy={step.s === "ending"} tone="cream" icon={<Check size={18} />}>
                {step.s === "ending" && canVerify && consent === true ? "Checking location…" : "Done"}
              </PrimaryButton>
            </>
          ) : step.s === "explain" ? (
            <Explain
              onContinue={() => { setConsent(true); void attempt(); }}
              onSkip={() => void plain({ status: "off" })}
              onNever={() => { setConsent(false); void plain({ status: "off" }); }}
            />
          ) : step.s === "denied" ? (
            <Problem
              icon={<MapPinOff size={18} />}
              title="Location is blocked for Prana"
              body={<ol className="list-decimal space-y-0.5 pl-4">{unblockSteps().map((s) => <li key={s}>{s}</li>)}</ol>}
              onRetry={attempt}
              onAnyway={() => plain({ status: "permission_denied" })}
            />
          ) : step.s === "failed" ? (
            <Problem
              icon={<Crosshair size={18} />}
              title={step.reason === "timeout" ? "Finding your location took too long" : step.reason === "unsupported" ? "This browser can't share location" : "Couldn't get a location fix"}
              body={
                <p>
                  {step.reason === "unsupported" ? "You can still check in." : "Indoors or in a basement? Step near the door or a window and try again."}
                  {isIosChrome() && " On iPhone, Chrome also needs Settings → Chrome → Location."}
                </p>
              }
              onRetry={step.reason === "unsupported" ? undefined : attempt}
              onAnyway={() => plain({ status: "unavailable" })}
            />
          ) : step.s === "confirm" ? (
            <Problem
              icon={<MapPin size={18} />}
              title={
                step.verdict.verification === "outside_radius"
                  ? `You look about ${fmtDistance(step.verdict.distanceM)} from ${gym.name}`
                  : `Your location is fuzzy right now (±${fmtDistance(step.verdict.accuracyM)})`
              }
              body={
                <p>
                  {step.verdict.verification === "outside_radius"
                    ? "Not there yet, or is the saved gym spot off? Try again, check in anyway (not verified), or fix the pin in gym settings."
                    : "Phones are often vague indoors. Try again in a few seconds, or check in anyway (not verified)."}
                </p>
              }
              onRetry={attempt}
              onAnyway={() => plain({ status: "ok", reading: step.reading, force: true })}
            />
          ) : (
            <>
              <PrimaryButton onClick={start} busy={busy} icon={<Building2 size={19} />} tone="jamun">
                {step.s === "locating" ? "Finding you…" : step.s === "sending" ? "Checking in…" : "I'm at the gym"}
              </PrimaryButton>
              <p className="mt-2.5 text-xs text-muted">
                {thisMonth ? `${thisMonth} visit${thisMonth === 1 ? "" : "s"} this month` : "Tap when you arrive, Done when you leave."}
                {auth === "signedOut" && " · Saved on this phone. Sign in to sync and verify."}
              </p>
              {signedIn && !hasLocation && (
                <button onClick={() => setEditing(true)} className="mt-3 flex w-full items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 py-2.5 text-left text-[13px] text-muted hover:bg-surface-2">
                  <MapPin size={15} className="shrink-0 text-jamun" /> Add your gym&apos;s location to verify visits
                </button>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <GymSheet open={editing} onClose={() => setEditing(false)} />
    </section>
  );
}

const fmtDistance = (m: number | null) => (m == null ? "?" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

/** Our explainer before the browser's prompt: once the browser's "Block" is tapped, a site can't ask again. */
function Explain({ onContinue, onSkip, onNever }: { onContinue: () => void; onSkip: () => void; onNever: () => void }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-leaf/15 text-leaf">
          <ShieldCheck size={22} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold leading-tight">Confirm you&apos;re at your gym?</p>
          <p className="mt-1 text-sm text-muted">We use your location only to confirm you&apos;re at your gym.</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {["Only when you tap check in or Done", "Nothing is tracked in the background", "Your location isn't stored, only the distance", "Turn it off anytime in gym settings"].map((t) => (
          <li key={t} className="flex items-center gap-2 text-muted">
            <Check size={14} className="shrink-0 text-leaf" /> {t}
          </li>
        ))}
      </ul>
      <PrimaryButton onClick={onContinue} tone="jamun" icon={<Crosshair size={18} />}>Continue</PrimaryButton>
      <div className="mt-2 flex items-center justify-between gap-2 text-[13px]">
        <button onClick={onSkip} className="rounded-xl px-2 py-1.5 font-semibold text-muted hover:text-text">Check in without location</button>
        <button onClick={onNever} className="rounded-xl px-2 py-1.5 text-faint hover:text-text">Don&apos;t use location</button>
      </div>
    </div>
  );
}

function Problem({ icon, title, body, onRetry, onAnyway }: { icon: React.ReactNode; title: string; body: React.ReactNode; onRetry?: () => void; onAnyway: () => void }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-saffron/15 text-saffron">{icon}</span>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-tight">{title}</p>
          <div className="mt-1 text-sm leading-relaxed text-muted">{body}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {onRetry ? (
          <motion.button whileTap={{ scale: 0.97 }} onClick={onRetry} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-line-strong font-semibold">
            <RotateCcw size={16} /> Try again
          </motion.button>
        ) : <span />}
        <motion.button whileTap={{ scale: 0.97 }} onClick={onAnyway} className="h-12 rounded-2xl bg-cream px-3 text-sm font-bold text-bg">
          Check in anyway
        </motion.button>
      </div>
    </div>
  );
}

function PrimaryButton({ onClick, busy, tone, icon, children }: { onClick: () => void; busy?: boolean; tone: "jamun" | "cream"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={busy}
      className={`mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-bold disabled:opacity-70 ${
        tone === "jamun" ? "bg-gradient-to-r from-jamun to-chilli text-white shadow-[0_10px_30px_-12px_var(--color-jamun)]" : "bg-cream text-bg"
      }`}
    >
      {busy ? <LoaderCircle size={18} className="animate-spin" /> : icon} {children}
    </motion.button>
  );
}

function Tag({ icon, tone, children }: { icon: React.ReactNode; tone?: "leaf"; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone === "leaf" ? "bg-leaf/15 text-leaf" : "bg-surface-2 text-faint"}`}>
      {icon} {children}
    </span>
  );
}

/** First run: set up your gym (name + location on a map). */
function SetupGym({ onOpen, sheet }: { onOpen: () => void; sheet: React.ReactNode }) {
  return (
    <section className="card relative overflow-hidden p-5">
      <div aria-hidden className="pointer-events-none absolute -right-14 -top-14 size-48 rounded-full bg-jamun opacity-20 blur-3xl" />
      <div className="relative flex items-center gap-2">
        <Building2 size={16} className="text-jamun" />
        <h2 className="font-display text-lg font-semibold">Gym check-in</h2>
      </div>
      <p className="relative mt-1 text-sm text-muted">Save your gym once. Tap when you arrive and when you leave, and your visits and time at the gym add up here.</p>
      <PrimaryButton onClick={onOpen} tone="jamun" icon={<MapPin size={18} />}>Set up your gym</PrimaryButton>
      {sheet}
    </section>
  );
}
