"use client";

import { useState } from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import { motion } from "motion/react";
import { ChevronRight, LogOut, Pencil, Swords, X } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { useAuth } from "@/lib/auth";
import { failText, social } from "@/lib/social/api";
import { invalidate, useSocial, useSocialBoot } from "@/lib/social/state";
import { useUI } from "@/lib/store";
import { Avatar, JoinCard } from "./Profile";

/** Me → Akhada: your public profile, edit it, or leave (deletes everything social). */
export function AkhadaCard() {
  useSocialBoot();
  const status = useAuth((s) => s.status);
  const me = useSocial((s) => s.me);
  const setMe = useSocial((s) => s.set);
  const showToast = useUI((s) => s.showToast);
  const [edit, setEdit] = useState(false);
  const [leaving, setLeaving] = useState(false);
  if (status !== "signedIn" || me === undefined) return null;

  const leave = async () => {
    const r = await social.leave();
    if (!r.ok) return showToast(failText(r));
    invalidate("");
    setMe(null);
    setLeaving(false);
    showToast("You left the Akhada. Your profile, friends and challenge entries are deleted.");
  };

  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <Swords size={16} className="text-saffron" />
        <h2 className="font-display text-lg font-semibold">Akhada profile</h2>
      </div>
      {!me ? (
        <Link href="/akhada" className="mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-3 hover:bg-surface-3">
          <span className="min-w-0 flex-1 text-sm text-muted">Not joined. Join to rank with friends and take on challenges.</span>
          <ChevronRight size={16} className="text-faint" />
        </Link>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
            <Avatar id={me.avatar} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{me.name}</span>
              <span className="block truncate text-xs text-muted">@{me.handle} · {me.listed ? "on the Everyone board" : "friends only"}</span>
            </span>
            <button onClick={() => setEdit(true)} className="flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold text-muted hover:text-text">
              <Pencil size={12} /> Edit
            </button>
          </div>
          <button
            onClick={async () => {
              const on = !me.allowNudges;
              setMe({ ...me, allowNudges: on });
              const r = await social.setNudges(on);
              if (!r.ok) { setMe(me); showToast(failText(r)); }
            }}
            role="switch"
            aria-checked={me.allowNudges}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line-strong p-3 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Friends can nudge me</span>
              <span className="block text-xs text-muted">A friendly 👋 after 3 quiet days, at most once every 3 days per friend.</span>
            </span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${me.allowNudges ? "bg-leaf" : "bg-surface-3"}`}>
              <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${me.allowNudges ? "right-0.5" : "left-0.5"}`} />
            </span>
          </button>
          {!leaving ? (
            <button onClick={() => setLeaving(true)} className="mt-3 flex items-center gap-1.5 text-sm text-faint hover:text-chilli"><LogOut size={14} /> Leave the Akhada</button>
          ) : (
            <div className="mt-3 rounded-2xl border border-chilli/30 bg-chilli/10 p-3 text-sm">
              <p>Leave the Akhada? Your profile, friends, challenge entries and inbox are deleted. Your logs stay on your account.</p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button onClick={() => setLeaving(false)} className="h-10 rounded-xl border border-line-strong font-semibold">Stay</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={leave} className="h-10 rounded-xl bg-chilli font-bold text-white">Leave</motion.button>
              </div>
            </div>
          )}
        </>
      )}
      <Sheet open={edit} onClose={() => setEdit(false)} size="narrow">
        {edit && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between px-5 pt-1">
              <Drawer.Title className="font-display text-2xl font-semibold">Akhada profile</Drawer.Title>
              <button onClick={() => setEdit(false)} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-line-strong text-muted"><X size={18} /></button>
            </div>
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <JoinCard edit onDone={() => setEdit(false)} />
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
