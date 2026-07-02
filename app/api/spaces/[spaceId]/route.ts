import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIdentity } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { apiError, zodErrorResponse } from "@/lib/api/respond";
import { updateSpaceSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
type Params = { params: Promise<{ spaceId: string }> };

/** GET /api/spaces/[spaceId] — workspace detail with its threads. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { spaceId } = await params;
  if (!idSchema.safeParse(spaceId).success) {
    return apiError("bad_request", "Invalid workspace id.");
  }
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  const store = await getStore();
  const space = await store.getSpace(spaceId, identity);
  if (!space) return apiError("not_found", "Workspace not found.");
  const { threads } = await store.listThreads(identity, { spaceId, limit: 100 });
  return NextResponse.json({ space, threads });
}

/** PATCH /api/spaces/[spaceId] — rename / edit description or instructions. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { spaceId } = await params;
  if (!idSchema.safeParse(spaceId).success) {
    return apiError("bad_request", "Invalid workspace id.");
  }
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Body must be JSON.");
  }
  const parsed = updateSpaceSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const store = await getStore();
  const updated = await store.updateSpace(spaceId, identity, parsed.data);
  if (!updated) return apiError("not_found", "Workspace not found.");
  return NextResponse.json({ space: updated });
}

/** DELETE /api/spaces/[spaceId] — delete workspace (threads are detached). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { spaceId } = await params;
  if (!idSchema.safeParse(spaceId).success) {
    return apiError("bad_request", "Invalid workspace id.");
  }
  const identity = await getIdentity();
  if (!identity) return apiError("unauthorized", "No session.");

  const store = await getStore();
  const deleted = await store.deleteSpace(spaceId, identity);
  if (!deleted) return apiError("not_found", "Workspace not found.");
  return NextResponse.json({ deleted: true });
}
