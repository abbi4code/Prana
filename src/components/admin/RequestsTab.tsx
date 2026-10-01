"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, CheckCheck, ChevronDown, Link2, Loader2, PackageSearch, Sparkles, Undo2, UsersRound } from "lucide-react";
import Link from "next/link";
import { FoodIcon } from "@/components/FoodIcon";
import { adminFetch, failText, invalidateAdmin, useAdminQuery } from "@/lib/admin/api";
import type { FoodRequestFilter, FoodRequestPerson, FoodRequestRow, FoodRequestStatus, FoodRequests, FoodReview as Review } from "@/lib/admin/types";
import { dayKey } from "@/lib/dates";
import { getFood, matchFood } from "@/lib/foods";
import { useUI } from "@/lib/store";
import { FoodReview } from "./FoodReview";
import { Empty, ErrorState, Panel, PanelSkeleton, Segmented, Stat, UserAvatar, ago, nf, shortDay } from "./ui";

// D54 (.claude/food-requests.md): what members looked for and couldn't find, most wanted first. Triage by hand
// (Same as / Dismiss) or Research: the AI names a source, the server reads the numbers, a candidate waits above.

const FILTERS: { v: FoodRequestFilter; label: string }[] = [
  { v: "open", label: "Open" },
  { v: "done", label: "Done" },
  { v: "junk", label: "Dismissed" },
  { v: "all", label: "All" },
];

const STATUS: Record<FoodRequestStatus, { label: string; cls: string }> = {
  new: { label: "new", cls: "bg-turmeric/15 text-turmeric" },
  researching: { label: "in review", cls: "bg-sky/15 text-sky" },
  alias: { label: "alias", cls: "bg-leaf/15 text-leaf" },
  found: { label: "added", cls: "bg-leaf/15 text-leaf" },
  not_found: { label: "no source", cls: "bg-surface-3 text-muted" },
  junk: { label: "dismissed", cls: "bg-surface-3 text-faint" },
};

/** Worth showing as the closest catalog food (the AI logger's own bar for a spelling match, MIN_FUZZY). */
const HINT_SCORE = 0.6;
/**
 * Strong enough to offer one-tap "Same as": below this a single shared word can carry the score
 * ("Missi Roti" → Chapati / Roti at 71 %), so the admin decides from the hint instead.
 */
const ALIAS_SCORE = 0.85;

