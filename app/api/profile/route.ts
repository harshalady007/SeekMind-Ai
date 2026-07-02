import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getIdentity } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { apiError, zodErrorResponse } from "@/lib/api/respond";
import { updateProfileSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** GET /api/profile — the signed-in user's profile + preferences. */
export async function GET() {
  const identity = await getIdentity();
  if (!identity || identity.kind !== "user") {
    return apiError("unauthorized", "Sign in to manage a profile.");
  }
  const store = await getStore();
  const profile =
    (await store.getProfile(identity.userId)) ??
    (await store.upsertProfile(identity.userId, {}));
  return NextResponse.json({ profile, email: identity.email });
}

/** PATCH /api/profile — update preferences. */
export async function PATCH(request: NextRequest) {
  const identity = await getIdentity();
  if (!identity || identity.kind !== "user") {
    return apiError("unauthorized", "Sign in to manage a profile.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Body must be JSON.");
  }
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const store = await getStore();
  const profile = await store.upsertProfile(identity.userId, parsed.data);
  return NextResponse.json({ profile });
}

/** DELETE /api/profile — delete all of the caller's data (threads, spaces, profile). */
export async function DELETE() {
  const identity = await getIdentity();
  if (!identity || identity.kind !== "user") {
    return apiError("unauthorized", "Sign in to manage a profile.");
  }
  const store = await getStore();
  await store.deleteUserData(identity.userId);
  return NextResponse.json({ deleted: true });
}
