"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import { Ban, Check, Copy, Flag, Link2, LoaderCircle, RefreshCw, Search, Share2, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { failText, inviteUrl, social, type Card, type Notice, type Relation } from "@/lib/social/api";
import { invalidate, useRemote, useSocial } from "@/lib/social/state";
import { useUI } from "@/lib/store";
import { Avatar, Who } from "./Profile";

function Header({ title, kicker, onClose }: { title: string; kicker?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-1">
      <div className="min-w-0">
        {kicker && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">{kicker}</p>}
        <Drawer.Title className="truncate font-display text-2xl font-semibold">{title}</Drawer.Title>
      </div>
      <button onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-muted hover:text-text">
        <X size={18} />
      </button>
    </div>
  );
}

/** The friend action a relation allows (add / accept / pending / friends). */
export function FriendButton({ handle, relation, onChange, compact = false }: { handle: string; relation: Relation; onChange: (r: Relation) => void; compact?: boolean }) {
  const showToast = useUI((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const run = async (kind: "add" | "accept") => {
    setBusy(true);
    const r = kind === "add" ? await social.addFriend(handle) : await social.respond(handle, true);
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    invalidate("friends");
    invalidate("board");
    onChange(r.data === "friends" ? "friend" : "outgoing");
    if (r.data === "friends") void useSocial.getState().refresh();
  };
  const base = `flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-semibold ${compact ? "h-9 px-3 text-xs" : "h-11 px-4 text-sm"}`;
  if (relation === "friend") return <span className={`${base} bg-leaf/15 text-leaf`}><Check size={15} /> Friends</span>;
  if (relation === "outgoing") return <span className={`${base} bg-surface-2 text-muted`}>Requested</span>;
  if (relation === "me" || relation === "blocked") return null;
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={() => run(relation === "incoming" ? "accept" : "add")} disabled={busy} className={`${base} bg-cream text-bg disabled:opacity-60`}>
      {busy ? <LoaderCircle size={15} className="animate-spin" /> : <UserPlus size={15} />} {relation === "incoming" ? "Accept" : "Add friend"}
    </motion.button>
  );
}

/** 🔥 Shabaash on a friend's active day (once per day), or 👋 Nudge after 3 quiet days. */
export function CheerButton({ f, onDone }: { f: { handle: string; name: string; kudosDay: string | null; kudosSent: boolean; canNudge: boolean }; onDone?: () => void }) {
  const showToast = useUI((s) => s.showToast);
  const [sent, setSent] = useState<null | "kudos" | "nudge">(f.kudosSent ? "kudos" : null);
  const [busy, setBusy] = useState(false);
  const first = f.name.split(" ")[0];
  const kudos = async () => {
    setBusy(true);
    const r = await social.kudos(f.handle);
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    navigator.vibrate?.(10);
    setSent("kudos");
    invalidate("friends");
    showToast(`Shabaash sent to ${first} 🔥`);
    onDone?.();
  };
  const nudge = async () => {
    setBusy(true);
    const r = await social.nudge(f.handle);
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    setSent("nudge");
    invalidate("friends");
    showToast(`Nudged ${first}. A friendly poke, nothing more.`);
    onDone?.();
  };
  const base = "flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition-colors";
  if (f.kudosDay)
    return sent === "kudos" ? (
      <span className={`${base} bg-saffron/15 text-saffron`}>🔥 Sent</span>
    ) : (
      <motion.button whileTap={{ scale: 0.9 }} disabled={busy} onClick={kudos} className={`${base} bg-gradient-to-r from-turmeric to-saffron text-on-accent`}>🔥 Shabaash</motion.button>
    );
  if (f.canNudge)
    return sent === "nudge" ? (
      <span className={`${base} bg-surface-2 text-muted`}>👋 Nudged</span>
    ) : (
      <motion.button whileTap={{ scale: 0.9 }} disabled={busy} onClick={nudge} className={`${base} border border-line-strong text-muted hover:text-text`}>👋 Nudge</motion.button>
    );
  return null;
}

const REASONS = [
  { id: "cheating", label: "Fake or impossible logs" },
  { id: "name", label: "Offensive name" },
  { id: "harassment", label: "Harassment" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Something else" },
] as const;

/** A person: their week, streak, and what you can do (friend, block, report). */
export function PersonSheet({ handle, onClose, challenge }: { handle: string | null; onClose: () => void; challenge?: string }) {
  return (
    <Sheet open={!!handle} onClose={onClose} size="narrow">
      {handle && <PersonBody handle={handle} onClose={onClose} challenge={challenge} />}
    </Sheet>
  );
}

function PersonBody({ handle, onClose, challenge }: { handle: string; onClose: () => void; challenge?: string }) {
  const showToast = useUI((s) => s.showToast);
  const { data: p, result, reload } = useRemote(`person:${handle}`, () => social.person(handle));
  const [rel, setRel] = useState<Relation | null>(null);
  const [mode, setMode] = useState<"main" | "report" | "block">("main");
  const [busy, setBusy] = useState(false);
  const relation = rel ?? p?.relation ?? "none";

  const block = async () => {
    setBusy(true);
    const r = await social.block(handle);
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    invalidate("");
    showToast(`Blocked @${handle}. You won't see each other in the Akhada.`);
    onClose();
  };
  const report = async (reason: (typeof REASONS)[number]["id"]) => {
    setBusy(true);
    const r = await social.report(handle, reason, undefined, challenge);
    setBusy(false);
    if (!r.ok) return showToast(failText(r));
    showToast("Thanks. We'll take a look.");
    setMode("main");
  };
  const unfriend = async () => {
    const r = await social.removeFriend(handle);
    if (!r.ok) return showToast(failText(r));
    invalidate("");
    setRel("none");
    void reload();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header title={p ? p.name : `@${handle}`} kicker="Akhada" onClose={onClose} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
        {!p && result && !result.ok ? (
          <p className="text-sm text-muted">{failText(result)}</p>
        ) : !p ? (
          <div className="space-y-3"><div className="skeleton h-20" /><div className="skeleton h-28" /></div>
        ) : mode === "report" ? (
          <div>
            <p className="font-semibold">Report @{handle}</p>
            <p className="mt-1 text-sm text-muted">Three different reports hide someone from the Everyone board until reviewed.</p>
            <div className="mt-3 space-y-2">
              {REASONS.map((r) => (
                <button key={r.id} disabled={busy} onClick={() => report(r.id)} className="flex h-12 w-full items-center rounded-2xl border border-line-strong px-4 text-left text-sm font-semibold hover:bg-surface-2">
                  {r.label}
                </button>
              ))}
              <button onClick={() => setMode("main")} className="h-11 w-full text-sm text-muted">Cancel</button>
            </div>
          </div>
        ) : mode === "block" ? (
          <div>
            <p className="font-semibold">Block @{handle}?</p>
            <p className="mt-1 text-sm text-muted">You&apos;ll stop being friends, and neither of you will see the other on boards, in search or in challenges.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setMode("main")} className="h-12 rounded-2xl border border-line-strong font-semibold">Cancel</button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={block} disabled={busy} className="h-12 rounded-2xl bg-chilli font-bold text-white">Block</motion.button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar id={p.avatar} size={64} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-muted">@{p.handle}</p>
                <p className="text-xs text-faint">In the Akhada since {new Date(p.since).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p>
              </div>
              <FriendButton handle={p.handle} relation={relation} onChange={setRel} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <Stat big={`${p.active}/6`} small="active this week" />
              <Stat big={`${p.month.active}`} small="active this month" />
              <Stat big={`🔥 ${p.streak}`} small="day streak" />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck size={13} className="text-leaf" /> {p.verified} GPS-verified gym {p.verified === 1 ? "day" : "days"} this week
            </p>
            {relation !== "me" && (
              <div className="mt-6 space-y-1 border-t border-line pt-3">
                {relation === "friend" && (
                  <button onClick={unfriend} className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
                    <UserMinus size={16} /> Remove friend
                  </button>
                )}
                <button onClick={() => setMode("report")} className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
                  <Flag size={16} /> Report
                </button>
                <button onClick={() => setMode("block")} className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2 text-sm text-chilli hover:bg-chilli/10">
                  <Ban size={16} /> Block
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3">
      <p className="font-display text-2xl font-semibold tabular">{big}</p>
      <p className="text-[11px] text-muted">{small}</p>
    </div>
  );
}

/** Friends: invite link, search, requests, list, blocked. */
export function FriendsSheet({ open, onClose, onPerson }: { open: boolean; onClose: () => void; onPerson: (h: string) => void }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {open && <FriendsBody onClose={onClose} onPerson={onPerson} />}
    </Sheet>
  );
}

function FriendsBody({ onClose, onPerson }: { onClose: () => void; onPerson: (h: string) => void }) {
  const me = useSocial((s) => s.me);
  const showToast = useUI((s) => s.showToast);
  const { data, reload } = useRemote("friends", () => social.friends());
  const [q, setQ] = useState("");
  const [found, setFound] = useState<(Card & { relation: Relation })[] | null>(null);
  const [blocked, setBlocked] = useState<Card[] | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().replace(/^@/, "").length < 2) return setFound(null);
      const r = await social.search(q.trim());
      setFound(r.ok ? r.data : []);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (!me) return null;
  const url = inviteUrl(me.inviteToken);
  const share = async () => {
    const text = `Join me in the Akhada on Prana. We'll be friends as soon as you open this:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Prana · Akhada", text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    showToast("Invite link copied.");
  };
  const respond = async (h: string, accept: boolean) => {
    const r = await social.respond(h, accept);
    if (!r.ok) return showToast(failText(r));
    invalidate("board");
    void reload();
    void useSocial.getState().refresh();
  };
  const resetLink = async () => {
    const r = await social.resetInvite();
    if (!r.ok) return showToast(failText(r));
    await useSocial.getState().refresh();
    showToast("New invite link. The old one no longer works.");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header title="Friends" kicker="Akhada" onClose={onClose} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
        <div className="rounded-2xl bg-gradient-to-br from-turmeric/15 to-saffron/10 p-4">
          <p className="flex items-center gap-2 font-semibold"><Link2 size={16} className="text-saffron" /> Your invite link</p>
          <p className="mt-1 text-sm text-muted">Anyone who opens it becomes your friend. Share it only with people you know.</p>
          <div className="mt-3 flex gap-2">
            <motion.button whileTap={{ scale: 0.97 }} onClick={share} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-turmeric to-saffron text-sm font-bold text-on-accent">
              <Share2 size={16} /> Share invite
            </motion.button>
            <button onClick={() => navigator.clipboard?.writeText(url).then(() => showToast("Invite link copied."))} aria-label="Copy invite link" className="grid size-11 place-items-center rounded-xl border border-line-strong">
              <Copy size={16} />
            </button>
            <button onClick={resetLink} aria-label="Make a new invite link" title="New link (the old one stops working)" className="grid size-11 place-items-center rounded-xl border border-line-strong">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <label className="relative mt-4 flex items-center">
          <Search size={16} className="pointer-events-none absolute left-3.5 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find people by @handle or name"
            autoCapitalize="none"
            className="h-12 w-full rounded-2xl border border-line-strong bg-bg/60 pl-10 pr-4 outline-none placeholder:text-faint focus:border-turmeric/60"
          />
        </label>
        {found && (
          <ul className="mt-2 space-y-1">
            {found.length === 0 && <li className="px-1 py-2 text-sm text-muted">No one found. People who hide from the Everyone board can only be added with their invite link.</li>}
            {found.map((p) => (
              <li key={p.handle} className="flex items-center gap-2 rounded-2xl px-1 py-1.5">
                <button onClick={() => onPerson(p.handle)} className="min-w-0 flex-1 text-left"><Who c={p} /></button>
                <FriendButton handle={p.handle} relation={p.relation} compact onChange={(r) => setFound((l) => l?.map((x) => (x.handle === p.handle ? { ...x, relation: r } : x)) ?? null)} />
              </li>
            ))}
          </ul>
        )}

        {data && data.incoming.length > 0 && (
          <Section title={`Requests · ${data.incoming.length}`}>
            {data.incoming.map((p) => (
              <li key={p.handle} className="flex items-center gap-2 py-1.5">
                <button onClick={() => onPerson(p.handle)} className="min-w-0 flex-1 text-left"><Who c={p} /></button>
                <button onClick={() => respond(p.handle, false)} aria-label={`Decline ${p.handle}`} className="grid size-9 place-items-center rounded-xl border border-line-strong text-muted"><X size={15} /></button>
                <button onClick={() => respond(p.handle, true)} className="flex h-9 items-center gap-1 rounded-xl bg-cream px-3 text-xs font-bold text-bg"><Check size={14} /> Accept</button>
              </li>
            ))}
          </Section>
        )}

        <Section title={data ? `Friends · ${data.friends.length}` : "Friends"}>
          {!data ? (
            [0, 1, 2].map((i) => <li key={i} className="skeleton my-1.5 h-12" />)
          ) : data.friends.length === 0 ? (
            <li className="py-2 text-sm text-muted">No friends yet. Share your invite link: the leaderboard is more fun with people you know.</li>
          ) : (
            data.friends.map((p) => (
              <li key={p.handle} className="flex items-center gap-2">
                <button onClick={() => onPerson(p.handle)} className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl py-1.5 text-left hover:bg-surface-2/60">
                  <span className="min-w-0 flex-1"><Who c={p} sub={`${p.active}/6 this week${p.streak > 0 ? ` · 🔥 ${p.streak}` : ""}`} /></span>
                </button>
                <CheerButton f={p} />
              </li>
            ))
          )}
        </Section>

        {data && data.outgoing.length > 0 && (
          <Section title="Sent">
            {data.outgoing.map((p) => (
              <li key={p.handle} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1"><Who c={p} sub="waiting" /></span>
                <button onClick={async () => { await social.removeFriend(p.handle); void reload(); }} className="h-9 rounded-xl border border-line-strong px-3 text-xs font-semibold text-muted">Cancel</button>
              </li>
            ))}
          </Section>
        )}

        <div className="mt-6 border-t border-line pt-3">
          {blocked === null ? (
            <button onClick={async () => { const r = await social.blocked(); setBlocked(r.ok ? r.data : []); }} className="text-sm text-faint hover:text-text">Blocked people</button>
          ) : (
            <Section title="Blocked">
              {blocked.length === 0 && <li className="py-1 text-sm text-muted">No one.</li>}
              {blocked.map((p) => (
                <li key={p.handle} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1"><Who c={p} /></span>
                  <button onClick={async () => { await social.unblock(p.handle); setBlocked((l) => l?.filter((x) => x.handle !== p.handle) ?? null); invalidate(""); }} className="h-9 rounded-xl border border-line-strong px-3 text-xs font-semibold">Unblock</button>
                </li>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{title}</p>
      <ul className="mt-1">{children}</ul>
    </div>
  );
}

/** Notifications: friend requests (accept inline), accepted, challenge invites / joins. Opening marks them read. */
export function InboxSheet({ open, onClose, onPerson, onChallenge, onDuel }: { open: boolean; onClose: () => void; onPerson: (h: string) => void; onChallenge: (id: string) => void; onDuel: (id: string) => void }) {
  return (
    <Sheet open={open} onClose={onClose} size="narrow">
      {open && <InboxBody onClose={onClose} onPerson={onPerson} onChallenge={onChallenge} onDuel={onDuel} />}
    </Sheet>
  );
}

function InboxBody({ onClose, onPerson, onChallenge, onDuel }: { onClose: () => void; onPerson: (h: string) => void; onChallenge: (id: string) => void; onDuel: (id: string) => void }) {
  const { data } = useRemote("inbox", () => social.inbox());
  useEffect(() => {
    const t = setTimeout(async () => {
      await social.markRead();
      invalidate("inbox");
      void useSocial.getState().refresh();
    }, 800);
    return () => clearTimeout(t);
  }, []);
  const text = (n: Notice): React.ReactNode => {
    const p = n.payload ?? {};
    switch (n.kind) {
      case "friend_request": return "wants to be friends";
      case "friend_accepted": return "is now your friend";
      case "challenge_invite": return <>invited you to <b>{n.title ?? "a challenge"}</b></>;
      case "challenge_joined": return <>joined <b>{n.title ?? "your challenge"}</b></>;
      case "challenge_result":
        return <>Results are in: <b>{p.title ?? n.title}</b>. {p.done ? (p.place === 1 && (p.members ?? 0) > 1 ? "You won! 👑" : `You finished ${p.place}${p.members ? ` of ${p.members}` : ""} ✓`) : "Good effort, next one's yours."}</>;
      case "duel_invite": return "challenged you to a weekly duel ⚔️";
      case "duel_accepted": return "accepted your duel. It starts tomorrow!";
      case "duel_result": return p.result === "won" ? <>You won your duel, <b>{p.mine}–{p.theirs}</b> 🏆</> : p.result === "draw" ? <>Your duel ended in a draw, <b>{p.mine}–{p.theirs}</b></> : <>won your duel, <b>{p.theirs}–{p.mine}</b>. Rematch?</>;
      case "kudos": return "says Shabaash! 🔥 for your workout";
      case "nudge": return "nudged you 👋 Aaj gym?";
    }
  };
  const self = (n: Notice) => n.kind === "challenge_result" || (n.kind === "duel_result" && n.payload?.result !== "lost");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header title="Inbox" kicker="Akhada" onClose={onClose} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
        {!data ? (
          [0, 1, 2].map((i) => <div key={i} className="skeleton my-2 h-14" />)
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Nothing yet. Friend requests, duels, challenge results and Shabaash land here.</p>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {data.map((n) => (
                <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex items-center gap-3 rounded-2xl p-2 ${n.read ? "" : "bg-turmeric/10"}`}>
                  {self(n) ? (
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-turmeric to-saffron text-lg" aria-hidden>
                      {n.kind === "duel_result" ? (n.payload?.result === "won" ? "🏆" : "🤝") : n.payload?.done ? (n.payload.place === 1 ? "👑" : "🎖️") : "💪"}
                    </span>
                  ) : n.actor ? <Avatar id={n.actor.avatar} size={40} /> : <span className="size-10" />}
                  <button
                    onClick={() => (n.duel ? onDuel(n.duel) : n.challenge ? onChallenge(n.challenge) : n.actor && onPerson(n.actor.handle))}
                    className="min-w-0 flex-1 text-left text-sm"
                  >
                    {!self(n) && <span className="font-semibold">{n.actor?.name ?? "Someone"} </span>}{text(n)}
                    <span className="block text-xs text-faint">{new Date(n.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
