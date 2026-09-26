"use client";

import { getSupabase } from "../supabase";

// Akhada (D46, D47, .claude/social.md): typed calls to the Postgres functions in
// supabase/migrations/20260927100000_social.sql + 20260927101000_challenges.sql. Social is online-only and needs
// sign-in; every score is computed by the database from synced logs, so the app never sends a number to rank.

export type Card = { handle: string; name: string; avatar: string };
export type Me = Card & { listed: boolean; inviteToken: string; since: string; unread: number; requests: number; allowNudges: boolean; kudosToday: number; duelInvites: number };
export type Relation = "me" | "friend" | "incoming" | "outgoing" | "none" | "blocked";
export type Week = { active: number; verified: number; streak: number };
export type Person = Card & Week & { relation: Relation; since: string; month: { active: number; verified: number } };
/** kudosDay = their latest active day (today or yesterday) you can cheer; canNudge = 3 days quiet and nudges allowed */
export type Friend = Card & Week & { kudosDay: string | null; kudosSent: boolean; canNudge: boolean };
export type Friends = { friends: Friend[]; incoming: (Card & { at: string })[]; outgoing: Card[] };

export type Scope = "friends" | "global";
export type Period = "week" | "last_week" | "month" | "last_month";
export type BoardRow = Card & { rank: number | null; active: number; effort: number; verified: number; streak: number; me: boolean; friend: boolean };
export type Board = {
  from: string; to: string; cap: number; scope: Scope; period: Period; total: number; trusted: boolean;
  me: { rank: number | null; active: number; effort: number; verified: number } | null;
  rows: BoardRow[];
};

export type Notice = {
  id: number; at: string; read: boolean; actor: Card | null; challenge: string | null; duel: string | null; title: string | null;
  kind: "friend_request" | "friend_accepted" | "challenge_invite" | "challenge_joined" | "challenge_result" | "duel_invite" | "duel_accepted" | "duel_result" | "kudos" | "nudge";
  payload: { place?: number; done?: boolean; value?: number; members?: number; result?: DuelResult; mine?: number; theirs?: number; title?: string } | null;
};

export type DuelResult = "won" | "lost" | "draw";
export type Duel = {
  id: string; state: "pending" | "expired" | "declined" | "cancelled" | "upcoming" | "live" | "ended" | "final";
  mine: Card; them: Card; challenger: boolean; createdAt: string; startsOn: string | null; endsOn: string | null; finalOn: string | null;
  myScore: number | null; theirScore: number | null; result: DuelResult | null; myDays: number[] | null; theirDays: number[] | null;
};
export type Trophies = { wins: string[]; finishes: string[]; duels: string[]; kudos: string[] };

export type ChallengeKind = "lift" | "days" | "minutes" | "team_minutes";
export type LiftBest = { kg: number; reps: number; date: string; workoutId: string; verified: boolean; flagged: boolean; disputes: number };
/** settled challenges: `final` + `place` (1 = first; equal results share a place) */
export type Progress = { value: number; done: boolean; lift?: LiftBest | null; final?: boolean; place?: number };
export type Challenge = {
  id: string; title: string; kind: ChallengeKind; exercise: string | null; exerciseName: string | null; target: number;
  maxReps: number; verifiedOnly: boolean; audience: "invite" | "open"; startsOn: string; endsOn: string; maxMembers: number;
  state: "upcoming" | "live" | "ended" | "cancelled"; creator: Card | null; isCreator: boolean; members: number;
  myStatus: "invited" | "joined" | "declined" | "left" | null; mine: Progress | null; team: number | null; joinCode: string | null;
  list?: (Card & { me: boolean; creator: boolean; progress: Progress })[];
};

export type Fail =
  | "offline" | "signed_out" | "no_profile" | "rate_limited" | "not_found" | "full" | "closed" | "adult_required"
  | "handle_invalid" | "handle_reserved" | "handle_blocked" | "handle_taken" | "bad_name" | "bad_title" | "bad_challenge"
  | "bad_start" | "bad_length" | "bad_target" | "not_allowed" | "self" | "not_active" | "too_many" | "duel_exists" | "failed";
