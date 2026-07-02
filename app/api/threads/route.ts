import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { apiError, clientIp, zodErrorResponse } from "@/lib/api/respond";
import { getLimiters } from "@/lib/rate-limit";
import { listThreadsSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** GET /api/threads — cursor-paginated thread history with filters. */
export async function GET(request: NextRequest) {
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  const ipCheck = getLimiters().ipGeneral.check(`api:${clientIp(request)}`);
  if (!ipCheck.allowed) {
    return apiError("rate_limited", "Too many requests.", {
      retryAfterSeconds: ipCheck.retryAfterSeconds,
    });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  // Treat the literal string "null" for spaceId as "threads without a space".
  const normalized = {
    ...params,
    ...(params.spaceId === "null" ? { spaceId: null } : {}),
    ...(params.savedOnly === "false" ? { savedOnly: undefined } : {}),
  };
  const parsed = listThreadsSchema.safeParse(normalized);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const store = await getStore();
  const page = await store.listThreads(identity, parsed.data);
  return NextResponse.json(page);
}
