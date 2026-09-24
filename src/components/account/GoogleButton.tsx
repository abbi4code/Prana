"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { signInWithGoogle } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabase";

export function GoogleButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className}>
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={!supabaseEnabled || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await signInWithGoogle(); // navigates away to Google on success
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't start Google sign-in");
            setBusy(false);
          }
        }}
        className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-cream px-5 text-[15px] font-bold text-bg shadow-[0_10px_30px_-12px_rgb(255_244_228/0.5)] transition-[filter] hover:brightness-95 disabled:opacity-50"
      >
        {busy ? <LoaderCircle size={20} className="animate-spin" /> : <GoogleMark />}
        Continue with Google
      </motion.button>
      {error && <p className="mt-2 text-sm text-chilli">{error}</p>}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
