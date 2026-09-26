"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, CloudOff, EyeOff, LoaderCircle, ShieldCheck, Swords, X } from "lucide-react";
import { GoogleButton } from "@/components/account/GoogleButton";
import { firstName } from "@/components/today/Greeting";
import { useAuth } from "@/lib/auth";
import { failText, social, type Card } from "@/lib/social/api";
import { AVATARS, avatarOf, invalidate, useSocial } from "@/lib/social/state";
import { useUI } from "@/lib/store";

export function Avatar({ id, size = 40, className = "" }: { id: string; size?: number; className?: string }) {
  const a = avatarOf(id);
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${a.tone} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      {a.emoji}
    </span>
  );
}

export function Who({ c, sub, size = 40 }: { c: Card; sub?: React.ReactNode; size?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar id={c.avatar} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-semibold leading-tight">{c.name}</span>
        <span className="block truncate text-xs text-muted">@{c.handle}{sub ? <> · {sub}</> : null}</span>
      </span>
    </span>
  );
}

/**
 * Everything social needs: signed in (guests stay local), online, and joined (consent + 18+).
 * Renders the right prompt until then, else `children`.
 */
export function AkhadaGate({ children }: { children: React.ReactNode }) {
  const status = useAuth((s) => s.status);
  const me = useSocial((s) => s.me);
  const failed = useSocial((s) => s.failed);
  const loading = useSocial((s) => s.loading);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOnline(navigator.onLine), 0);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);

  if (status === "signedIn" && me === undefined && failed && online && !loading)
    return (
      <Prompt icon={<CloudOff size={22} />} title="Couldn't reach the Akhada">
        <p>Your logs are safe on this device. Check your connection and try again.</p>
        <button onClick={() => void useSocial.getState().refresh()} className="mt-4 h-11 rounded-xl bg-cream px-5 text-sm font-bold text-bg">Try again</button>
      </Prompt>
    );
  if (status === "loading" || (status === "signedIn" && me === undefined && online)) return <GateSkeleton />;
  if (status !== "signedIn")
    return (
      <Prompt icon={<Swords size={22} />} title="The Akhada is for signed-in members">
        <p>Rank with friends, take on challenges and see who&apos;s showing up. Your logs stay yours: only active days and streaks are shared, and only if you join.</p>
        {status !== "disabled" && <GoogleButton className="mt-4" />}
      </Prompt>
    );
  if (!online)
    return (
      <Prompt icon={<CloudOff size={22} />} title="You're offline">
        <p>The leaderboard and challenges need a connection. Logging still works offline and will count once it syncs.</p>
      </Prompt>
    );
  if (!me) return <JoinCard />;
  return <>{children}</>;
}

function Prompt({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card relative overflow-hidden p-6 text-center md:mx-auto md:max-w-lg">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 size-48 -translate-x-1/2 rounded-full bg-saffron opacity-20 blur-3xl" />
      <span className="relative mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-turmeric to-saffron text-on-accent">{icon}</span>
      <h2 className="relative mt-3 font-display text-xl font-semibold">{title}</h2>
      <div className="relative mt-2 text-sm text-muted">{children}</div>
    </section>
  );
}

function GateSkeleton() {
  return (
    <div className="space-y-3">
      <div className="skeleton h-12" />
      <div className="skeleton h-24" />
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}
    </div>
  );
}

const suggestHandle = (name: string | null) =>
  (name ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 16);

