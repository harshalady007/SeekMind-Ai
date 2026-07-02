import type { NextRequest } from "next/server";
import { getIdentity } from "@/lib/auth/session";
import { getEnv, ConfigError } from "@/lib/config/env";
import type { SearchStreamEvent } from "@/lib/core/types";
import { getStore } from "@/lib/db";
import {
  cancelSearch as _cancel,
  completeSearch,
  identityKeyOf,
  registerSearch,
} from "@/lib/orchestrator/cancel-registry";
import { runSearch } from "@/lib/orchestrator/run-search";
import { getLimiters } from "@/lib/rate-limit";
import { apiError, clientIp, zodErrorResponse } from "@/lib/api/respond";
import { encodeSseEvent } from "@/lib/streaming/events";
import { startSearchSchema } from "@/lib/validation/schemas";
import { logger } from "@/lib/logging/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/search — start a search (new thread, follow-up, or regenerate)
 * and stream typed SSE events back. Cancellation: the client aborts the
 * fetch (observed via request.signal) or POSTs /api/search/cancel.
 */
export async function POST(request: NextRequest) {
  let env;
  try {
    env = getEnv();
  } catch (err) {
    if (err instanceof ConfigError) {
      return apiError("config_error", err.message);
    }
    throw err;
  }

  const identity = await getIdentity();
  if (!identity) {
    return apiError("unauthorized", "No session. Enable cookies and reload.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("bad_request", "Body must be JSON.");
  }
  const parsed = startSearchSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const input = parsed.data;

  // ── Usage controls ────────────────────────────────────────────────────
  const limiters = getLimiters();
  const ip = clientIp(request);
  const ipCheck = limiters.ipSearch.check(`search:${ip}`);
  if (!ipCheck.allowed) {
    return apiError(
      "rate_limited",
      "Too many searches from this network. Slow down a little.",
      {
        retryAfterSeconds: ipCheck.retryAfterSeconds,
      },
    );
  }

  const identityKey = identityKeyOf(identity);
  const store = await getStore();

  if (identity.kind === "anonymous") {
    const used = await store.countAnonymousSearches(identity.sessionId);
    if (used >= env.ANONYMOUS_SEARCH_LIMIT) {
      return apiError(
        "anonymous_limit_reached",
        "You've used all free searches. Sign in to keep searching with history.",
        { limit: env.ANONYMOUS_SEARCH_LIMIT },
      );
    }
  } else {
    const daily = limiters.userDaily.check(identityKey);
    if (!daily.allowed) {
      return apiError(
        "daily_limit_reached",
        "Daily search limit reached. It resets at midnight UTC.",
        { retryAfterSeconds: daily.retryAfterSeconds },
      );
    }
  }

  if (!limiters.concurrency.tryAcquire(identityKey)) {
    return apiError(
      "too_many_concurrent",
      "Too many searches running at once. Wait for one to finish.",
    );
  }

  // ── Stream ────────────────────────────────────────────────────────────
  const controller = new AbortController();
  registerSearch(input.searchId, identityKey, controller);
  const abortFromClient = () => controller.abort();
  request.signal.addEventListener("abort", abortFromClient, { once: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const send = (event: SearchStreamEvent) => {
        try {
          streamController.enqueue(encoder.encode(encodeSseEvent(event)));
        } catch {
          // Stream already closed by the client; orchestrator will observe abort.
        }
      };
      try {
        for await (const event of runSearch({
          identity,
          input,
          signal: controller.signal,
        })) {
          send(event);
        }
      } catch (err) {
        logger.error("search_stream_crashed", {
          message: err instanceof Error ? err.name : "unknown",
        });
        send({
          type: "error",
          code: "internal_error",
          message: "Something went wrong. Please try again.",
        });
      } finally {
        limiters.concurrency.release(identityKey);
        completeSearch(input.searchId);
        request.signal.removeEventListener("abort", abortFromClient);
        try {
          streamController.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
