import { getEnv } from "@/lib/config/env";
import { ConcurrencyGate, DailyLimiter, SlidingWindowLimiter } from "./limiter";

/** Requests per IP per minute across all API endpoints that opt in. */
const IP_REQUESTS_PER_MINUTE = 60;

interface Limiters {
  ipGeneral: SlidingWindowLimiter;
  ipSearch: SlidingWindowLimiter;
  userDaily: DailyLimiter;
  concurrency: ConcurrencyGate;
}

const globalLimiters = globalThis as unknown as { __deepfindLimiters?: Limiters };

export function getLimiters(): Limiters {
  if (!globalLimiters.__deepfindLimiters) {
    const env = getEnv();
    globalLimiters.__deepfindLimiters = {
      ipGeneral: new SlidingWindowLimiter(IP_REQUESTS_PER_MINUTE),
      ipSearch: new SlidingWindowLimiter(env.SEARCHES_PER_MINUTE_PER_IP),
      userDaily: new DailyLimiter(env.DAILY_USER_SEARCH_LIMIT),
      concurrency: new ConcurrencyGate(env.MAX_CONCURRENT_SEARCHES),
    };
  }
  return globalLimiters.__deepfindLimiters;
}
