"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Diamond } from "@phosphor-icons/react";

import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";

const OWNER_EMAIL = "borteh@borteh.app";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createAuthBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }
    const role = data.user?.app_metadata?.role;
    if (role !== "owner" && role !== "staff") {
      await supabase.auth.signOut();
      setError("This account isn't a staff account.");
      setPending(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4">
      {/* soft backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,var(--color-primary)/8%,transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative w-full max-w-[22rem]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Diamond weight="fill" className="size-5" />
          </span>
          <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight">Borteh</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to the store admin</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-foreground/5">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@borteh.app"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`mt-1.5 ${inputClass}`}
              />
            </label>
            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="group inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
              {!pending ? <ArrowRight weight="bold" className="size-4 transition-transform group-hover:translate-x-0.5" /> : null}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">Owner &amp; counter staff only · Borteh Sprays</p>
      </div>
    </main>
  );
}
