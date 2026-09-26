"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Bell, Medal, Swords, Trophy, Users } from "lucide-react";
import { ChallengesTab } from "@/components/akhada/Challenges";
import { Leaderboard } from "@/components/akhada/Leaderboard";
import { FriendsSheet, InboxSheet, PersonSheet } from "@/components/akhada/People";
import { AkhadaGate } from "@/components/akhada/Profile";
import { AchievementsView } from "@/components/achievements/AchievementsView";
import { useSocial, useSocialBoot } from "@/lib/social/state";
import { useStore } from "@/lib/store";

type Tab = "leaderboard" | "challenges" | "awards";
const TABS: { id: Tab; label: string; icon: typeof Trophy }[] = [
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "challenges", label: "Challenges", icon: Swords },
  { id: "awards", label: "Awards", icon: Medal },
];

/** Akhada (अखाड़ा, D46): the leaderboard, challenges (D47) and your awards (D38). */
export default function AkhadaPage() {
  return (
    <Suspense fallback={<div className="space-y-4"><div className="skeleton h-14 w-48" /><div className="skeleton h-12" /><div className="skeleton h-80" /></div>}>
      <Akhada />
    </Suspense>
  );
}

function Akhada() {
  useSocialBoot();
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useStore((s) => s.hydrated);
  const me = useSocial((s) => s.me);
  const raw = params.get("tab");
  const tab: Tab = raw === "challenges" || raw === "awards" ? raw : "leaderboard";
  const [friends, setFriends] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [person, setPerson] = useState<string | null>(null);
  const go = (t: Tab) => router.replace(t === "leaderboard" ? "/akhada" : `/akhada?tab=${t}`, { scroll: false });

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-faint" lang="hi">अखाड़ा</p>
          <h1 className="font-display text-[2rem] font-semibold leading-tight lg:text-4xl">Akhada</h1>
        </div>
        {me && (
          <div className="flex gap-2">
            <IconButton label="Friends" count={me.requests} onClick={() => setFriends(true)}><Users size={18} /></IconButton>
            <IconButton label="Inbox" count={me.unread} onClick={() => setInbox(true)}><Bell size={18} /></IconButton>
          </div>
        )}
      </div>

      <div className="flex rounded-2xl border border-line-strong bg-surface p-1 md:max-w-lg">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            aria-pressed={tab === id}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${tab === id ? "text-bg" : "text-muted hover:text-text"}`}
          >
            {tab === id && <motion.span layoutId="akhada-tab" className="absolute inset-0 rounded-xl bg-cream" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <Icon size={16} className="relative" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="lg:max-w-4xl">
        {tab === "awards" ? (
          hydrated ? <AchievementsView embedded /> : <div className="skeleton h-80" />
        ) : (
          <AkhadaGate>
            {tab === "leaderboard" ? <Leaderboard onPerson={setPerson} onFriends={() => setFriends(true)} /> : <ChallengesTab />}
          </AkhadaGate>
        )}
      </motion.div>

      <FriendsSheet open={friends} onClose={() => setFriends(false)} onPerson={(h) => { setFriends(false); setPerson(h); }} />
      <InboxSheet
        open={inbox}
        onClose={() => setInbox(false)}
        onPerson={(h) => { setInbox(false); setPerson(h); }}
        onChallenge={(id) => { setInbox(false); router.push(`/akhada/c/${id}`); }}
        onDuel={(id) => { setInbox(false); router.push(`/akhada/d/${id}`); }}
      />
      <PersonSheet handle={person} onClose={() => setPerson(null)} />
    </div>
  );
}

function IconButton({ label, count, onClick, children }: { label: string; count: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={count ? `${label}, ${count} new` : label} className="relative grid size-11 place-items-center rounded-full border border-line-strong bg-surface text-muted transition-colors hover:text-text">
      {children}
      {count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-chilli px-1 text-[11px] font-bold text-white tabular">{count > 9 ? "9+" : count}</span>
      )}
    </button>
  );
}
