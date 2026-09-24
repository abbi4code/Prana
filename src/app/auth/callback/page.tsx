"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

/** Google → Supabase → here with ?code=. The Supabase client exchanges it on load (PKCE). */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Waiting />}>
      <Callback />
    </Suspense>
  );
}

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const status = useAuth((s) => s.status);
  const error = params.get("error_description") ?? params.get("error");

  useEffect(() => {
    if (status === "signedIn") router.replace("/");
  }, [status, router]);

  if (error || status === "signedOut" || status === "disabled")
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-2xl font-semibold">Sign-in didn&apos;t finish</h1>
          <p className="mt-2 text-sm text-muted">{error ?? "The sign-in link expired or was already used. Please try again."}</p>
          <Link href="/login" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-cream px-6 font-bold text-bg">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  return <Waiting />;
}

function Waiting() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <p className="flex items-center gap-2 text-muted">
        <LoaderCircle size={18} className="animate-spin text-turmeric" /> Signing you in…
      </p>
    </div>
  );
}
