"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Wordmark } from "@/components/layout/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export function LoginView({
  supabaseAuth,
  demoMode,
  next,
  initialError,
}: {
  supabaseAuth: boolean;
  demoMode: boolean;
  next: string;
  initialError: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >(initialError ? { kind: "error", message: initialError } : { kind: "idle" });

  const sendMagicLink = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus({ kind: "error", message: "Authentication is not configured." });
      return;
    }
    setStatus({ kind: "sending" });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus({
        kind: "error",
        message:
          error.status === 429
            ? "Too many sign-in attempts. Wait a minute and try again."
            : "We couldn't send the sign-in link. Check the address and try again.",
      });
    } else {
      setStatus({ kind: "sent" });
    }
  };

  const signInWithGoogle = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setStatus({ kind: "error", message: "Authentication is not configured." });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus({
        kind: "error",
        message: "Google sign-in is unavailable. Try the email link instead.",
      });
    }
  };

  const demoSignIn = async () => {
    setStatus({ kind: "sending" });
    const response = await fetch("/api/auth/demo", { method: "POST" });
    if (response.ok) {
      router.push(next);
      router.refresh();
    } else {
      setStatus({ kind: "error", message: "Demo sign-in failed. Reload and try again." });
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16">
      <Wordmark asLink={false} />
      <h1 className="mt-6 font-display text-2xl text-cream-50">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-graphite-300">
        Sign in to keep your research history, saved threads and workspaces.
      </p>

      {status.kind === "error" && (
        <p
          role="alert"
          className="mt-4 w-full rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
        >
          {status.message}
        </p>
      )}

      {supabaseAuth ? (
        status.kind === "sent" ? (
          <div className="mt-6 w-full rounded-card border border-success/30 bg-success/10 p-4 text-center">
            <Mail className="mx-auto h-6 w-6 text-success" aria-hidden="true" />
            <p className="mt-2 text-sm text-cream-100">
              Check <strong>{email}</strong> for a sign-in link. It brings you right back
              here.
            </p>
          </div>
        ) : (
          <div className="mt-6 w-full space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMagicLink();
              }}
              className="space-y-2"
            >
              <label htmlFor="login-email" className="block text-sm text-graphite-300">
                Email address
              </label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button
                variant="primary"
                type="submit"
                className="w-full justify-center"
                disabled={status.kind === "sending" || !email.includes("@")}
              >
                {status.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
              </Button>
            </form>
            <div className="flex items-center gap-3 text-xs text-graphite-400">
              <span className="h-px flex-1 bg-graphite-700" aria-hidden="true" />
              or
              <span className="h-px flex-1 bg-graphite-700" aria-hidden="true" />
            </div>
            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={signInWithGoogle}
            >
              Continue with Google
            </Button>
          </div>
        )
      ) : (
        <div className="mt-6 w-full space-y-3 text-center">
          <Badge tone="amber">{demoMode ? "Demo mode" : "Local mode"}</Badge>
          <p className="text-sm text-graphite-300">
            {demoMode
              ? "Real authentication is disabled in demo mode. Use a local demo account to try the signed-in experience — history lives in memory and resets on restart."
              : "Supabase is not configured, so a local demo account stands in for real authentication."}
          </p>
          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={demoSignIn}
            disabled={status.kind === "sending"}
            data-testid="demo-sign-in"
          >
            Continue with a demo account
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-graphite-400">
        You&apos;ll be returned to <span className="font-mono">{next}</span> after signing
        in.
      </p>
    </div>
  );
}
