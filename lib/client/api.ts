"use client";

import type {
  MessageRecord,
  PublicSource,
  SpaceRecord,
  ThreadRecord,
} from "@/lib/core/types";

export interface ThreadDetailResponse {
  thread: ThreadRecord & { shareToken: string | null };
  isOwner: boolean;
  messages: MessageRecord[];
  sourcesByMessageId: Record<string, PublicSource[]>;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function handle<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  let code = "internal_error";
  let message = "Request failed.";
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    // keep defaults
  }
  throw new ApiRequestError(code, message);
}

export const api = {
  getThread: (threadId: string) =>
    fetch(`/api/threads/${threadId}`).then((r) => handle<ThreadDetailResponse>(r)),

  listThreads: (params: URLSearchParams) =>
    fetch(`/api/threads?${params.toString()}`).then((r) =>
      handle<{ threads: ThreadRecord[]; nextCursor: string | null }>(r),
    ),

  updateThread: (
    threadId: string,
    patch: { title?: string; isSaved?: boolean; spaceId?: string | null },
  ) =>
    fetch(`/api/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => handle<{ thread: ThreadRecord }>(r)),

  deleteThread: (threadId: string) =>
    fetch(`/api/threads/${threadId}`, { method: "DELETE" }).then((r) =>
      handle<{ deleted: boolean }>(r),
    ),

  shareThread: (threadId: string) =>
    fetch(`/api/threads/${threadId}/share`, { method: "POST" }).then((r) =>
      handle<{ shareToken: string; shareUrl: string }>(r),
    ),

  unshareThread: (threadId: string) =>
    fetch(`/api/threads/${threadId}/share`, { method: "DELETE" }).then((r) =>
      handle<{ shared: boolean }>(r),
    ),

  listSpaces: () =>
    fetch("/api/spaces").then((r) => handle<{ spaces: SpaceRecord[] }>(r)),

  createSpace: (input: {
    name: string;
    description?: string;
    customInstructions?: string;
  }) =>
    fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => handle<{ space: SpaceRecord }>(r)),

  getSpace: (spaceId: string) =>
    fetch(`/api/spaces/${spaceId}`).then((r) =>
      handle<{ space: SpaceRecord; threads: ThreadRecord[] }>(r),
    ),

  updateSpace: (
    spaceId: string,
    patch: { name?: string; description?: string; customInstructions?: string },
  ) =>
    fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => handle<{ space: SpaceRecord }>(r)),

  deleteSpace: (spaceId: string) =>
    fetch(`/api/spaces/${spaceId}`, { method: "DELETE" }).then((r) =>
      handle<{ deleted: boolean }>(r),
    ),
};
