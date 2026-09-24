"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { GoogleButton } from "@/components/account/GoogleButton";
import { PortionVisual } from "@/components/log/PortionVisual";
import { APP_NAME } from "@/lib/app";
import { useAuth } from "@/lib/auth";
import { FOODS } from "@/lib/foods";
import { useStore } from "@/lib/store";
import { supabaseEnabled } from "@/lib/supabase";

const CHIPS = [
  { text: "Dal tadka · 1 katori", kcal: 95, x: "-8%", y: "8%", d: 0.2 },
  { text: "Roti × 2", kcal: 146, x: "62%", y: "0%", d: 0.35 },
  { text: "Chai · 1 cup", kcal: 24, x: "70%", y: "72%", d: 0.5 },
  { text: "Rajma chawal · 1 plate", kcal: 432, x: "-14%", y: "78%", d: 0.65 },
];

export default function LoginPage() {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const setGuest = useStore((s) => s.setGuest);

  useEffect(() => {
    if (status === "signedIn") router.replace("/");
  }, [status, router]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* art panel: desktop only */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-12 lg:flex">
        <Logo />
        <div className="relative mx-auto aspect-[22/15] w-full max-w-md">
          <PortionVisual kind="katori" qty={1.7} grams={250} hue="#f6c343" />
          {CHIPS.map((c) => (
            <motion.div
              key={c.text}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: c.d, type: "spring", stiffness: 120, damping: 16 }}
              className="absolute flex items-center gap-2 whitespace-nowrap rounded-full border border-line-strong bg-surface/90 px-3.5 py-2 text-sm shadow-xl shadow-black/40 backdrop-blur"
              style={{ left: c.x, top: c.y }}
            >
              <span>{c.text}</span>
              <span className="font-display font-semibold text-turmeric">{c.kcal}</span>
            </motion.div>
          ))}
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-muted">
          {FOODS.length} Indian foods with values from INDB 2024 and IFCT 2017, measured in katori, roti and plate, not just grams.
        </p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <Logo />
            <div className="mx-auto my-8 h-40 w-60">
              <PortionVisual kind="katori" qty={1.7} grams={250} hue="#f6c343" />
            </div>
          </div>

          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Count calories the way you <em className="text-turmeric">actually</em> eat.
          </h1>
          <p className="mt-4 text-muted">Log dal by the katori and roti by the piece. Your phone and laptop stay in sync.</p>

          <GoogleButton className="mt-8" />
          {!supabaseEnabled && (
            <p className="mt-2 text-xs text-faint">Sign-in isn&apos;t configured yet. Add the Supabase keys to .env.local.</p>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line-strong" /> or <span className="h-px flex-1 bg-line-strong" />
          </div>

          <button
            onClick={() => {
              setGuest(true);
              router.replace("/");
            }}
            className="h-12 w-full rounded-2xl border border-line-strong font-semibold text-muted transition-colors hover:border-cream/40 hover:text-text"
          >
            Use without an account
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-faint">
            Without an account your logs stay on this device. You can sign in later and they&apos;ll move into your account.
          </p>
        </div>
      </section>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-turmeric to-saffron">
        <svg viewBox="0 0 100 100" className="size-7" aria-hidden>
          <ellipse cx="50" cy="40" rx="38" ry="9" fill="#15100d" />
          <ellipse cx="50" cy="37" rx="30" ry="5" fill="#fff4e4" opacity="0.9" />
          <path d="M12,40 C13,66 30,80 50,80 C70,80 87,66 88,40 C76,50 24,50 12,40 Z" fill="#15100d" />
        </svg>
      </span>
      <span className="font-display text-2xl font-semibold">{APP_NAME}</span>
    </div>
  );
}
