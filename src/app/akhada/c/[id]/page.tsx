"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChallengeView } from "@/components/akhada/Challenges";
import { AkhadaGate } from "@/components/akhada/Profile";
import { useAuth } from "@/lib/auth";
import { rememberAfterLogin, useSocialBoot } from "@/lib/social/state";

/** One challenge (D47). Shared as /akhada/c/<id>?code=<join code>; signing in first comes back here. */
export default function ChallengePage() {
  return (
    <Suspense fallback={<div className="skeleton h-80" />}>
      <Page />
    </Suspense>
  );
}

function Page() {
  useSocialBoot();
  const { id } = useParams<{ id: string }>();
  const code = useSearchParams().get("code");
  const status = useAuth((s) => s.status);
  useEffect(() => {
    if (status === "signedOut") rememberAfterLogin(`/akhada/c/${id}${code ? `?code=${code}` : ""}`);
  }, [status, id, code]);
  const valid = /^[0-9a-f-]{36}$/i.test(id ?? "");
  return (
    <div className="space-y-4 lg:max-w-3xl">
      <Link href="/akhada?tab=challenges" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft size={16} /> Challenges
      </Link>
      <AkhadaGate>{valid ? <ChallengeView id={id} code={code} /> : <p className="card p-6 text-sm text-muted">That link doesn&apos;t look right.</p>}</AkhadaGate>
    </div>
  );
}
