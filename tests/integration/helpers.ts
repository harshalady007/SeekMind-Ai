import { resetEnvCache } from "@/lib/config/env";
import type { Identity } from "@/lib/core/types";
import { MemoryStore } from "@/lib/db/memory";
import { resetAnswerProviderCache } from "@/lib/ai";
import { resetSearchProviderCache } from "@/lib/search";

/** Configure a clean demo-mode environment with a fresh in-memory store. */
export function setupDemoEnvironment(overrides: Record<string, string> = {}): void {
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("NEXT_PUBLIC_SUPABASE") ||
      [
        "SUPABASE_SERVICE_ROLE_KEY",
        "DEEPSEEK_API_KEY",
        "TAVILY_API_KEY",
        "DEMO_MODE",
        "SEARCH_PROVIDER",
        "ANONYMOUS_SEARCH_LIMIT",
        "DAILY_USER_SEARCH_LIMIT",
        "RESEARCH_MAX_ITERATIONS",
        "RESEARCH_MAX_QUERIES",
      ].includes(key)
    ) {
      delete process.env[key];
    }
  }
  process.env.DEMO_MODE = "true";
  Object.assign(process.env, overrides);
  resetEnvCache();
  resetAnswerProviderCache();
  resetSearchProviderCache();
  (globalThis as { __deepfindMemoryStore?: MemoryStore }).__deepfindMemoryStore =
    new MemoryStore();
}

export function getTestStore(): MemoryStore {
  return (globalThis as { __deepfindMemoryStore?: MemoryStore })
    .__deepfindMemoryStore as MemoryStore;
}

export const userA = {
  kind: "user",
  userId: "demo_userA0001",
  email: "a@x.io",
} as const satisfies Identity;
export const userB = {
  kind: "user",
  userId: "demo_userB0001",
  email: "b@x.io",
} as const satisfies Identity;
export const anonA = {
  kind: "anonymous",
  sessionId: "anon_sessionA001",
} as const satisfies Identity;
export const anonB = {
  kind: "anonymous",
  sessionId: "anon_sessionB001",
} as const satisfies Identity;
