import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getEnv } from "@/lib/config/env";
import { apiError } from "@/lib/api/respond";
import { DEMO_USER_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Demo sign-in: available only when real Supabase auth is unavailable
 * (demo mode, or Supabase not configured). Creates a clearly-labelled local
 * demo account so the signed-in experience is fully testable.
 */
export async function POST() {
  const env = getEnv();
  if (env.SUPABASE_ENABLED && !env.DEMO_MODE) {
    return apiError(
      "forbidden",
      "Demo sign-in is disabled when real auth is configured.",
    );
  }
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEMO_USER_COOKIE)?.value;
  const userId =
    existing && /^demo_[A-Za-z0-9_-]{8,64}$/.test(existing)
      ? existing
      : `demo_${randomBytes(12).toString("base64url")}`;
  cookieStore.set(DEMO_USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return NextResponse.json({ signedIn: true, demo: true });
}

/** Demo sign-out. */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_USER_COOKIE);
  return NextResponse.json({ signedIn: false });
}
