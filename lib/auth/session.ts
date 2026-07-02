import { cookies } from "next/headers";
import type { Identity } from "@/lib/core/types";
import { getEnv } from "@/lib/config/env";

export const ANON_COOKIE = "df_anon";
export const DEMO_USER_COOKIE = "df_demo_user";

/**
 * Resolve the request identity:
 * 1. Supabase-authenticated user (when Supabase is configured).
 * 2. Demo user cookie (only honored when Supabase auth is unavailable —
 *    demo mode or unconfigured Supabase).
 * 3. Anonymous session cookie (set by middleware for every visitor).
 *
 * Returns null only when no anonymous cookie exists (e.g. middleware
 * bypassed), in which case callers treat the request as unauthenticated.
 */
export async function getIdentity(): Promise<Identity | null> {
  const env = getEnv();
  const cookieStore = await cookies();

  if (env.SUPABASE_ENABLED && !env.DEMO_MODE) {
    const { createSupabaseServerClient } = await import("./supabase-server");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return { kind: "user", userId: user.id, email: user.email ?? null };
    }
  } else {
    const demoUser = cookieStore.get(DEMO_USER_COOKIE)?.value;
    if (demoUser && /^demo_[A-Za-z0-9_-]{8,64}$/.test(demoUser)) {
      return { kind: "user", userId: demoUser, email: "demo@deepfind.local" };
    }
  }

  const anon = cookieStore.get(ANON_COOKIE)?.value;
  if (anon && /^anon_[A-Za-z0-9_-]{8,64}$/.test(anon)) {
    return { kind: "anonymous", sessionId: anon };
  }
  return null;
}

/** True when the identity belongs to a signed-in (non-anonymous) user. */
export function isSignedIn(identity: Identity | null): boolean {
  return identity?.kind === "user";
}
