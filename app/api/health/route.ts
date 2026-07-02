import { NextResponse } from "next/server";
import { ConfigError, getEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = getEnv();
    return NextResponse.json({
      status: "ok",
      demoMode: env.DEMO_MODE,
      searchProvider: env.DEMO_MODE ? "mock" : env.SEARCH_PROVIDER,
      persistence: env.SUPABASE_ENABLED && !env.DEMO_MODE ? "supabase" : "memory",
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
