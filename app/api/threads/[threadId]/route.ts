import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIdentity } from "@/lib/auth/session";
import { toPublicSource } from "@/lib/core/types";
import { getStore } from "@/lib/db";
import { apiError, zodErrorResponse } from "@/lib/api/respond";
import { updateThreadSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

type Params = { params: Promise<{ threadId: string }> };

/** GET /api/threads/[threadId] — full thread detail (messages + sources). */
export async function GET(_request: NextRequest, { params }: Params) {
  const { threadId } = await params;
  if (!idSchema.safeParse(threadId).success) {
    return apiError("bad_request", "Invalid thread id.");
  }
  const identity = await getIdentity();
  const store = await getStore();
  const detail = await store.getThreadDetail(threadId, identity);
  if (!detail) return apiError("not_found", "Thread not found.");

  const isOwner =
    identity !== null &&
    ((identity.kind === "user" && detail.thread.userId === identity.userId) ||
      (identity.kind === "anonymous" &&
        detail.thread.anonymousSessionId === identity.sessionId));

  // Public threads are readable only through /share/[token] — the raw
  // thread id never grants access to non-owners, even while shared.
  if (!isOwner) return apiError("not_found", "Thread not found.");

  return NextResponse.json({
    thread: {
      ...detail.thread,
      // Never leak the share token to non-owners reading a public thread.
      shareToken: isOwner ? detail.thread.shareToken : null,
      userId: undefined,
      anonymousSessionId: undefined,
    },
    isOwner,
    messages: detail.messages,
    sourcesByMessageId: Object.fromEntries(
      Object.entries(detail.sourcesByMessageId).map(([messageId, sources]) => [
        messageId,
        sources.map(toPublicSource),
      ]),
    ),
  });
}

/** PATCH /api/threads/[threadId] — rename, save/unsave, move to space. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { threadId } = await params;
  if (!idSchema.safeParse(threadId).success) {
    return apiError("bad_request", "Invalid thread id.");
  }
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Body must be JSON.");
  }
  const parsed = updateThreadSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const store = await getStore();
  // Moving into a space requires owning that space.
  if (parsed.data.spaceId) {
    const space = await store.getSpace(parsed.data.spaceId, identity);
    if (!space) return apiError("not_found", "Workspace not found.");
  }
  const updated = await store.updateThread(threadId, identity, parsed.data);
  if (!updated) return apiError("not_found", "Thread not found.");
  return NextResponse.json({ thread: updated });
}

/** DELETE /api/threads/[threadId] */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { threadId } = await params;
  if (!idSchema.safeParse(threadId).success) {
    return apiError("bad_request", "Invalid thread id.");
  }
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  const store = await getStore();
  const deleted = await store.deleteThread(threadId, identity);
  if (!deleted) return apiError("not_found", "Thread not found.");
  return NextResponse.json({ deleted: true });
}