export type Result<T> = { ok: true; data: T } | { ok: false; reason: Fail; retryAfterS?: number };

const KNOWN = new Set<string>([
  "no_profile", "not_found", "full", "closed", "adult_required", "handle_invalid", "handle_reserved", "handle_blocked",
  "handle_taken", "bad_name", "bad_title", "bad_challenge", "bad_start", "bad_length", "bad_target", "not_allowed", "self",
  "not_active", "too_many", "duel_exists",
]);

/** One database function call. Errors raised by the functions come back as a short reason. */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<Result<T>> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, reason: "offline" };
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "signed_out" };
  try {
    const { data, error } = await sb.rpc(fn, args);
    if (!error) return { ok: true, data: data as T };
    const msg = error.message ?? "";
    const rate = msg.match(/rate_limited:(\d+)/);
    if (rate) return { ok: false, reason: "rate_limited", retryAfterS: Number(rate[1]) };
    if (/not_signed_in|JWT|jwt/.test(msg)) return { ok: false, reason: "signed_out" };
    const known = msg.match(/^[a-z_]+/)?.[0];
    return { ok: false, reason: known && KNOWN.has(known) ? (known as Fail) : "failed" };
  } catch {
    return { ok: false, reason: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "failed" };
  }
}

/** Plain words for a failed call. */
export function failText(r: { reason: Fail; retryAfterS?: number }): string {
  switch (r.reason) {
    case "offline": return "You're offline. The Akhada needs a connection.";
    case "signed_out": return "Sign in to use the Akhada.";
    case "no_profile": return "Join the Akhada first.";
    case "rate_limited": return `Easy there. Try again in ${r.retryAfterS ?? 60} s.`;
    case "not_found": return "Not found. It may be private or gone.";
    case "full": return "This challenge is full.";
    case "closed": return "This challenge has ended.";
    case "adult_required": return "The Akhada is for people 18 and over.";
    case "handle_invalid": return "3–20 letters, numbers or _ only.";
    case "handle_reserved": return "That handle is reserved.";
    case "handle_blocked": case "bad_name": return "Please choose something friendlier.";
    case "handle_taken": return "That handle is taken.";
    case "bad_title": return "Please choose a friendlier title.";
    case "bad_start": return "Start today or within the next 30 days.";
    case "bad_length": case "bad_target": case "bad_challenge": return "That target doesn't fit the challenge length.";
    case "not_allowed": return "Only the creator can do that, before it starts.";
    case "self": return "That's your own invite link.";
    case "not_active": return "They haven't trained today yet. Cheer them when they do!";
    case "too_many": return "You have 5 duels going. Finish one first.";
    case "duel_exists": return "You already have a duel going with them.";
    default: return "Something went wrong. Try again.";
  }
}

