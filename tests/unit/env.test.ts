import { describe, expect, it } from "vitest";
import { ConfigError, parseEnv } from "@/lib/config/env";

const demoBase = { DEMO_MODE: "true" };

describe("parseEnv", () => {
  it("accepts demo mode with no external keys", () => {
    const env = parseEnv(demoBase);
    expect(env.DEMO_MODE).toBe(true);
    expect(env.SUPABASE_ENABLED).toBe(false);
    expect(env.ANONYMOUS_SEARCH_LIMIT).toBe(5);
    expect(env.SEARCH_TIMEOUT_MS).toBe(15_000);
  });

  it("requires DEEPSEEK_API_KEY outside demo mode", () => {
    expect(() => parseEnv({ TAVILY_API_KEY: "t" })).toThrow(ConfigError);
    expect(() => parseEnv({ TAVILY_API_KEY: "t" })).toThrow(/DEEPSEEK_API_KEY/);
  });

  it("requires TAVILY_API_KEY when the tavily provider is active", () => {
    expect(() => parseEnv({ DEEPSEEK_API_KEY: "a" })).toThrow(/TAVILY_API_KEY/);
  });

  it("allows the mock search provider without a Tavily key", () => {
    const env = parseEnv({ DEEPSEEK_API_KEY: "a", SEARCH_PROVIDER: "mock" });
    expect(env.SEARCH_PROVIDER).toBe("mock");
  });

  it("rejects partial Supabase configuration", () => {
    expect(() =>
      parseEnv({ ...demoBase, NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" }),
    ).toThrow(/partially configured/);
  });

  it("enables Supabase when all three variables are present", () => {
    const env = parseEnv({
      ...demoBase,
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
    expect(env.SUPABASE_ENABLED).toBe(true);
  });

  it("rejects non-integer or out-of-range limits with a readable error", () => {
    expect(() => parseEnv({ ...demoBase, DAILY_USER_SEARCH_LIMIT: "abc" })).toThrow(
      /DAILY_USER_SEARCH_LIMIT/,
    );
    expect(() => parseEnv({ ...demoBase, SEARCH_TIMEOUT_MS: "50" })).toThrow(ConfigError);
  });

  it("parses numeric overrides", () => {
    const env = parseEnv({
      ...demoBase,
      ANONYMOUS_SEARCH_LIMIT: "3",
      RESEARCH_MAX_QUERIES: "5",
    });
    expect(env.ANONYMOUS_SEARCH_LIMIT).toBe(3);
    expect(env.RESEARCH_MAX_QUERIES).toBe(5);
  });
});
