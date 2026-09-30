"use client";

// Natural-language logging controls shared by the food sheet and the workout sheet (nl-logging.md):
// one hook (state + parse + voice) and the small UI pieces around the search box. Both sheets therefore
// run the exact same pipeline: sentence → /api/food/parse → confirm card (food + workouts) → log.

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CornerDownLeft, LoaderCircle, Mic, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { parseSentence } from "@/lib/nl/client";
import type { ParsedLog } from "@/lib/nl/schema";
import { useSpeech } from "@/lib/nl/useSpeech";
import { useStore, useUI } from "@/lib/store";
import type { LogSource, Meal } from "@/lib/types";
import { ConfirmParse } from "./ConfirmParse";

export type NlDraft = { text: string; source: Exclude<LogSource, "manual">; parsed: ParsedLog };

/** A sentence (several words, or a number) is worth sending to the AI; single words use plain search. */
export const isSentence = (q: string) => {
  const t = q.trim();
  return t.length >= 3 && (/\s/.test(t) || /\d/.test(t));
};

// words that join several items or say when/which meal: "roti aur dal", "kal dinner mein" are logs, not one dish
const LOG_WORDS = /(^|\s)(aur|and|with|n|plus|for|mein|me|main|kal|aaj|today|yesterday|breakfast|lunch|dinner|nashta|khana|khaya|khayi|piya|pi|ate|had)(\s|$)|[,+&]/i;

/**
 * A multi-word query that is probably one dish name ("kulfi falooda", "gajar ka halwa"), not a sentence to log:
 * at most 4 words, no numbers, no joining / time words. Such a query still gets "Request it" + "Create" (D54).
 */
export const looksLikeFoodName = (q: string) => {
  const t = q.trim();
  return t.length >= 3 && !/\d/.test(t) && t.split(/\s+/).length <= 4 && !LOG_WORDS.test(t);
};

export function useNlLog(setQuery: (q: string) => void) {
  const signedIn = useAuth((s) => s.status === "signedIn");
  const showToast = useUI((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<NlDraft | null>(null);

  const understand = async (text: string, source: NlDraft["source"]) => {
    if (busy || !text.trim()) return;
    setBusy(true);
    const out = await parseSentence(text.trim());
    setBusy(false);
    if (out.ok && (out.data.items.length || out.data.workouts.length)) return setDraft({ text: text.trim(), source, parsed: out.data });
    if (out.ok) return showToast("Didn't catch a food or workout in that. Try “2 roti aur dal” or “30 min walk”.");
    if (out.reason === "rate_limited")
      return showToast(`AI logging limit reached. Try again in ${Math.max(1, Math.round((out.retryAfterS ?? 60) / 60))} min, or pick below.`);
    if (out.reason === "signed_out") return showToast("Sign in to log whole sentences.");
    showToast(out.reason === "offline" ? "You're offline. Pick from the list below." : "Couldn't read that. Pick from the list below.");
  };

  // voice only fills the box; a finished sentence then goes through the same pipeline as typing
  const speech = useSpeech({
    onInterim: setQuery,
    onFinal: (text) => {
      setQuery(text);
      if (signedIn) void understand(text, "voice");
    },
    onError: (msg) => showToast(msg),
  });

  return { signedIn, busy, draft, setDraft, understand, speech };
}

/** The confirm card inside a sheet, plus the "Logged …" toast with Undo for everything it logged. */
export function NlConfirm({ draft, initialMeal, date, onBack, onDone }: {
  draft: NlDraft;
  initialMeal: Meal;
  date: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const showToast = useUI((s) => s.showToast);
  return (
    <ConfirmParse
      text={draft.text}
      source={draft.source}
      parsed={draft.parsed}
      initialMeal={initialMeal}
      date={date}
      onBack={onBack}
      onLogged={({ entryIds, workoutIds }) => {
        onDone();
        const parts = [
          entryIds.length && `${entryIds.length} food${entryIds.length === 1 ? "" : "s"}`,
          workoutIds.length && `${workoutIds.length} workout${workoutIds.length === 1 ? "" : "s"}`,
        ].filter(Boolean);
        showToast(`Logged ${parts.join(" + ")}`, {
          label: "Undo",
          run: () => {
            const s = useStore.getState();
            entryIds.forEach((id) => s.removeEntry(id));
            workoutIds.forEach((id) => s.removeWorkout(id));
          },
        });
      }}
    />
  );
}

/** Mic inside the search box; hidden when the browser has no speech recognition. */
export function MicButton({ speech, onStart, accent = "chilli" }: {
  speech: ReturnType<typeof useSpeech>;
  onStart: () => void;
  accent?: "chilli" | "jamun";
}) {
  if (!speech.supported) return null;
  const on = accent === "jamun" ? "bg-jamun" : "bg-chilli";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={() => (speech.listening ? speech.stop() : (onStart(), speech.start()))}
      aria-label={speech.listening ? "Stop listening" : "Speak what you ate or did"}
      aria-pressed={speech.listening}
      className={`relative grid size-9 shrink-0 place-items-center rounded-full transition-colors ${
        speech.listening ? `${on} text-white` : "text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {speech.listening && (
        <motion.span
          aria-hidden
          className={`absolute inset-0 rounded-full ${on}`}
          animate={{ scale: [1, 1.6], opacity: [0.45, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <Mic size={18} className="relative" />
    </motion.button>
  );
}

/** "✨ Log “2 roti aur dal”": sends the sentence to the AI parser (signed-in users). */
export function UnderstandRow({ text, busy, desktop, onClick, what = "meal" }: {
  text: string;
  busy: boolean;
  desktop: boolean;
  onClick: () => void;
  /** "Reading your meal…" */
  what?: string;
}) {
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
        <span className="block truncate font-semibold">{busy ? `Reading your ${what}…` : `Log “${text}”`}</span>
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

export function SignInHint({ what = "a whole meal" }: { what?: string }) {
  return (
    <Link href="/login" className="mb-2 mt-1 flex items-center gap-2 rounded-2xl border border-dashed border-line-strong px-3 py-2.5 text-[13px] text-muted hover:text-text">
      <Sparkles size={15} className="shrink-0 text-turmeric" />
      Sign in to log {what} in one sentence
    </Link>
  );
}
