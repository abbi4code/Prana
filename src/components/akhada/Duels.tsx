"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { motion, useReducedMotion } from "motion/react";
import { Clock, LoaderCircle, RotateCcw, Share2, Swords, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { drawResultCard, shareResult } from "@/lib/akhadaShare";
import { addDays, parseDay } from "@/lib/dates";
import { duels, failText, social, type Duel } from "@/lib/social/api";
import { avatarOf, invalidate, useRemote, useSocial } from "@/lib/social/state";
import { useUI } from "@/lib/store";
import { Avatar, Who } from "./Profile";

// Weekly duels (D48): you vs a friend, 7 days from the day after it's accepted; score = effort on your best 6 days.

const fmtDay = (d: string) => parseDay(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function stateLine(d: Duel) {
  switch (d.state) {
    case "pending": return d.challenger ? `Waiting for ${d.them.name.split(" ")[0]} to accept` : `${d.them.name.split(" ")[0]} challenged you`;
    case "upcoming": return `Starts ${fmtDay(d.startsOn!)}`;
    case "live": {
      const diff = (d.myScore ?? 0) - (d.theirScore ?? 0);
      return diff > 0 ? `You're ahead by ${diff}` : diff < 0 ? `Behind by ${-diff}. Still time!` : "Level. Every set counts";
    }
    case "ended": return `Ended · final on ${fmtDay(d.finalOn!)}`;
    case "final": return d.result === "won" ? "You won 🏆" : d.result === "lost" ? `${d.them.name.split(" ")[0]} won` : "A draw 🤝";
    case "expired": return "Invite expired";
    case "declined": return "Declined";
    default: return "";
  }
}

export function DuelCard({ d, onOpen }: { d: Duel; onOpen: () => void }) {
  const showToast = useUI((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const respond = async (accept: boolean) => {
    setBusy(true);
    const r = await duels.respond(d.id, accept);
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    invalidate("duels");
    void useSocial.getState().refresh();
    if (accept) onOpen();
  };
  const scored = d.myScore != null && d.theirScore != null;
  const total = Math.max(1, (d.myScore ?? 0) + (d.theirScore ?? 0));
  return (
    <div className="card p-4">
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <Avatar id={d.mine.avatar} size={36} />
        <span className="font-display text-xl font-semibold tabular">{scored ? d.myScore : "–"}</span>
        <span className="flex-1 text-center text-xs font-bold uppercase tracking-wider text-faint">vs</span>
        <span className="font-display text-xl font-semibold tabular">{scored ? d.theirScore : "–"}</span>
        <Avatar id={d.them.avatar} size={36} />
      </button>
      {scored && (d.state === "live" || d.state === "ended" || d.state === "final") && (
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-3">
          <motion.div className="h-full bg-jamun" initial={{ width: 0 }} animate={{ width: `${((d.myScore ?? 0) / total) * 100}%` }} transition={{ duration: 0.8 }} />
          <div className="h-full flex-1 bg-saffron/70" />
        </div>
      )}
      <p className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">vs <b className="text-text">{d.them.name}</b> · {stateLine(d)}</span>
        {d.state === "live" && <span className="shrink-0 rounded-full bg-leaf/15 px-2 py-0.5 font-semibold text-leaf">Live</span>}
      </p>
      {d.state === "pending" && !d.challenger && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={() => respond(false)} className="h-10 rounded-xl border border-line-strong text-sm font-semibold">Not now</button>
          <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => respond(true)} className="h-10 rounded-xl bg-gradient-to-r from-jamun to-chilli text-sm font-bold text-white">Accept duel</motion.button>
        </div>
      )}
    </div>
  );
}

/** The Duels block at the top of the Challenges tab. */
export function DuelsSection() {
  const router = useRouter();
  const { data } = useRemote("duels", () => duels.list());
  const [picking, setPicking] = useState(false);
  const open = (id: string) => router.push(`/akhada/d/${id}`);
  const shown = (data ?? []).filter((d) => ["pending", "upcoming", "live", "ended", "final"].includes(d.state)).slice(0, 6);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Weekly duels</p>
        <button onClick={() => setPicking(true)} className="flex items-center gap-1.5 text-sm font-semibold text-jamun"><Swords size={15} /> New duel</button>
      </div>
      {!data ? (
        <div className="skeleton h-24" />
      ) : shown.length === 0 ? (
        <button onClick={() => setPicking(true)} className="card flex w-full items-center gap-3 p-4 text-left">
          <span className="grid size-11 place-items-center rounded-2xl bg-jamun/15 text-jamun"><Swords size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Duel a friend for a week</span>
            <span className="block text-xs text-muted">Most effort on your best 6 days wins. Starts the day after they accept.</span>
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{shown.map((d) => <DuelCard key={d.id} d={d} onOpen={() => open(d.id)} />)}</div>
      )}
      <NewDuelSheet open={picking} onClose={() => setPicking(false)} onCreated={(d) => { setPicking(false); invalidate("duels"); open(d.id); }} />
    </section>
  );
}

function NewDuelSheet({ open, onClose, onCreated, preset }: { open: boolean; onClose: () => void; onCreated: (d: Duel) => void; preset?: string }) {
  return (
    <Sheet open={open} onClose={onClose} size="narrow">
      {open && <NewDuelBody onClose={onClose} onCreated={onCreated} preset={preset} />}
    </Sheet>
  );
}

function NewDuelBody({ onClose, onCreated, preset }: { onClose: () => void; onCreated: (d: Duel) => void; preset?: string }) {
  const showToast = useUI((s) => s.showToast);
  const { data } = useRemote("friends", () => social.friends());
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (handle: string) => {
    setBusy(handle);
    const r = await duels.create(handle);
    setBusy(null);
    if (!r.ok) return showToast(failText(r));
    showToast("Duel sent. It starts the day after they accept.");
    onCreated(r.data);
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-5 pt-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Weekly duel</p>
          <Drawer.Title className="font-display text-2xl font-semibold">Pick your opponent</Drawer.Title>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line-strong text-muted"><X size={18} /></button>
      </div>
      <p className="px-5 pt-2 text-sm text-muted">7 days. Each day scores up to 100 effort; your best 6 days count (max 600), so one rest day costs nothing. Tie? More GPS-verified gym days wins.</p>
      <ul className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-5 pb-6 pt-3">
        {!data ? (
          <li className="skeleton h-14" />
        ) : data.friends.length === 0 ? (
          <li className="py-4 text-sm text-muted">Duels are between friends. Add friends in the Akhada first.</li>
        ) : (
          data.friends.map((f) => (
            <li key={f.handle}>
              <button onClick={() => go(f.handle)} disabled={!!busy} className={`flex w-full items-center gap-2 rounded-2xl p-2 text-left hover:bg-surface-2 ${preset === f.handle ? "bg-surface-2" : ""}`}>
                <span className="min-w-0 flex-1"><Who c={f} sub={`${f.active}/6 this week`} /></span>
                {busy === f.handle ? <LoaderCircle size={18} className="animate-spin text-muted" /> : <Swords size={18} className="text-jamun" />}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** One duel: the face-off, day by day. */
export function DuelView({ id }: { id: string }) {
  const router = useRouter();
  const showToast = useUI((s) => s.showToast);
  const reduce = useReducedMotion();
  const { data: d, result, reload } = useRemote(`duel:${id}`, () => duels.get(id));
  const [busy, setBusy] = useState(false);
  if (!d) {
    if (result && !result.ok) return <p className="card p-6 text-sm text-muted">{failText(result)}</p>;
    return <div className="space-y-3"><div className="skeleton h-56" /><div className="skeleton h-40" /></div>;
  }
  const scored = d.myScore != null && d.theirScore != null;
  const lead = (d.myScore ?? 0) - (d.theirScore ?? 0);
  const act = async (fn: () => Promise<Awaited<ReturnType<typeof duels.cancel>> | Awaited<ReturnType<typeof duels.respond>>>, after?: () => void) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    invalidate("duel");
    void useSocial.getState().refresh();
    after?.();
    void reload();
  };
  const rematch = async () => {
    setBusy(true);
    const r = await duels.create(d.them.handle);
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    invalidate("duels");
    showToast("Rematch sent!");
    router.push(`/akhada/d/${r.data.id}`);
  };
  const share = async () => {
    const blob = await drawResultCard({
      kicker: "Weekly duel",
      emoji: d.result === "won" ? "🏆" : d.result === "draw" ? "🤝" : "⚔️",
      headline: d.result === "won" ? "Won the duel" : d.result === "draw" ? "A draw" : "Fought well",
      title: `vs ${d.them.name} (@${d.them.handle})`,
      big: `${d.myScore} – ${d.theirScore}`,
      sub: `${fmtDay(d.startsOn!)} – ${fmtDay(d.endsOn!)} · effort, best 6 days`,
      people: [
        { emoji: avatarOf(d.mine.avatar).emoji, name: d.mine.name, value: String(d.myScore), me: true },
        { emoji: avatarOf(d.them.avatar).emoji, name: d.them.name, value: String(d.theirScore) },
      ],
      tone: d.result === "won" ? "win" : "plain",
    });
    const r = await shareResult(blob, `prana-duel-${d.id.slice(0, 8)}.png`, `${d.myScore}–${d.theirScore} in my weekly duel on Prana`);
    if (r === "saved") showToast("Image saved.");
  };
  const maxDay = 100;

  return (
    <div className="space-y-4">
      <section className="card relative overflow-hidden p-5">
        <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-jamun opacity-25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-saffron opacity-20 blur-3xl" />
        <p className="relative text-center text-xs font-semibold uppercase tracking-wider text-muted">Weekly duel{d.startsOn ? ` · ${fmtDay(d.startsOn)} – ${fmtDay(d.endsOn!)}` : ""}</p>
        <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Side c={d.mine} score={d.myScore} win={d.result === "won"} label="You" />
          <motion.span initial={{ scale: reduce ? 1 : 0.6, rotate: reduce ? 0 : -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="grid size-12 place-items-center rounded-full bg-surface-2 text-jamun">
            <Swords size={22} />
          </motion.span>
          <Side c={d.them} score={d.theirScore} win={d.result === "lost"} label={d.them.name.split(" ")[0]} />
        </div>
        <p className="relative mt-4 text-center font-semibold">
          {d.state === "live" ? (lead > 0 ? `You're ahead by ${lead}` : lead < 0 ? `${d.them.name.split(" ")[0]} leads by ${-lead}. Go get it!` : "Level. Every set counts") : stateLine(d)}
        </p>
        {d.state === "ended" && <p className="relative mt-1 flex items-center justify-center gap-1 text-xs text-muted"><Clock size={12} /> Logs can arrive for 2 more days. Final on {fmtDay(d.finalOn!)}.</p>}
      </section>

      {scored && d.myDays && d.theirDays && (
        <section className="card p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            <span>Day by day</span>
            <span className="flex gap-3 normal-case tracking-normal"><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-jamun" />You</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-saffron" />{d.them.name.split(" ")[0]}</span></span>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {d.myDays.map((m, i) => {
              const th = d.theirDays![i];
              const day = addDays(d.startsOn!, i);
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-28 items-end gap-1">
                    <motion.span className="w-2.5 rounded-full bg-jamun" initial={{ height: 0 }} animate={{ height: `${Math.max(4, (m / maxDay) * 100)}%` }} transition={{ delay: i * 0.05, duration: 0.6 }} style={{ opacity: m ? 1 : 0.25 }} />
                    <motion.span className="w-2.5 rounded-full bg-saffron" initial={{ height: 0 }} animate={{ height: `${Math.max(4, (th / maxDay) * 100)}%` }} transition={{ delay: i * 0.05 + 0.05, duration: 0.6 }} style={{ opacity: th ? 1 : 0.25 }} />
                  </div>
                  <span className="text-[10px] font-bold text-faint">{LETTERS[(parseDay(day).getDay() + 6) % 7]}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Each day scores up to 100 effort (12 working sets or 30 active minutes). Your best 6 days count.</p>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {d.state === "pending" && !d.challenger && (
          <>
            <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => act(() => duels.respond(d.id, true))} className="h-11 rounded-xl bg-gradient-to-r from-jamun to-chilli px-5 text-sm font-bold text-white">Accept duel</motion.button>
            <button disabled={busy} onClick={() => act(() => duels.respond(d.id, false), () => router.push("/akhada?tab=challenges"))} className="h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold">Decline</button>
          </>
        )}
        {d.state === "pending" && d.challenger && (
          <button disabled={busy} onClick={() => act(() => duels.cancel(d.id), () => router.push("/akhada?tab=challenges"))} className="h-11 rounded-xl border border-line-strong px-4 text-sm font-semibold">Cancel invite</button>
        )}
        {d.state === "final" && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={share} className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-turmeric to-saffron px-5 text-sm font-bold text-on-accent"><Share2 size={16} /> Share result</motion.button>
        )}
        {(d.state === "final" || d.state === "expired" || d.state === "declined") && (
          <button disabled={busy} onClick={rematch} className="flex h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-semibold"><RotateCcw size={16} /> {d.state === "final" ? "Rematch" : "Try again"}</button>
        )}
      </div>
    </div>
  );
}

function Side({ c, score, win, label }: { c: Duel["mine"]; score: number | null; win: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <Avatar id={c.avatar} size={64} />
        {win && <span className="absolute -right-1 -top-2 text-2xl" aria-label="winner">👑</span>}
      </div>
      <p className="mt-2 max-w-full truncate text-sm font-semibold">{label}</p>
      <p className="font-display text-4xl font-semibold tabular">{score ?? "–"}</p>
    </div>
  );
}

export { NewDuelSheet };
