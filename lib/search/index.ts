import { getEnv } from "@/lib/config/env";
import { MockSearchProvider } from "./mock";
import type { SearchProvider } from "./provider";
import { TavilySearchProvider } from "./tavily";

let cached: SearchProvider | null = null;

/**
 * Active search provider, selected from validated env config.
 * Demo mode always uses the deterministic mock provider.
 * A BraveSearchProvider can slot in here behind the same interface.
 */
export function getSearchProvider(): SearchProvider {
  if (cached) return cached;
  const env = getEnv();
  if (env.DEMO_MODE || env.SEARCH_PROVIDER === "mock") {
    cached = new MockSearchProvider();
  } else {
    cached = new TavilySearchProvider({
      apiKey: env.TAVILY_API_KEY ?? "",
      timeoutMs: env.SEARCH_TIMEOUT_MS,
    });
  }
  return cached;
}

/** Test-only. */
export function resetSearchProviderCache(): void {
  cached = null;
}
