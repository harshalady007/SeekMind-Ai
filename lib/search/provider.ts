import type { NewsTimeRange, SearchMode, SearchResult } from "@/lib/core/types";

export interface SearchRequest {
  query: string;
  mode: SearchMode;
  maxResults: number;
  /** Only for news mode. */
  timeRange?: NewsTimeRange;
  signal?: AbortSignal;
}

export interface SearchProvider {
  readonly name: string;
  search(input: SearchRequest): Promise<SearchResult[]>;
}

/** Typed provider errors so the orchestrator can decide on retry/fallback. */
export type ProviderErrorKind =
  "timeout" | "rate_limited" | "auth" | "transient" | "fatal";

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly provider: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  get retryable(): boolean {
    return (
      this.kind === "timeout" || this.kind === "rate_limited" || this.kind === "transient"
    );
  }
}

/**
 * Run `fn` with retry for transient failures: exponential backoff (500ms,
 * 1s, 2s), small cap, no retry for auth/fatal errors or aborts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 2,
    baseDelayMs = 500,
    signal,
  }: { retries?: number; baseDelayMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ProviderError ? err.retryable : false;
      if (!retryable || attempt === retries) throw err;
      await sleep(baseDelayMs * 2 ** attempt, signal);
    }
  }
  throw lastError;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