export function RequestsTab({ days }: { days: number }) {
  const [filter, setFilter] = useState<FoodRequestFilter>("open");
  const path = `/api/admin/food-requests?filter=${filter}&days=${days}`;
  const { data, error, reload } = useAdminQuery<FoodRequests>(path);
  // requests with a candidate waiting (same request as the review panel's, shared through the query cache)
  const review = useAdminQuery<Review>(`/api/admin/food-review?status=pending`);
  const inReview = useMemo(() => new Set((review.data?.candidates ?? []).map((c) => c.request?.id).filter(Boolean)), [review.data]);
  // triaged in this view: hide from the open list straight away, the next load confirms it
  const [changed, setChanged] = useState<Map<number, FoodRequestStatus>>(new Map());
  const [busy, setBusy] = useState<number | null>(null);
  // research (phase 3): one food per call; what each run said, the AI's "same as" suggestions, the batch progress
  const [running, setRunning] = useState<Set<number>>(new Set());
  const [said, setSaid] = useState<Map<number, string>>(new Map());
  const [suggest, setSuggest] = useState<Map<number, string>>(new Map());
  const [batch, setBatch] = useState<{ n: number; of: number; name: string } | null>(null);
  const [reviewKey, setReviewKey] = useState(0);

  type Research = { outcome: "food" | "alias" | "not_found" | "not_food" | "failed_checks" | "error"; reason?: string; name?: string; kcal?: number; aliasOf?: string | null; problems?: string[]; ms?: number };
  async function research(row: FoodRequestRow) {
    setRunning((s) => new Set(s).add(row.id));
    const r = await adminFetch<Research>("/api/admin/research", { method: "POST", body: { requestId: row.id } });
    setRunning((s) => {
      const n = new Set(s);
      n.delete(row.id);
      return n;
    });
    if (!r.ok) {
      setSaid((m) => new Map(m).set(row.id, r.reason === "failed" ? "Couldn't run it (daily limit, or the server timed out). Try again." : failText(r.reason)));
      return;
    }
    const d = r.data;
    const next: Partial<Record<Research["outcome"], FoodRequestStatus>> = { food: "researching", not_found: "not_found", not_food: "junk" };
    if (next[d.outcome]) setChanged((m) => new Map(m).set(row.id, next[d.outcome]!));
    if (d.outcome === "alias" && d.aliasOf) setSuggest((m) => new Map(m).set(row.id, d.aliasOf!));
    const text =
      d.outcome === "food" ? `Found: ${d.name} (${nf(d.kcal)} kcal / 100 g). Waiting for your check above.`
      : d.outcome === "alias" ? (d.name ? `Looks like ${d.name}: confirm with “Same as”.` : d.reason ?? "")
      : d.outcome === "not_found" ? `No allowed source: ${d.reason}`
      : d.outcome === "not_food" ? `Not a food: ${d.reason}`
      : d.outcome === "failed_checks" ? `Found a source, but it failed the checks: ${d.problems?.[0] ?? ""}`
      : `Research failed: ${d.reason ?? ""}`;
    setSaid((m) => new Map(m).set(row.id, text));
    invalidateAdmin("/api/admin/food");
    if (d.outcome === "food") setReviewKey((k) => k + 1);
    useUI.getState().showToast(`${row.name}: ${text.split(":")[0]}`);
  }

  async function researchTop(list: FoodRequestRow[]) {
    for (let i = 0; i < list.length; i++) {
      setBatch({ n: i + 1, of: list.length, name: list[i].name });
      await research(list[i]);
    }
    setBatch(null);
    reload();
  }

  async function set(row: FoodRequestRow, status: "new" | "alias" | "junk", foodId?: string) {
    setBusy(row.id);
    const r = await adminFetch<{ ok: boolean }>("/api/admin/food-requests", { method: "POST", body: { id: row.id, status, foodId } });
    setBusy(null);
    if (!r.ok) return useUI.getState().showToast(failText(r.reason));
    setChanged((m) => new Map(m).set(row.id, status));
    invalidateAdmin("/api/admin/food-requests");
    useUI.getState().showToast(
      status === "alias" ? `“${row.name}” marked as another name for ${getFood(foodId!)?.name ?? foodId}` : status === "junk" ? `Dismissed “${row.name}”` : `Reopened “${row.name}”`,
    );
  }

  if (error) return <ErrorState reason={error} onRetry={reload} />;
  if (!data) return <PanelSkeleton panels={1} />;
  const c = data.counts;
  const visible = (s: FoodRequestStatus) =>
    filter === "all" ? true : filter === "open" ? s === "new" || s === "researching" : filter === "junk" ? s === "junk" : s === "alias" || s === "found" || s === "not_found";
  const rows = data.rows
    .map((r) => ({ ...r, status: changed.get(r.id) ?? r.status, foodId: suggest.get(r.id) ?? r.foodId }))
    .filter((r) => visible(r.status));
  const next5 = rows.filter((r) => r.status === "new" && !r.foodId && !running.has(r.id)).slice(0, 5);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Open requests" value={nf(c.open)} tone="turmeric" icon={<PackageSearch size={18} />} sub={<span>foods to find or rename</span>} />
        <Stat label="People asking" value={nf(c.people)} tone="saffron" icon={<UsersRound size={18} />} delay={0.04} sub={<span>behind the open ones</span>} />
        <Stat label="Done" value={nf(c.done)} tone="leaf" icon={<CheckCheck size={18} />} delay={0.08} sub={<span>aliases, added, no source</span>} />
        <Stat label="Dismissed" value={nf(c.junk)} tone="muted" icon={<Ban size={18} />} delay={0.12} sub={<span>not a food, test, abuse</span>} />
      </div>

      <FoodReview key={reviewKey} />

      <Panel
        title="Most wanted"
        icon={<PackageSearch size={14} className="text-turmeric" />}
        hint="Asked = tapped “Request it” (counts most). Searched = closed a search that found nothing. AI = said it, nothing matched. Made own = created it as a custom food. People are counted once per signal."
      >
        <div className="-mt-1 mb-3 flex flex-wrap items-center justify-between gap-2">
          <Segmented id="req-filter" value={filter} options={FILTERS} onChange={setFilter} />
          {batch ? (
            <span className="flex items-center gap-2 text-xs font-semibold text-sky">
              <Loader2 size={14} className="animate-spin" /> Researching {batch.n} of {batch.of}: {batch.name}…
            </span>
          ) : next5.length > 0 ? (
            <button onClick={() => void researchTop(next5)} className="flex h-8 items-center gap-1.5 rounded-full bg-cream px-3.5 text-xs font-bold text-bg">
              <Sparkles size={13} /> Research top {next5.length}
            </button>
          ) : null}
        </div>
        {rows.length ? (
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <RequestItem key={r.id} row={r} rank={i + 1} busy={busy === r.id} running={running.has(r.id)} said={said.get(r.id)}
                  stuck={r.status === "researching" && !!review.data && !inReview.has(r.id) && !running.has(r.id) && !changed.has(r.id)}
                  onSet={(s, food) => void set(r, s, food)} onResearch={batch ? undefined : () => void research(r)} />
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <Empty
            icon={<PackageSearch size={22} />}
            text={filter === "open" ? "Nothing waiting. When members can't find a food, it shows up here." : "Nothing here in this period."}
          />
        )}
        <p className="mt-4 border-t border-line pt-3 text-xs text-faint">
          Research (~30–90 s a food): the AI names a source (INDB, IFCT, USDA, the brand&apos;s label or a recipe of sourced parts), the server reads the numbers and checks them, and the food waits for you above. “Same as” names are live in everyone&apos;s search within minutes.
        </p>
      </Panel>
    </div>
  );
}

