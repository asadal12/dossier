import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { LoginForm } from "@/app/login/login-form";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "../context/auth";

export function LoginPage() {
  const { authenticated, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  if (!loading && authenticated) {
    return <Navigate to={next || "/"} replace />;
  }

  return (
    <main className="grid min-h-screen bg-surface min-[960px]:grid-cols-2">
      <div className="flex items-center justify-center px-8 py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-8">
          <div className="flex flex-col items-start gap-2">
            <BrandMark className="size-10" />
            <div className="flex flex-col">
              <div className="font-serif text-[30px] font-medium tracking-[-0.01em]">Dossier</div>
              <div className="text-sm text-muted">Your job search, on your server</div>
            </div>
          </div>
          <LoginForm next={next} />
          <p className="text-meta leading-[1.6] text-pretty text-muted">
            Your password is set on the server, as a hash in{" "}
            <code className="font-mono text-label">DOSSIER_PASSWORD</code>. Forgot it? Make a new hash with{" "}
            <code className="font-mono text-label">hash-password</code> and restart.
          </p>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="hidden bg-[linear-gradient(to_left,color-mix(in_srgb,var(--color-ink)_9%,transparent)_0%,transparent_65%)] min-[960px]:grid min-[960px]:place-items-center"
      >
        <BrandMark className="size-40 opacity-90 shadow-dialog rounded-[36px]" />
      </div>
    </main>
  );
}
