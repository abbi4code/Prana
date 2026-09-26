"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { AkhadaGate, Avatar } from "@/components/akhada/Profile";
import { useAuth } from "@/lib/auth";
import { failText, social, type Card } from "@/lib/social/api";
import { invalidate, rememberAfterLogin, useSocial, useSocialBoot } from "@/lib/social/state";

/** A friend's invite link (/akhada/join/<token>): opening it makes you friends (the link is their consent). */
export default function JoinInvitePage() {
  useSocialBoot();
  const { token } = useParams<{ token: string }>();
  const status = useAuth((s) => s.status);
  useEffect(() => {
    if (status === "signedOut") rememberAfterLogin(`/akhada/join/${token}`);
  }, [status, token]);
  return (
    <div className="mx-auto max-w-lg space-y-4 pt-4">
      <AkhadaGate>
        <Accept token={token} />
      </AkhadaGate>
    </div>
  );
}

function Accept({ token }: { token: string }) {
  const [state, setState] = useState<{ s: "busy" } | { s: "done"; friend: Card } | { s: "error"; text: string }>({ s: "busy" });
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    void (async () => {
      const r = await social.acceptInvite(token);
      if (!r.ok) return setState({ s: "error", text: r.reason === "not_found" ? "This invite link isn't valid any more. Ask for a new one." : failText(r) });
      invalidate("");
      void useSocial.getState().refresh();
      setState({ s: "done", friend: r.data });
    })();
  }, [token]);

  if (state.s === "busy")
    return <p className="card flex items-center justify-center gap-2 p-8 text-muted"><LoaderCircle size={18} className="animate-spin text-turmeric" /> Accepting the invite…</p>;
  if (state.s === "error")
    return (
      <div className="card p-6 text-center">
        <p className="font-semibold">{state.text}</p>
        <Link href="/akhada" className="mt-4 inline-flex h-11 items-center rounded-xl bg-cream px-5 text-sm font-bold text-bg">Go to the Akhada</Link>
      </div>
    );
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card relative overflow-hidden p-6 text-center">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 size-56 -translate-x-1/2 rounded-full bg-leaf opacity-20 blur-3xl" />
      <motion.div initial={{ scale: 0.4, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="relative mx-auto w-fit">
        <Avatar id={state.friend.avatar} size={80} />
      </motion.div>
      <h1 className="relative mt-4 font-display text-2xl font-semibold">You and {state.friend.name} are friends</h1>
      <p className="relative mt-1 text-sm text-muted">@{state.friend.handle} · you&apos;ll see each other on the Friends board.</p>
      <Link href="/akhada" className="relative mt-5 inline-flex h-12 items-center rounded-2xl bg-gradient-to-r from-turmeric to-saffron px-6 font-bold text-on-accent">See the leaderboard</Link>
    </motion.div>
  );
}
