import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { apiError, zodErrorResponse } from "@/lib/api/respond";
import { createSpaceSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** GET /api/spaces — list the caller's workspaces. */
export async function GET() {
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");
  const store = await getStore();
  const spaces = await store.listSpaces(identity);
  return NextResponse.json({ spaces });
}

/** POST /api/spaces — create a workspace. */
export async function POST(request: NextRequest) {
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Body must be JSON.");
  }
  const parsed = createSpaceSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const store = await getStore();
  const ownerId = identity.kind === "user" ? identity.userId : identity.sessionId;
  const space = await store.createSpace(ownerId, parsed.data);
  return NextResponse.json({ space }, { status: 201 });
}
