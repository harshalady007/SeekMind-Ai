import { z } from "zod";

/**
 * Server-side environment configuration, validated once at first access.
 * Fails fast with a readable message listing every problem instead of
 * surfacing obscure runtime errors later.
 */

const booleanString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const intWithDefault = (def: number, min = 1, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === "") return def;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({
          code: "custom",
          message: `must be an integer between ${min} and ${max}`,
        });
        return z.NEVER;
      }
      return n;
    });

const envSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: z.string().url().optional().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().optional().default("claude-sonnet-5"),
    TAVILY_API_KEY: z.string().optional(),
    SEARCH_PROVIDER: z.enum(["tavily", "mock"]).optional().default("tavily"),
    DEMO_MODE: booleanString,
    ANONYMOUS_SEARCH_LIMIT: intWithDefault(5, 0, 10_000),
    DAILY_USER_SEARCH_LIMIT: intWithDefault(50, 1, 100_000),
    MAX_CONCURRENT_SEARCHES: intWithDefault(2, 1, 100),
    SEARCHES_PER_MINUTE_PER_IP: intWithDefault(10, 1, 10_000),
    SEARCH_TIMEOUT_MS: intWithDefault(15_000, 1_000, 120_000),
    RESEARCH_MAX_ITERATIONS: intWithDefault(3, 1, 10),
    RESEARCH_MAX_QUERIES: intWithDefault(8, 1, 30),
  })
  .superRefine((env, ctx) => {
    if (!env.DEMO_MODE) {
      if (!env.ANTHROPIC_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["ANTHROPIC_API_KEY"],
          message: "required when DEMO_MODE is not enabled",
        });
      }
      if (env.SEARCH_PROVIDER === "tavily" && !env.TAVILY_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["TAVILY_API_KEY"],
          message: 'required when SEARCH_PROVIDER is "tavily" and DEMO_MODE is off',
        });
      }
    }
    const supabaseVars = [
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
    ];
    const set = supabaseVars.filter((v) => v && v.length > 0).length;
    if (set > 0 && set < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message:
          "Supabase is partially configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY together, or none of them.",
      });
    }
  });

export type Env = z.infer<typeof envSchema> & {
  /** True when Supabase persistence + auth are available. */
  SUPABASE_ENABLED: boolean;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new ConfigError(
      `Invalid environment configuration:\n${lines.join("\n")}\n` +
        "See .env.example for documentation of every variable.",
    );
  }
  const env = parsed.data;
  return {
    ...env,
    SUPABASE_ENABLED: Boolean(
      env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}

let cached: Env | null = null;

/** Validated environment. Throws ConfigError with a readable report if invalid. */
export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Test-only: reset the cached env so tests can vary process.env. */
export function resetEnvCache(): void {
  cached = null;
}
