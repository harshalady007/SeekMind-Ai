import type { Metadata } from "next";
import { getEnv } from "@/lib/config/env";
import { LoginView } from "@/components/auth/login-view";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const env = getEnv();
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const errorParam = typeof params.error === "string" ? params.error : null;

  return (
    <LoginView
      supabaseAuth={env.SUPABASE_ENABLED && !env.DEMO_MODE}
      demoMode={env.DEMO_MODE}
      next={next}
      initialError={
        errorParam === "auth_failed"
          ? "That sign-in link is invalid or has expired. Please request a new one."
          : null
      }
    />
  );
}
