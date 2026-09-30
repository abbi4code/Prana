"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, CircleCheck, CircleX, ExternalLink, Globe2, ImageOff, Loader2, OctagonAlert, RotateCcw, ScanText, ShieldCheck, TriangleAlert, Undo2, UsersRound, X } from "lucide-react";
import { FoodIcon } from "@/components/FoodIcon";
import { adminFetch, failText, invalidateAdmin, useAdminQuery } from "@/lib/admin/api";
import type { FoodCandidate, FoodReview as Review, LabelCheck, SharedFoodRow, StoredLabel } from "@/lib/admin/types";
import { CATEGORY_LABEL } from "@/lib/foods";
import { refreshSharedFoods } from "@/lib/sharedFoods";
import { useUI } from "@/lib/store";
import { Empty, ErrorState, Panel, Segmented, ago, nf } from "./ui";

// D54 phases 2–4 (.claude/food-requests.md): candidates wait here for the owner's check; Approve makes a food live for
// everyone (shared_foods), Retract takes it back. The server re-checks every food before it goes live. A food from an
// official label shows the label image beside its numbers (a vision model's reading, ✓ / ≠ per value) and needs the
// owner's tick before Approve.

type Status = "pending" | "approved" | "rejected";
const STATUSES: { v: Status; label: string }[] = [
  { v: "pending", label: "Waiting" },
  { v: "approved", label: "Approved" },
  { v: "rejected", label: "Rejected" },
];
const CONF: Record<string, string> = { high: "bg-leaf/15 text-leaf", medium: "bg-turmeric/15 text-turmeric", low: "bg-chilli/15 text-chilli" };
const SOURCE: Record<string, string> = { INDB: "INDB 2024", IFCT2017: "IFCT 2017", USDA: "USDA FoodData Central", DERIVED: "Recipe from sourced ingredients", MFR_LABEL: "Official label" };

const toast = (t: string) => useUI.getState().showToast(t);