// ── calls ──
export const social = {
  me: () => rpc<Me | null>("social_me"),
  /** on app open: settles finished duels/challenges (results + notifications), then the profile */
  sync: () => rpc<Me | null>("social_sync"),
  trophies: () => rpc<Trophies>("social_trophies"),
  kudos: (handle: string) => rpc<"sent" | "already">("social_kudos", { p_handle: handle }),
  nudge: (handle: string) => rpc<null>("social_nudge", { p_handle: handle }),
  setNudges: (on: boolean) => rpc<null>("social_set_nudges", { p_on: on }),
  join: (p: { handle: string; name: string; avatar: string; listed: boolean; adult: boolean }) =>
    rpc<Me>("social_join", { p_handle: p.handle, p_name: p.name, p_avatar: p.avatar, p_listed: p.listed, p_adult: p.adult }),
  checkHandle: (handle: string) => rpc<"ok" | "invalid" | "reserved" | "blocked" | "taken">("social_check_handle", { p_handle: handle }),
  leave: () => rpc<null>("social_leave"),
  resetInvite: () => rpc<string>("social_reset_invite"),
  board: (scope: Scope, period: Period) => rpc<Board>("social_board", { p_scope: scope, p_period: period }),
  friends: () => rpc<Friends>("social_friends"),
  search: (q: string) => rpc<(Card & { relation: Relation })[]>("social_search", { p_q: q }),
  person: (handle: string) => rpc<Person>("social_person", { p_handle: handle }),
  addFriend: (handle: string) => rpc<"pending" | "friends">("social_friend_add", { p_handle: handle }),
  respond: (handle: string, accept: boolean) => rpc<"friends" | "none">("social_friend_respond", { p_handle: handle, p_accept: accept }),
  removeFriend: (handle: string) => rpc<null>("social_friend_remove", { p_handle: handle }),
  acceptInvite: (token: string) => rpc<Card>("social_accept_invite", { p_token: token }),
  block: (handle: string) => rpc<null>("social_block", { p_handle: handle }),
  unblock: (handle: string) => rpc<null>("social_unblock", { p_handle: handle }),
  blocked: () => rpc<Card[]>("social_blocked_list"),
  report: (handle: string, reason: "name" | "cheating" | "harassment" | "spam" | "other", note?: string, challenge?: string) =>
    rpc<null>("social_report", { p_handle: handle, p_reason: reason, p_note: note ?? null, p_challenge: challenge ?? null }),
  inbox: () => rpc<Notice[]>("social_inbox"),
  markRead: () => rpc<null>("social_mark_read"),
};

export const challenges = {
  list: () => rpc<{ mine: Challenge[]; open: Challenge[] }>("challenge_list"),
  get: (id: string, code?: string | null) => rpc<Challenge>("challenge_get", { p_id: id, p_code: code ?? null }),
  create: (c: {
    title: string; kind: ChallengeKind; target: number; exercise?: string; exerciseName?: string; maxReps?: number;
    verifiedOnly: boolean; audience: "invite" | "open"; startsOn: string; days: number; invite: string[];
  }) =>
    rpc<Challenge>("challenge_create", {
      p_title: c.title, p_kind: c.kind, p_target: c.target, p_exercise: c.exercise ?? null, p_exercise_name: c.exerciseName ?? null,
      p_max_reps: c.maxReps ?? 5, p_verified_only: c.verifiedOnly, p_audience: c.audience, p_starts_on: c.startsOn, p_days: c.days,
      p_invite: c.invite,
    }),
  invite: (id: string, handles: string[]) => rpc<null>("challenge_invite", { p_id: id, p_invite: handles }),
  join: (id: string, code?: string | null) => rpc<Challenge>("challenge_join", { p_id: id, p_code: code ?? null }),
  decline: (id: string) => rpc<null>("challenge_decline", { p_id: id }),
  leave: (id: string) => rpc<null>("challenge_leave", { p_id: id }),
  cancel: (id: string) => rpc<null>("challenge_cancel", { p_id: id }),
  dispute: (id: string, handle: string, workoutId: string, reason?: string) =>
    rpc<null>("challenge_dispute", { p_id: id, p_handle: handle, p_workout: workoutId, p_reason: reason ?? null }),
};

export const duels = {
  list: () => rpc<Duel[]>("duel_list"),
  get: (id: string) => rpc<Duel>("duel_get", { p_id: id }),
  create: (handle: string) => rpc<Duel>("duel_create", { p_handle: handle }),
  respond: (id: string, accept: boolean) => rpc<Duel>("duel_respond", { p_id: id, p_accept: accept }),
  cancel: (id: string) => rpc<null>("duel_cancel", { p_id: id }),
};

export const inviteUrl = (token: string) => `${location.origin}/akhada/join/${token}`;
export const challengeUrl = (c: Pick<Challenge, "id" | "joinCode">) => `${location.origin}/akhada/c/${c.id}${c.joinCode ? `?code=${c.joinCode}` : ""}`;
