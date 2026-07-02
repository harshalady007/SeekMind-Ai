import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth/session";
import { getEnv } from "@/lib/config/env";
import { getStore } from "@/lib/db";
import { apiError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/usage — the caller's own usage summary. */
export async function GET() {
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  const env = getEnv();
  const store = await getStore();
  const report = await store.getUsageReport(
    identity,
    identity.kind === "user" ? env.DAILY_USER_SEARCH_LIMIT : env.ANONYMOUS_SEARCH_LIMIT,
  );
  return NextResponse.json({
    ...report,
    identityKind: identity.kind,
    anonymousLimit: env.ANONYMOUS_SEARCH_LIMIT,
  });
}
