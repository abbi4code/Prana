"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DuelView } from "@/components/akhada/Duels";
import { AkhadaGate } from "@/components/akhada/Profile";
import { useAuth } from "@/lib/auth";
import { rememberAfterLogin, useSocialBoot } from "@/lib/social/state";

/** One weekly duel (D48). */
export default function DuelPage() {
  useSocialBoot();
  const { id } = useParams<{ id: string }>();
  const status = useAuth((s) => s.status);
  useEffect(() => {
    if (status === "signedOut") rememberAfterLogin(`/akhada/d/${id}`);
  }, [status, id]);
  const valid = /^[0-9a-f-]{36}$/i.test(id ?? "");
  return (
    <div className="space-y-4 lg:max-w-2xl">
      <Link href="/akhada?tab=challenges" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft size={16} /> Challenges
      </Link>
      <AkhadaGate>{valid ? <DuelView id={id} /> : <p className="card p-6 text-sm text-muted">That link doesn&apos;t look right.</p>}</AkhadaGate>
    </div>
  );
}
