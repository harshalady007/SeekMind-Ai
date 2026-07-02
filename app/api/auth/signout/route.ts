import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/config/env";
import { DEMO_USER_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/signout — works for both Supabase and demo sessions. */
export async function POST() {
  const env = getEnv();
  if (env.SUPABASE_ENABLED && !env.DEMO_MODE) {
    const { createSupabaseServerClient } = await import("@/lib/auth/supabase-server");
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_USER_COOKIE);
  return NextResponse.json({ signedOut: true });
}
