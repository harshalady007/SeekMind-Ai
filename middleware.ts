import { NextResponse, type NextRequest } from "next/server";

const ANON_COOKIE = "df_anon";

function randomAnonId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `anon_${base64}`;
}

/**
 * Ensures every visitor has an anonymous session cookie (used for the free
 * search allowance and anonymous thread ownership) and refreshes the
 * Supabase auth session when Supabase is configured.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const demoMode = process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === "1";

  if (supabaseUrl && supabaseKey && !demoMode) {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    // Refresh the session if needed; result is intentionally unused here.
    await supabase.auth.getUser();
  }

  if (!request.cookies.get(ANON_COOKIE)) {
    response.cookies.set(ANON_COOKIE, randomAnonId(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
