import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/config/env";

/**
 * Request-scoped Supabase client using the anon key + the caller's cookies,
 * so every query runs under Row Level Security as the signed-in user.
 */
export async function createSupabaseServerClient() {
  const env = getEnv();
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Server-only, bypasses RLS — used exclusively for
 * operations that RLS cannot express (anonymous-session thread access),
 * always paired with explicit ownership checks in the store layer.
 */
export function createSupabaseServiceClient<Db = unknown>() {
  const env = getEnv();
  return createClient<Db>(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
