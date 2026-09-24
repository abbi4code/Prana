"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mic, Search, Sparkles } from "lucide-react";
import { openQuickAdd } from "@/components/log/QuickAdd";
import { useAuth } from "@/lib/auth";
import { useSpeechSupported } from "@/lib/nl/useSpeech";
import { useIsDesktop } from "@/lib/useMediaQuery";

// what the rotating hint suggests: sentences for signed-in users (AI parsing), plain names for guests
const SAY = ["2 roti aur dal", "bench 3x10 60kg", "30 min walk", "chai aur 2 biscuit", "kal raat biryani khayi"];
const SEARCH = ["dal", "bench press", "paneer", "running", "chai"];

/** Today's "Add anything" bar (D29): one place to log food or a workout, by typing or voice. */
export function AddBar() {
  const signedIn = useAuth((s) => s.status === "signedIn");
  const voice = useSpeechSupported();
  const desktop = useIsDesktop();
  const still = useReducedMotion();
  const hints = signedIn ? SAY : SEARCH;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setI((n) => n + 1), 3200);
    return () => clearInterval(t);
  }, [still]);

  return (
    <div className="relative flex h-16 items-center gap-3 rounded-[1.4rem] border border-line-strong bg-surface pl-3 pr-2 shadow-[0_12px_36px_-18px_rgb(0_0_0/0.6)] transition-colors hover:border-turmeric/50">
      {/* the whole bar opens the sheet; the mic sits above it */}
      <button onClick={() => openQuickAdd()} aria-label="Add food or workout" className="absolute inset-0 rounded-[1.4rem]" />
      <span className="pointer-events-none grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-turmeric/25 to-jamun/25 text-turmeric">
        {signedIn ? <Sparkles size={19} /> : <Search size={19} />}
      </span>
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="block truncate font-semibold">Add food or workout</span>
        <span className="relative block h-5 overflow-hidden text-[13px] text-faint">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={i % hints.length}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="block truncate"
            >
              {signedIn ? "try " : "search "}“{hints[i % hints.length]}”
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
      {desktop && (
        <kbd className="pointer-events-none rounded-md border border-line-strong px-1.5 py-0.5 text-xs text-muted">/</kbd>
      )}
      {voice && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => openQuickAdd(true)}
          aria-label="Say what you ate or did"
          className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-saffron to-jamun text-white shadow-[0_8px_22px_-8px_var(--color-jamun)]"
        >
          <Mic size={21} />
        </motion.button>
      )}
    </div>
  );
}
