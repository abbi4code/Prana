"use client";

import { useMemo, useState } from "react";
import { Drawer } from "vaul";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Check, CornerDownLeft, Flame, LoaderCircle, Mic, Pencil, Plus, Search, Sparkles, X } from "lucide-react";
import { useSpeech } from "@/lib/nl/useSpeech";
import { useAuth } from "@/lib/auth";
import { parseSentence } from "@/lib/nl/client";
import type { ParsedLog } from "@/lib/nl/schema";
import { ThaliBuilder } from "@/components/thali/ThaliBuilder";
import { ThaliPlate } from "@/components/thali/ThaliPlate";
import { mealKcal } from "@/lib/thali";
import { FoodIcon } from "@/components/FoodIcon";
import { STARTER_IDS, getFood, searchFoods } from "@/lib/foods";
import { addDays, dayKey } from "@/lib/dates";
import { MEALS } from "@/lib/nutrition";
import { useStore, useUI } from "@/lib/store";
import { useIsDesktop } from "@/lib/useMediaQuery";
import type { Food, LogSource, Meal, SavedMeal } from "@/lib/types";
import { ConfirmParse } from "./ConfirmParse";
import { CreateFood } from "./CreateFood";
import { FoodDetail } from "./FoodDetail";

export function LogSheet() {
  const sheet = useUI((s) => s.sheet);
  const close = useUI((s) => s.close);
  const desktop = useIsDesktop();

  // phone: bottom sheet; desktop: panel sliding in from the right
  return (
    <Drawer.Root
      key={desktop ? "side" : "bottom"}
      open={!!sheet}
      onOpenChange={(o) => !o && close()}
      direction={desktop ? "right" : "bottom"}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]" />
        <Drawer.Content
          className={`fixed z-50 flex flex-col border-line-strong bg-surface outline-none after:hidden ${
            desktop
              ? "inset-y-3 right-3 w-[460px] rounded-[2rem] border pt-5 shadow-2xl shadow-black/60"
              : "inset-x-0 bottom-0 mx-auto h-[92dvh] max-w-md rounded-t-[2rem] border-t"
          }`}
          style={desktop ? ({ "--initial-transform": "calc(100% + 12px)" } as React.CSSProperties) : undefined}
        >
          {!desktop && <div className="mx-auto mb-2 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />}
          {sheet?.mode === "add" && <AddFlow key="add" meal={sheet.meal} />}
          {sheet?.mode === "edit" && <EditFlow key={sheet.entryId} entryId={sheet.entryId} />}
          {sheet?.mode === "thali" && <ThaliFlow key={sheet.thaliId ?? "new"} slot={sheet.slot} thaliId={sheet.thaliId} prefill={sheet.prefill} />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function AddFlow({ meal: initialMeal }: { meal: Meal }) {
  const date = useUI((s) => s.date) ?? dayKey();
  const close = useUI((s) => s.close);
  const addEntry = useStore((s) => s.addEntry);
  const entries = useStore((s) => s.entries);
  const desktop = useIsDesktop();

  const [meal, setMeal] = useState(initialMeal);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [building, setBuilding] = useState<{ thaliId?: string } | null>(null);
  // natural-language logging (nl-logging.md): parsing → confirm card
  const signedIn = useAuth((s) => s.status === "signedIn");
  const [nlBusy, setNlBusy] = useState(false);
  const [draft, setDraft] = useState<{ text: string; source: Exclude<LogSource, "manual">; parsed: ParsedLog } | null>(null);
  const removeEntry = useStore((s) => s.removeEntry);
  const [added, setAdded] = useState<{ name: string; kcal: number }[]>([]);
  const savedMeals = useStore((s) => s.savedMeals);
  const logSavedMeal = useStore((s) => s.logSavedMeal);
  const showToast = useUI((s) => s.showToast);

  const logThali = (m: SavedMeal) => {
    const ids = logSavedMeal(m.id, meal, date);
    ids.forEach((id) => useUI.getState().markFresh(id));
    setAdded((a) => [...a, { name: m.name, kcal: mealKcal(m) }]);
    navigator.vibrate?.(12);
  };

  // recents: last distinct foods; frequent: most logged in the last 30 days
  const { recent, frequent } = useMemo(() => {
    const since = addDays(date, -30);
    const counts = new Map<string, number>();
    const lastUnit = new Map<string, { unitId: string; qty: number }>();
    const recentIds: string[] = [];
    for (const e of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!recentIds.includes(e.foodId)) recentIds.push(e.foodId);
      if (!lastUnit.has(e.foodId)) lastUnit.set(e.foodId, { unitId: e.unitId, qty: e.qty });
      if (e.date >= since) counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1);
    }
    const freq = [...counts.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const pick = (ids: string[]) => ids.map(getFood).filter(Boolean) as Food[];
    return {
      recent: pick(recentIds.slice(0, 8)).map((f) => ({ food: f, last: lastUnit.get(f.id) })),
      frequent: pick(freq.filter((id) => !recentIds.slice(0, 8).includes(id)).slice(0, 8)),
    };
  }, [entries, date]);

  const results = useMemo(() => searchFoods(query), [query]);
  const trimmed = query.trim();
  // a sentence (several words, or a number) is worth sending to the AI; single words use plain search
  const sentenceLike = trimmed.length >= 3 && (/\s/.test(trimmed) || /\d/.test(trimmed));

  // voice fills the same box; a finished sentence goes through the exact same pipeline as typing
  const speech = useSpeech({
    onInterim: setQuery,
    onFinal: (text) => {
      setQuery(text);
      if (signedIn) void understand(text, "voice");
    },
    onError: (msg) => showToast(msg),
  });

  const understand = async (text: string, source: Exclude<LogSource, "manual">) => {
    if (nlBusy || !text.trim()) return;
    setNlBusy(true);
    const out = await parseSentence(text.trim());
    setNlBusy(false);
    if (out.ok && out.data.items.length) return setDraft({ text: text.trim(), source, parsed: out.data });
    if (out.ok) return showToast("Didn't catch a food in that. Try “2 roti aur dal”.");
    if (out.reason === "rate_limited")
      return showToast(`AI logging limit reached. Try again in ${Math.max(1, Math.round((out.retryAfterS ?? 60) / 60))} min, or pick below.`);
    if (out.reason === "signed_out") return showToast("Sign in to log whole sentences.");
    showToast(out.reason === "offline" ? "You're offline. Pick from the list below." : "Couldn't read that. Pick from the list below.");
  };
  const lastFor = (id: string) => recent.find((r) => r.food.id === id)?.last;

  if (draft)
    return (
      <>
        <Drawer.Title className="sr-only">Check and log</Drawer.Title>
        <ConfirmParse
          text={draft.text}
          source={draft.source}
          parsed={draft.parsed}
          initialMeal={meal}
          date={date}
          onBack={() => setDraft(null)}
          onLogged={(ids, m) => {
            close();
            showToast(`Logged ${ids.length} item${ids.length === 1 ? "" : "s"} to ${MEALS.find((x) => x.id === m)!.label}`, {
              label: "Undo",
              run: () => ids.forEach((id) => removeEntry(id)),
            });
          }}
        />
      </>
    );

  if (building)
    return (
      <>
        <Drawer.Title className="sr-only">Thali</Drawer.Title>
        <ThaliBuilder
          thaliId={building.thaliId}
          slot={meal}
          onBack={() => setBuilding(null)}
          onSaved={(name) => {
            setBuilding(null);
            showToast(`Saved “${name}”`);
          }}
        />
      </>
    );

  if (creating !== null)
    return (
      <>
        <Drawer.Title className="sr-only">Create a food</Drawer.Title>
        <CreateFood
          initialName={creating}
          onBack={() => setCreating(null)}
          onCreated={(food) => {
            setCreating(null);
            setSelected(food);
          }}
        />
      </>
    );

  if (selected) {
    const last = lastFor(selected.id);
    return (
      <>
      <Drawer.Title className="sr-only">{selected.name}</Drawer.Title>
      <FoodDetail
        food={selected}
        initial={{ unitId: last?.unitId ?? selected.du, qty: last?.qty ?? 1, meal }}
        confirmLabel={(m) => `Add to ${m}`}
        onBack={() => setSelected(null)}
        onConfirm={(v) => {
          addEntry(selected.id, v.unitId, v.qty, v.meal, date);
          const e = useStore.getState().entries.at(-1);
          if (e) useUI.getState().markFresh(e.id);
          setAdded((a) => [...a, { name: selected.name, kcal: e?.kcal ?? 0 }]);
          setMeal(v.meal);
          setSelected(null);
          setQuery("");
          navigator.vibrate?.(12);
        }}
      />
      </>
    );
  }

  const showingSearch = query.trim().length > 0;
  const starter = STARTER_IDS.map(getFood).filter(Boolean) as Food[];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Drawer.Title className="sr-only">Log food</Drawer.Title>
      <div className="px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">Add food</h2>
          <button
            onClick={close}
            className={`rounded-full px-4 py-2 text-sm font-bold ${added.length ? "bg-leaf text-bg" : "text-muted"}`}
          >
            {added.length ? `Done · ${added.length}` : <X size={20} />}
          </button>
        </div>

        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {MEALS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMeal(m.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                meal === m.id ? "bg-cream text-bg" : "bg-surface-2 text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-line-strong bg-bg/60 px-4 py-3.5 focus-within:border-turmeric/60">
          <Search size={19} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={speech.listening ? "Listening… say what you ate" : signedIn ? "2 roti aur dal, or search a food" : "dal, roti, dahi, chai…"}
            className="w-full bg-transparent text-base outline-none placeholder:text-faint"
            autoComplete="off"
            autoFocus={desktop}
            enterKeyHint={signedIn && sentenceLike ? "go" : "search"}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (signedIn && sentenceLike) void understand(query, "text");
              else if (results[0]) setSelected(results[0]);
            }}
          />
          {query && !speech.listening && (
            <button onClick={() => setQuery("")} aria-label="Clear" className="text-muted">
              <X size={18} />
            </button>
          )}
          {speech.supported && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => (speech.listening ? speech.stop() : (setQuery(""), speech.start()))}
              aria-label={speech.listening ? "Stop listening" : "Speak what you ate"}
              aria-pressed={speech.listening}
              className={`relative grid size-9 shrink-0 place-items-center rounded-full transition-colors ${
                speech.listening ? "bg-chilli text-white" : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {speech.listening && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-chilli"
                  animate={{ scale: [1, 1.6], opacity: [0.45, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <Mic size={18} className="relative" />
            </motion.button>
          )}
        </label>

        <AnimatePresence>
          {added.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5"
            >
              {added.map((a, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-leaf/15 px-3 py-1 text-xs font-semibold text-leaf"
                >
                  <Check size={13} /> {a.name} · {a.kcal}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="no-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1.5rem+var(--safe-bottom))]">
        {showingSearch ? (
          <>
            {sentenceLike && (signedIn ? (
              <UnderstandRow text={trimmed} busy={nlBusy} desktop={desktop} onClick={() => void understand(query, "text")} />
            ) : (
              <Link href="/login" className="mb-2 mt-1 flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-muted hover:text-text">
                <Sparkles size={15} className="shrink-0 text-turmeric" />
                Sign in to log a whole meal in one sentence
              </Link>
            ))}
            {results.length > 0 && <FoodList foods={results} onPick={setSelected} />}
            {/* a sentence isn't a food name: skip "no match / create it" when the AI row is offered */}
            {!(signedIn && sentenceLike) && (
              <>
                {!results.length && (
                  <p className="px-2 pb-2 pt-8 text-center text-sm text-muted">No match for “{query}”. Try another name, or add it yourself:</p>
                )}
                <CreateRow label={`Create “${query.trim()}”`} onClick={() => setCreating(query.trim())} />
              </>
            )}
          </>
        ) : (
          <>
            <ThaliStrip meals={savedMeals} onLog={logThali} onEdit={(id) => setBuilding({ thaliId: id })} onNew={() => setBuilding({})} />
            {recent.length > 0 && <Section title="Recent" foods={recent.map((r) => r.food)} onPick={setSelected} />}
            {frequent.length > 0 && <Section title="You eat these often" foods={frequent} onPick={setSelected} />}
            {recent.length === 0 && <Section title="Popular" foods={starter} onPick={setSelected} />}
            <CreateRow label="Can't find a food? Create it" onClick={() => setCreating("")} />
          </>
        )}
      </div>
    </div>
  );
}

/** "My thalis": saved meals as cards; tap logs every item into the chosen meal. */
function ThaliStrip({ meals, onLog, onEdit, onNew }: { meals: SavedMeal[]; onLog: (m: SavedMeal) => void; onEdit: (id: string) => void; onNew: () => void }) {
  return (
    <div className="mt-3">
      <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">My thalis</p>
      <div className="no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1">
        {meals.map((m) => (
          <div key={m.id} className="relative shrink-0">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => onLog(m)}
              className="flex w-36 flex-col items-center rounded-3xl border border-line bg-surface-2 px-3 pb-3 pt-3 text-center transition-colors hover:border-turmeric/40"
            >
              <ThaliPlate items={m.items} size={88} badges={false} />
              <span className="mt-2 w-full truncate text-sm font-semibold">{m.name}</span>
              <span className="text-xs text-muted tabular">{mealKcal(m)} kcal · tap to log</span>
            </motion.button>
            <button
              onClick={() => onEdit(m.id)}
              aria-label={`Edit ${m.name}`}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-surface/90 text-muted shadow hover:text-text"
            >
              <Pencil size={13} />
            </button>
          </div>
        ))}
        <button
          onClick={onNew}
          className="flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line-strong px-3 py-6 text-center text-sm font-semibold text-muted transition-colors hover:border-turmeric/50 hover:text-text"
        >
          <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-turmeric"><Plus size={20} /></span>
          {meals.length ? "New thali" : "Save a meal you eat often"}
        </button>
      </div>
    </div>
  );
}

/** Thali builder opened from outside the add flow (e.g. "Save as thali" on a meal card). */
function ThaliFlow({ slot, thaliId, prefill }: { slot: Meal; thaliId?: string; prefill?: SavedMeal["items"] }) {
  const close = useUI((s) => s.close);
  const showToast = useUI((s) => s.showToast);
  return (
    <>
      <Drawer.Title className="sr-only">Thali</Drawer.Title>
      <ThaliBuilder
        thaliId={thaliId}
        prefill={prefill}
        slot={slot}
        onBack={close}
        onSaved={(name) => {
          close();
          showToast(`Saved “${name}”. Find it under My thalis.`);
        }}
      />
    </>
  );
}

/** "✨ Log “2 roti aur dal”": sends the sentence to the AI parser (signed-in users). */
function UnderstandRow({ text, busy, desktop, onClick }: { text: string; busy: boolean; desktop: boolean; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      disabled={busy}
      onClick={onClick}
      className="relative mb-2 mt-1 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-turmeric/40 bg-gradient-to-r from-turmeric/15 via-saffron/10 to-transparent px-3 py-3 text-left"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-turmeric to-saffron text-on-accent">
        {busy ? <LoaderCircle size={19} className="animate-spin" /> : <Sparkles size={19} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{busy ? "Reading your meal…" : `Log “${text}”`}</span>
        <span className="block text-xs text-muted">AI reads it, you confirm before anything is saved</span>
      </span>
      {desktop && !busy && (
        <kbd className="flex items-center gap-1 rounded-md border border-line-strong px-1.5 py-0.5 text-[11px] text-muted">
          <CornerDownLeft size={11} /> Enter
        </kbd>
      )}
      {busy && <span aria-hidden className="absolute inset-0 animate-pulse bg-turmeric/5" />}
    </motion.button>
  );
}

function CreateRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-3 py-3 text-left text-sm font-semibold text-muted transition-colors hover:border-turmeric/50 hover:text-text"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-turmeric">
        <Plus size={18} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function Section({ title, foods, onPick }: { title: string; foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <div className="mt-3">
      <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">{title}</p>
      <FoodList foods={foods} onPick={onPick} />
    </div>
  );
}

function FoodList({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  return (
    <ul>
      {foods.map((f) => {
        const u = f.units.find((x) => x.id === f.du)!;
        return (
          <li key={f.id}>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => onPick(f)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2 active:bg-surface-2"
            >
              <motion.div layoutId={`food-icon-${f.id}`} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
                <FoodIcon cat={f.cat} size={42} />
              </motion.div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{f.name}</span>
                  {f.uncooked && <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">Uncooked</span>}
                </p>
                <p className="truncate text-[13px] text-muted">
                  {u.label} {f.hi && <span className="text-faint">· {f.hi}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 text-right">
                {f.fried && <Flame size={13} className="text-saffron" />}
                <span className="font-display font-semibold tabular">{Math.round((f.kcal * u.g) / 100)}</span>
                <span className="text-xs text-muted">kcal</span>
              </div>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}

function EditFlow({ entryId }: { entryId: string }) {
  const entry = useStore((s) => s.entries.find((e) => e.id === entryId));
  const updateEntry = useStore((s) => s.updateEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const restoreEntry = useStore((s) => s.restoreEntry);
  const showToast = useUI((s) => s.showToast);
  const close = useUI((s) => s.close);
  const food = entry && getFood(entry.foodId);
  if (!entry || !food) return null;

  return (
    <>
      <Drawer.Title className="sr-only">Edit {entry.name}</Drawer.Title>
      <FoodDetail
        food={food}
        initial={{ unitId: entry.unitId, qty: entry.qty, meal: entry.meal }}
        confirmLabel={() => "Save"}
        onConfirm={(v) => {
          updateEntry(entry.id, v);
          close();
        }}
        onDelete={() => {
          removeEntry(entry.id);
          close();
          showToast(`Removed ${entry.name}`, { label: "Undo", run: () => restoreEntry(entry) });
        }}
      />
    </>
  );
}