export function FoodReview() {
  const [status, setStatus] = useState<Status>("pending");
  const path = `/api/admin/food-review?status=${status}`;
  const { data, error, reload } = useAdminQuery<Review>(path);
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<number>>(new Set()); // decided in this view
  const [liveNow, setLiveNow] = useState<Map<string, boolean>>(new Map()); // retracted / restored in this view

  async function decide(c: FoodCandidate, decision: "approve" | "reject", reason?: string, labelChecked?: boolean) {
    setBusy(`c${c.id}`);
    const r = await adminFetch<{ ok: boolean }>("/api/admin/food-review", { method: "POST", body: { kind: "candidate", id: c.id, decision, reason, labelChecked } });
    setBusy(null);
    if (!r.ok) return toast(r.reason === "failed" ? "Couldn't do that. Reload: it may have been decided already, or fail the checks." : failText(r.reason));
    setGone((s) => new Set(s).add(c.id));
    invalidateAdmin("/api/admin/food");
    if (decision === "approve") void refreshSharedFoods(true);
    toast(decision === "approve" ? `${c.data.name} is live for everyone` : `Rejected ${c.data.name}`);
  }

  async function setLive(s: SharedFoodRow, live: boolean) {
    setBusy(`s${s.id}`);
    const r = await adminFetch<{ ok: boolean }>("/api/admin/food-review", { method: "POST", body: { kind: "shared", id: s.id, live } });
    setBusy(null);
    if (!r.ok) return toast(failText(r.reason));
    setLiveNow((m) => new Map(m).set(s.id, live));
    invalidateAdmin("/api/admin/food");
    void refreshSharedFoods(true);
    toast(live ? `${s.data.name} is back for everyone` : `${s.data.name} retracted: devices drop it on their next check`);
  }

  if (error) return <ErrorState reason={error} onRetry={reload} />;
  const candidates = (data?.candidates ?? []).filter((c) => !gone.has(c.id));
  const shared = data?.shared ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:gap-6">
      <Panel
        title="Waiting for your check"
        icon={<ShieldCheck size={14} className="text-leaf" />}
        className="lg:col-span-3"
        hint="Numbers come from the source named on each card, re-read by the checker, never from the AI. Approve = live in everyone's search, no deploy."
      >
        <div className="-mt-1 mb-3">
          <Segmented id="review-status" value={status} options={STATUSES} onChange={setStatus} />
        </div>
        {!data ? (
          <div className="skeleton h-48" />
        ) : candidates.length ? (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {candidates.map((c) => (
                <CandidateCard key={c.id} c={c} busy={busy === `c${c.id}`} onDecide={(d, reason, checked) => void decide(c, d, reason, checked)} />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Empty icon={<ShieldCheck size={22} />} text={status === "pending" ? "Nothing to check. Researched foods land here (phase 3)." : "None yet."} />
        )}
      </Panel>

      <Panel title="Added for everyone" icon={<Globe2 size={14} className="text-sky" />} className="lg:col-span-2"
        hint="Shared foods every device downloads. Retract hides one from search; old logs keep their numbers.">
        {!data ? (
          <div className="skeleton h-48" />
        ) : shared.length ? (
          <ul className="divide-y divide-line">
            {shared.map((s) => {
              const retracted = !(liveNow.get(s.id) ?? !s.retracted);
              return (
                <li key={s.id} className={`flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 ${retracted ? "opacity-60" : ""}`}>
                  <FoodIcon cat={s.data.cat} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.data.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {nf(s.data.kcal)} kcal / 100 g · {retracted ? "retracted" : `approved ${ago(s.approvedAt)}`}
                      {s.requestName ? ` · asked as “${s.requestName}”` : ""}
                    </span>
                  </span>
                  {busy === `s${s.id}` ? (
                    <Loader2 size={15} className="animate-spin text-muted" />
                  ) : (
                    <button onClick={() => void setLive(s, retracted)} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-muted hover:text-text">
                      {retracted ? <><RotateCcw size={13} /> Restore</> : <><Undo2 size={13} /> Retract</>}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon={<Globe2 size={22} />} text="No shared foods yet." />
        )}
      </Panel>
    </div>
  );
}

function CandidateCard({ c: initial, busy, onDecide }: { c: FoodCandidate; busy: boolean; onDecide: (d: "approve" | "reject", reason?: string, labelChecked?: boolean) => void }) {
  // the card's own copy: reading a label or taking its numbers updates it without reloading the list
  const [c, setC] = useState(initial);
  const [checked, setChecked] = useState(false);
  const f = c.data;
  const isLabel = (c.source?.id ?? f.src) === "MFR_LABEL";
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const du = f.units.find((u) => u.id === f.du) ?? f.units[0];
  const blocked = c.problems.length > 0;
  const needsTick = isLabel && !checked;
  const src = c.source ?? {};

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="overflow-hidden rounded-2xl border border-line-strong bg-surface-2/60 p-4"
    >
      <div className="flex items-start gap-3">
        <FoodIcon cat={f.cat} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-lg font-semibold leading-tight">{f.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CONF[f.conf] ?? CONF.medium}`}>{f.conf}</span>
            {c.live && c.status === "approved" && <span className="rounded-full bg-sky/15 px-2 py-0.5 text-[11px] font-bold text-sky">live</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {f.hi ? <span>{f.hi} · </span> : null}{CATEGORY_LABEL[f.cat]} · {f.diet.replace("_", "-")} · <code className="text-faint">{f.id}</code>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-semibold leading-none tabular">{nf(f.kcal)}</p>
          <p className="text-[11px] text-muted">kcal / 100 {f.cat === "alcohol" || f.cat === "beverage" ? "ml" : "g"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        {f.p != null ? (
          [["Protein", f.p, "text-chilli"], ["Carbs", f.c, "text-turmeric"], ["Fat", f.f, "text-saffron"]].map(([l, v, cls]) => (
            <span key={l as string} className="rounded-full bg-surface px-2.5 py-1 tabular">
              <span className={cls as string}>{l}</span> {nf(v as number, 1)} g
            </span>
          ))
        ) : (
          <span className="rounded-full bg-surface px-2.5 py-1 text-muted">macros unknown (failed the macro check)</span>
        )}
        {f.alc ? <span className="rounded-full bg-surface px-2.5 py-1 tabular">alcohol {nf(f.alc, 1)} g</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {f.units.filter((u) => u.kind !== "g").map((u) => (
          <span key={u.id} className={`rounded-lg border px-2 py-1 text-xs ${u.id === du.id ? "border-turmeric/50 bg-turmeric/10" : "border-line"}`}>
            <b className="font-semibold">{u.label}</b> <span className="text-muted tabular">· {nf(u.g)} g · {nf(Math.round((f.kcal * u.g) / 100))} kcal</span>
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-1 text-xs">
        <p className="flex flex-wrap items-center gap-1.5 text-muted">
          <span className="font-semibold text-text">{SOURCE[src.id ?? f.src] ?? src.id ?? f.src}</span>
          {src.ref && <span className="tabular">{src.ref}</span>}
          {src.row_name && <span className="text-faint">“{src.row_name}”</span>}
          {src.url && (
            <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-sky hover:underline">
              open <ExternalLink size={11} />
            </a>
          )}
          {src.image_url && (
            <a href={src.image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-sky hover:underline">
              label image <ExternalLink size={11} />
            </a>
          )}
        </p>
        {c.request && (
          <p className="flex items-center gap-1.5 text-muted">
            <UsersRound size={12} /> asked as “{c.request.name}” by {nf(c.request.people)} {c.request.people === 1 ? "person" : "people"}
          </p>
        )}
        {c.labelNotes?.map((w) => (
          <p key={w} className="flex items-start gap-1.5 text-muted"><ScanText size={12} className="mt-0.5 shrink-0" /> {w}</p>
        ))}
        {c.warnings.map((w) => (
          <p key={w} className="flex items-start gap-1.5 text-turmeric"><TriangleAlert size={12} className="mt-0.5 shrink-0" /> {w}</p>
        ))}
        {c.problems.map((p) => (
          <p key={p} className="flex items-start gap-1.5 font-semibold text-chilli"><OctagonAlert size={12} className="mt-0.5 shrink-0" /> {p}</p>
        ))}
        {c.status !== "pending" && (
          <p className="text-faint">{c.status} {ago(c.decidedAt)}{c.decidedBy ? ` by ${c.decidedBy}` : ""}{c.reason ? `: “${c.reason}”` : ""}</p>
        )}
      </div>

      {isLabel && (
        <LabelPanel c={c} editable={c.status === "pending" && !busy} onChange={(patch) => { setC((x) => ({ ...x, ...patch })); setChecked(false); }} />
      )}

      {c.status === "pending" && isLabel && !blocked && (
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-xs">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-leaf)]" />
          <span><b className="font-semibold">I checked these numbers against the label.</b> <span className="text-muted">Label values are copied by an AI, so they go live only with your tick.</span></span>
        </label>
      )}

      {c.status === "pending" && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {busy ? (
            <Loader2 size={16} className="animate-spin text-muted" />
          ) : rejecting ? (
            <>
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="Why? (wrong row, portion off…)"
                className="h-9 min-w-0 flex-1 rounded-full border border-line-strong bg-bg/60 px-3.5 text-sm outline-none focus:border-chilli/60"
                onKeyDown={(e) => e.key === "Enter" && onDecide("reject", reason)}
              />
              <button onClick={() => onDecide("reject", reason)} className="flex h-9 items-center gap-1.5 rounded-full bg-chilli px-3.5 text-xs font-bold text-bg">
                <X size={14} /> Reject
              </button>
              <button onClick={() => setRejecting(false)} className="h-9 px-2 text-xs font-semibold text-muted hover:text-text">Cancel</button>
            </>
          ) : (
            <>
              <button
                onClick={() => onDecide("approve", undefined, isLabel ? checked : undefined)}
                disabled={blocked || needsTick}
                title={blocked ? "Fix the problems above first" : needsTick ? "Tick “I checked these numbers against the label” first" : undefined}
                className="flex h-9 items-center gap-1.5 rounded-full bg-leaf px-4 text-xs font-bold text-bg disabled:cursor-not-allowed disabled:opacity-40"
              >
                {blocked ? <><OctagonAlert size={14} /> Fails the check</> : <><Check size={14} strokeWidth={2.6} /> Approve for everyone</>}
              </button>
              <button onClick={() => setRejecting(true)} className="flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-xs font-semibold text-muted hover:text-text">
                <X size={14} /> Reject
              </button>
            </>
          )}
        </div>
      )}
    </motion.article>
  );
}

const FIELD: Record<LabelCheck["field"], [string, string]> = { kcal: ["Energy", "kcal"], p: ["Protein", "g"], c: ["Carbs", "g"], f: ["Fat", "g"], fib: ["Fibre", "g"] };

/** A photo from the device → a JPEG data URL, longest side ≤ 1600 px (EXIF, incl. location, dropped by the redraw). */
async function photoToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

type LabelPatch = Partial<Pick<FoodCandidate, "label" | "labelChecks" | "labelNotes" | "problems" | "data" | "source">>;

/** The label image next to the numbers: what the reader copied, ✓ / ≠ per value, read another image, take its numbers. */
function LabelPanel({ c, editable, onChange }: { c: FoodCandidate; editable: boolean; onChange: (p: LabelPatch) => void }) {
  const label = c.label;
  const [url, setUrl] = useState(c.source?.image_url ?? (label?.image.startsWith("https://") ? label.image : ""));
  const [busy, setBusy] = useState<"read" | "use" | null>(null);
  const [zoom, setZoom] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const differs = c.labelChecks?.some((x) => x.same === false) ?? false;

  async function read(image: string) {
    setBusy("read");
    const r = await adminFetch<{ label: StoredLabel; problems: string[]; labelNotes: string[]; labelChecks: LabelCheck[] | null }>("/api/admin/food-review", { method: "POST", body: { kind: "label", id: c.id, image } });
    setBusy(null);
    if (!r.ok) return toast(r.reason === "failed" ? "Couldn't read that image. Is it a public https link or a photo under 4 MB?" : failText(r.reason));
    const { label: l, problems, labelNotes, labelChecks } = r.data;
    onChange({ label: l, problems, labelNotes, labelChecks, ...(image.startsWith("https://") && l.reading?.is_nutrition_label ? { source: { ...c.source, image_url: image } } : {}) });
    toast(l.reading?.is_nutrition_label ? (labelChecks?.some((x) => x.same === false) ? "Read. Some numbers differ from the label" : "Read. The numbers match the label") : "That image isn't a nutrition panel");
  }

  async function upload(f: File | undefined) {
    if (!f) return;
    try {
      await read(await photoToDataUrl(f));
    } catch {
      toast("Couldn't open that photo");
    }
  }

  async function takeLabel() {
    setBusy("use");
    const r = await adminFetch<{ data: FoodCandidate["data"]; problems: string[]; labelNotes: string[]; labelChecks: LabelCheck[] | null }>("/api/admin/food-review", { method: "POST", body: { kind: "use_label", id: c.id } });
    setBusy(null);
    if (!r.ok) return toast(r.reason === "failed" ? "The label's numbers don't pass the checks (macros vs energy). Check the image." : failText(r.reason));
    onChange({ data: r.data.data, problems: r.data.problems, labelNotes: r.data.labelNotes, labelChecks: r.data.labelChecks });
    toast("Took the label's numbers");
  }

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface/60 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
        {label?.image ? (
          <button onClick={() => setZoom(true)} className="group relative overflow-hidden rounded-xl border border-line bg-bg" aria-label="Open the label image">
            {/* eslint-disable-next-line @next/next/no-img-element -- a brand's label image or an uploaded photo, shown as is */}
            <img src={label.image} alt="Nutrition label" referrerPolicy="no-referrer" className="h-44 w-full object-contain transition-transform group-hover:scale-[1.03] sm:h-full sm:max-h-56" />
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-bg/80 px-2 py-0.5 text-[10px] font-semibold text-muted">tap to zoom</span>
          </button>
        ) : (
          <div className="grid h-32 place-items-center rounded-xl border border-dashed border-line-strong text-center text-xs text-faint sm:h-full">
            <span><ImageOff size={18} className="mx-auto mb-1" />No label image read</span>
          </div>
        )}

        <div className="min-w-0">
          {c.labelChecks ? (
            <table className="w-full text-xs tabular">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-faint">
                  <th className="pb-1 font-bold">per 100 {c.data.cat === "beverage" || c.data.cat === "alcohol" ? "ml" : "g"}</th>
                  <th className="pb-1 text-right font-bold">Label</th>
                  <th className="pb-1 text-right font-bold">This food</th>
                  <th className="w-6 pb-1" />
                </tr>
              </thead>
              <tbody>
                {c.labelChecks.map((x) => (
                  <tr key={x.field} className={`border-t border-line ${x.same === false ? "bg-chilli/10" : ""}`}>
                    <td className="py-1 pr-2 text-muted">{FIELD[x.field][0]} <span className="text-faint">{FIELD[x.field][1]}</span></td>
                    <td className="py-1 text-right font-semibold">{x.label ?? "–"}</td>
                    <td className="py-1 text-right">{x.food ?? "–"}</td>
                    <td className="py-1 pl-2">
                      {x.same === true ? <CircleCheck size={14} className="text-leaf" /> : x.same === false ? <CircleX size={14} className="text-chilli" /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted">{label ? "Nothing to compare yet." : "Paste the link to the nutrition panel image, or upload a photo of the pack's back, and press Read."}</p>
          )}
          {label?.reading && (
            <p className="mt-2 text-[11px] leading-snug text-faint">
              Read by {label.model} {ago(label.read_at)}{label.per100 ? ` · ${label.per100.basis}` : ""}
              {label.reading.columns.length ? ` · columns: ${label.reading.columns.join(" · ")}` : ""}
              {label.reading.serving.text ? ` · ${label.reading.serving.text}` : ""}
            </p>
          )}
        </div>
      </div>

      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… link to the nutrition panel image"
            className="h-8 min-w-0 flex-1 basis-56 rounded-full border border-line-strong bg-bg/60 px-3 text-xs outline-none focus:border-sky/60"
          />
          <button onClick={() => void read(url.trim())} disabled={!!busy || !/^https:\/\//.test(url.trim())}
            className="flex h-8 items-center gap-1.5 rounded-full border border-sky/40 bg-sky/10 px-3 text-xs font-bold text-sky disabled:opacity-40">
            {busy === "read" ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />} Read
          </button>
          <button onClick={() => file.current?.click()} disabled={!!busy}
            className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-muted hover:text-text disabled:opacity-40">
            <Camera size={13} /> Photo
          </button>
          <input ref={file} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          {differs && (
            <button onClick={() => void takeLabel()} disabled={!!busy} className="flex h-8 items-center gap-1.5 rounded-full bg-cream px-3 text-xs font-bold text-bg disabled:opacity-40">
              {busy === "use" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Use the label&apos;s numbers
            </button>
          )}
        </div>
      )}

      <AnimatePresence>{zoom && label?.image && <Zoom src={label.image} onClose={() => setZoom(false)} />}</AnimatePresence>
    </div>
  );
}

function Zoom({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      className="fixed inset-0 z-[100] grid cursor-zoom-out place-items-center bg-black/85 p-4" role="dialog" aria-label="Label image">
      <motion.img initial={{ scale: 0.94 }} animate={{ scale: 1 }} src={src} alt="Nutrition label" referrerPolicy="no-referrer" className="max-h-[92vh] max-w-[94vw] rounded-xl object-contain" />
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-white"><X size={18} /></button>
    </motion.div>
  );
}