function RequestItem({ row, rank, busy, running, said, stuck, onSet, onResearch }: {
  row: FoodRequestRow; rank: number; busy: boolean; running: boolean; said?: string;
  /** "in review" but no candidate is waiting: a research run that didn't finish */
  stuck: boolean;
  onSet: (s: "new" | "alias" | "junk", foodId?: string) => void; onResearch?: () => void;
}) {
  const open = row.status === "new" || row.status === "researching";
  const canResearch = row.status === "new" || row.status === "not_found" || stuck;
  // the closest catalog food, computed here on the device with the app's own matcher
  const guess = useMemo(() => {
    if (row.status !== "new") return null; // in review: its candidate is waiting above
    const top = matchFood(row.name, 1)[0];
    return top && top.score >= HINT_SCORE ? top : null;
  }, [row.name, row.status]);
  // on an open request, food_id is the AI's "same as" suggestion; once alias / found, it's the answer
  const linked = row.foodId ? getFood(row.foodId) : null;
  const aliasOf = open ? null : linked;
  const suggestion = open && row.status === "new" ? linked : null;
  const st = STATUS[row.status];
  const [who, setWho] = useState(false);
  const signals = [
    ["asked", row.asked],
    ["searched", row.searched],
    ["AI", row.ai],
    ["made own", row.custom],
  ].filter(([, n]) => (n as number) > 0);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="flex flex-col gap-3 overflow-hidden py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-xs font-bold text-muted tabular">{rank}</span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold">{row.name}</span>
            {row.status !== "new" && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            <button onClick={() => setWho(!who)} aria-expanded={who} className="inline-flex items-center gap-1 rounded-full hover:text-text" title="See who asked">
              <b className="font-semibold text-text tabular">{nf(row.people)}</b> {row.people === 1 ? "person" : "people"}
              <ChevronDown size={12} className={`transition-transform ${who ? "rotate-180" : ""}`} />
            </button>
            {signals.map(([label, n]) => <span key={label as string}> · {label} {nf(n as number)}</span>)}
            <span className="text-faint"> · {ago(row.lastSeen)}</span>
          </p>
          <AnimatePresence initial={false}>
            {who && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <People id={row.id} />
              </motion.div>
            )}
          </AnimatePresence>
          {aliasOf && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-leaf">
              <Link2 size={12} /> another name for <FoodIcon cat={aliasOf.cat} size={18} /> <b className="font-semibold">{aliasOf.name}</b>
            </div>
          )}
          {suggestion && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-sky">
              <Sparkles size={12} /> AI: same as <FoodIcon cat={suggestion.cat} size={18} /> <b className="font-semibold">{suggestion.name}</b>
            </div>
          )}
          {row.reason && !said && <p className="mt-1 text-xs text-faint">“{row.reason}”</p>}
          {said && <p className="mt-1 text-xs font-medium text-sky">{said}</p>}
          {guess && !suggestion && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              {guess.score >= ALIAS_SCORE ? "Looks like" : "Closest in the catalog:"} <FoodIcon cat={guess.item.cat} size={18} /> <b className="font-semibold text-text">{guess.item.name}</b>
              <span className="text-faint tabular">({Math.round(guess.score * 100)}% match)</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-11 sm:pl-0">
        {running ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-sky"><Loader2 size={14} className="animate-spin" /> Researching… ~1 min</span>
        ) : busy ? (
          <Loader2 size={16} className="animate-spin text-muted" />
        ) : open || row.status === "not_found" ? (
          <>
            {suggestion && (
              <button onClick={() => onSet("alias", suggestion.id)} className="flex h-8 items-center gap-1.5 rounded-full bg-cream px-3 text-xs font-bold text-bg">
                <Link2 size={13} /> Same as {suggestion.name.length > 18 ? "this" : suggestion.name}
              </button>
            )}
            {canResearch && onResearch && !suggestion && (
              <button onClick={onResearch} className="flex h-8 items-center gap-1.5 rounded-full border border-sky/40 bg-sky/10 px-3 text-xs font-bold text-sky hover:bg-sky/20">
                <Sparkles size={13} /> {row.status === "new" ? "Research" : "Research again"}
              </button>
            )}
            {!suggestion && guess && guess.score >= ALIAS_SCORE && (
              <button onClick={() => onSet("alias", guess.item.id)} className="flex h-8 items-center gap-1.5 rounded-full bg-cream px-3 text-xs font-bold text-bg">
                <Link2 size={13} /> Same as {guess.item.name.length > 18 ? "this" : guess.item.name}
              </button>
            )}
            {(row.status === "new" || stuck) && (
              <button onClick={() => onSet("junk")} className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-muted hover:text-text">
                <Ban size={13} /> Dismiss
              </button>
            )}
          </>
        ) : row.status !== "found" ? (
          <button onClick={() => onSet("new")} className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-muted hover:text-text">
            <Undo2 size={13} /> Reopen
          </button>
        ) : null}
      </div>
    </motion.li>
  );
}

