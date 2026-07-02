import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIdentity } from "@/lib/auth/session";
import { getEnv } from "@/lib/config/env";
import { getStore } from "@/lib/db";
import { apiError } from "@/lib/api/respond";
import { generateShareToken } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
type Params = { params: Promise<{ threadId: string }> };

/** POST /api/threads/[threadId]/share — make public with a secure token. */
export async function POST(_request: NextRequest, { params }: Params) {
  const { threadId } = await params;
  if (!idSchema.safeParse(threadId).success) {
    return apiError("bad_request", "Invalid thread id.");
  }
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  const store = await getStore();
  const existing = await store.getThread(threadId, identity);
  if (!existing) return apiError("not_found", "Thread not found.");

  const shareToken = existing.shareToken ?? generateShareToken();
  const updated = await store.updateThread(threadId, identity, {
    isPublic: true,
    shareToken,
  });
  if (!updated) return apiError("not_found", "Thread not found.");

  const env = getEnv();
  return NextResponse.json({
    shareToken,
    shareUrl: `${env.NEXT_PUBLIC_APP_URL}/share/${shareToken}`,
  });
}

/** DELETE /api/threads/[threadId]/share — unshare (rotates the token away). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { threadId } = await params;
  if (!idSchema.safeParse(threadId).success) {
    return apiError("bad_request", "Invalid thread id.");
  }
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  const store = await getStore();
  const updated = await store.updateThread(threadId, identity, {
    isPublic: false,
    shareToken: null,
  });
  if (!updated) return apiError("not_found", "Thread not found.");
  return NextResponse.json({ shared: false });
}