/** Join (consent + 18+ + name/handle/avatar) or edit your profile. */
export function JoinCard({ edit = false, onDone }: { edit?: boolean; onDone?: () => void }) {
  const me = useSocial((s) => s.me);
  const setMe = useSocial((s) => s.set);
  const user = useAuth((s) => s.user);
  const showToast = useUI((s) => s.showToast);
  const [name, setName] = useState(edit && me ? me.name : firstName(user) ?? "");
  const [handle, setHandle] = useState(edit && me ? me.handle : suggestHandle(firstName(user)));
  const [avatar, setAvatar] = useState(edit && me ? me.avatar : "flame");
  const [listed, setListed] = useState(edit && me ? me.listed : true);
  const [adult, setAdult] = useState(edit);
  const [check, setCheck] = useState<null | "checking" | "ok" | "invalid" | "reserved" | "blocked" | "taken">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // live handle check, debounced
  const h = handle.trim().toLowerCase();
  useEffect(() => {
    if (edit && me && h === me.handle) {
      const t = setTimeout(() => setCheck("ok"), 0);
      return () => clearTimeout(t);
    }
    if (!/^[a-z0-9_]{3,20}$/.test(h)) {
      const t = setTimeout(() => setCheck(h ? "invalid" : null), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      setCheck("checking");
      const r = await social.checkHandle(h);
      setCheck(r.ok ? r.data : null);
    }, 400);
    return () => clearTimeout(t);
  }, [h, edit, me]);

  const canSave = !!name.trim() && check === "ok" && adult && !busy;
  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const r = await social.join({ handle: h, name: name.trim(), avatar, listed, adult });
    setBusy(false);
    if (!r.ok) return setError(failText(r));
    setMe(r.data);
    invalidate("board");
    showToast(edit ? "Profile updated." : `Welcome to the Akhada, ${r.data.name.split(" ")[0]}!`);
    onDone?.();
  };

  const handleNote = {
    checking: "Checking…", ok: "Available", invalid: "3–20 letters, numbers or _", reserved: "Reserved", blocked: "Please choose something friendlier", taken: "Taken",
  } as const;

  return (
    <section className={edit ? "" : "card relative overflow-hidden p-5 md:mx-auto md:max-w-xl md:p-6"}>
      {!edit && (
        <>
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-saffron opacity-20 blur-3xl" />
          <p className="relative text-sm font-semibold text-faint" lang="hi">अखाड़ा</p>
          <h2 className="relative font-display text-2xl font-semibold">Join the Akhada</h2>
          <p className="relative mt-1 text-sm text-muted">Rank with friends and everyone else, and take on challenges.</p>
          <div className="relative mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-leaf/10 p-3">
              <p className="flex items-center gap-1.5 font-semibold text-leaf"><ShieldCheck size={15} /> Shared</p>
              <p className="mt-1 text-muted">Your name, handle and avatar. Active days, effort, streak and verified gym days.</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 font-semibold"><EyeOff size={15} /> Never shared</p>
              <p className="mt-1 text-muted">Food, calories, body weight, your gym, map or times. Your Google name and photo.</p>
            </div>
          </div>
        </>
      )}

      <div className="relative mt-4 space-y-3">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder="How friends see you"
            className="mt-1 h-12 w-full rounded-2xl border border-line-strong bg-bg/60 px-4 font-semibold outline-none placeholder:font-normal placeholder:text-faint focus:border-turmeric/60"
          />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            <span>Handle</span>
            {check && (
              <span className={`normal-case tracking-normal ${check === "ok" ? "text-leaf" : check === "checking" ? "text-muted" : "text-chilli"}`}>
                {handleNote[check]}
              </span>
            )}
          </span>
          <span className="mt-1 flex h-12 items-center rounded-2xl border border-line-strong bg-bg/60 px-4 focus-within:border-turmeric/60">
            <span className="text-muted">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/\s/g, "_").slice(0, 20))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="your_handle"
              className="h-full min-w-0 flex-1 bg-transparent pl-0.5 font-semibold outline-none placeholder:font-normal placeholder:text-faint"
            />
            {check === "checking" ? <LoaderCircle size={16} className="animate-spin text-muted" /> : check === "ok" ? <Check size={16} className="text-leaf" /> : check ? <X size={16} className="text-chilli" /> : null}
          </span>
        </label>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">Avatar</span>
          <div className="mt-1.5 grid grid-cols-6 gap-2 sm:grid-cols-12">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAvatar(a.id)}
                aria-label={`Avatar ${a.id}`}
                aria-pressed={avatar === a.id}
                className={`grid aspect-square place-items-center rounded-full transition-transform ${avatar === a.id ? "scale-105 ring-2 ring-cream ring-offset-2 ring-offset-surface" : "opacity-70 hover:opacity-100"}`}
              >
                <Avatar id={a.id} size={40} />
              </button>
            ))}
          </div>
        </div>
        <Toggle on={listed} onChange={setListed} title="Show me on the Everyone board" body="Off: only friends see you, and you can't be found by search." />
        {!edit && (
          <Toggle on={adult} onChange={setAdult} title="I'm 18 or older" body="The Akhada is for adults (India's data protection law doesn't allow tracking children)." />
        )}
        {error && <p className="rounded-2xl bg-chilli/10 px-3 py-2 text-sm text-chilli">{error}</p>}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={save}
          disabled={!canSave}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-turmeric to-saffron py-3.5 font-bold text-on-accent disabled:opacity-40"
        >
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Swords size={18} />} {edit ? "Save" : "Join the Akhada"}
        </motion.button>
        {!edit && <p className="text-center text-xs text-faint">You can leave anytime in Me. Leaving deletes your Akhada profile, friends and challenge entries.</p>}
      </div>
    </section>
  );
}

function Toggle({ on, onChange, title, body }: { on: boolean; onChange: (v: boolean) => void; title: string; body: string }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} className="flex w-full items-start gap-3 rounded-2xl border border-line-strong bg-surface-2 p-3.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{body}</span>
      </span>
      <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-leaf" : "bg-surface-3"}`}>
        <motion.span layout className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${on ? "right-0.5" : "left-0.5"}`} transition={{ type: "spring", stiffness: 500, damping: 34 }} />
      </span>
    </button>
  );
}
