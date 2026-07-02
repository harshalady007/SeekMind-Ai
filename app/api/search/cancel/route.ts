import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth/session";
import { apiError, zodErrorResponse } from "@/lib/api/respond";
import { cancelSearch, identityKeyOf } from "@/lib/orchestrator/cancel-registry";
import { cancelSearchSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** POST /api/search/cancel — abort an in-flight search owned by the caller. */
export async function POST(request: NextRequest) {
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Body must be JSON.");
  }
  const parsed = cancelSearchSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const cancelled = cancelSearch(parsed.data.searchId, identityKeyOf(identity));
  return NextResponse.json({ cancelled });
}
