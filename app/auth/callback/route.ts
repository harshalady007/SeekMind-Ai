import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

/**
 * Supabase auth callback: exchanges the OAuth/magic-link code for a session,
 * then redirects to the originally requested page (same-origin paths only —
 * prevents open redirects).
 */
export async function GET(request: NextRequest) {
  const env = getEnv();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/";
  // Only allow same-origin relative paths.
  const nextPath =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code && env.SUPABASE_ENABLED && !env.DEMO_MODE) {
    const { createSupabaseServerClient } = await import("@/lib/auth/supabase-server");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=auth_failed`, env.NEXT_PUBLIC_APP_URL),
      );
    }
  }
  return NextResponse.redirect(new URL(nextPath, env.NEXT_PUBLIC_APP_URL));
}
