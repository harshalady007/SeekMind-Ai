"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Only the public URL + anon key are exposed here;
 * all privileged operations stay server-side.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