const VIA: Record<FoodRequestPerson["signals"][number]["via"], string> = { request: "asked", search: "searched", ai: "AI", custom: "made own" };

/** Who asked for this food, how and when (loaded on open; each open is written to the admin access log). */
function People({ id }: { id: number }) {
  const { data, error, loading, reload } = useAdminQuery<{ people: FoodRequestPerson[] }>(`/api/admin/food-requests?people=${id}`);
  if (error) return <div className="mt-2"><ErrorState reason={error} onRetry={reload} /></div>;
  if (loading || !data) return <div className="mt-2 space-y-1.5"><div className="skeleton h-10" /><div className="skeleton h-10" /></div>;
  if (!data.people.length) return <p className="mt-2 text-xs text-faint">Nobody on record (the account may have been deleted).</p>;
  return (
    <ul className="mt-2 space-y-1.5">
      {data.people.map((p) => {
        const name = p.name ?? p.email ?? "Unknown";
        return (
          <li key={p.user}>
            <Link href={`/admin/u/${p.user}`} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-2.5 py-2 transition-colors hover:bg-surface-3">
              <UserAvatar url={p.avatar} name={name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-text">
                  {name}{p.handle && <span className="font-normal text-faint"> @{p.handle}</span>}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {p.email && p.name ? `${p.email} · ` : ""}
                  {p.signals.map((s) => `${VIA[s.via]}${s.times > 1 ? ` ×${s.times}` : ""}`).join(", ")}
                  {" · "}first {shortDay(dayKey(new Date(p.firstAt)))}{dayKey(new Date(p.lastAt)) !== dayKey(new Date(p.firstAt)) ? `, last ${ago(p.lastAt)}` : ""}
                </span>
              </span>
              {p.asked && <span className="shrink-0 rounded-full bg-turmeric/15 px-2 py-0.5 text-[10px] font-bold text-turmeric">asked</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
