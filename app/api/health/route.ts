import { NextResponse } from "next/server";
import { ConfigError, getEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = getEnv();
    const usingSupabase = env.SUPABASE_ENABLED && !env.DEMO_MODE;

    // When Supabase is the store, verify the schema is actually reachable so
    // missing migrations / bad keys surface here instead of as opaque 500s.
    let database:
      { status: "ok" } | { status: "error"; message: string; hint: string } | undefined;
    if (usingSupabase) {
      try {
        const { createSupabaseServiceClient } =
          await import("@/lib/auth/supabase-server");
        const client = createSupabaseServiceClient<import("@/lib/db/types").Database>();
        const { error } = await client
          .from("threads")
          .select("id", { count: "exact", head: true });
        database = error
          ? {
              status: "error",
              message: error.message,
              hint: "If tables are missing, run supabase/migrations/0001_init.sql and 0002_rls.sql against this project (see docs/DEPLOYMENT.md). Also confirm SUPABASE_SERVICE_ROLE_KEY is the service_role key, not the anon key.",
            }
          : { status: "ok" };
      } catch (err) {
        database = {
          status: "error",
          message: err instanceof Error ? err.message : "unreachable",
          hint: "Supabase could not be reached with the configured URL/keys.",
        };
      }
    }

    return NextResponse.json({
      status: database?.status === "error" ? "degraded" : "ok",
      demoMode: env.DEMO_MODE,
      searchProvider: env.DEMO_MODE ? "mock" : env.SEARCH_PROVIDER,
      persistence: usingSupabase ? "supabase" : "memory",
      ...(database ? { database } : {}),
      time: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      return NextResponse.json(
        { status: "config_error", message: err.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
