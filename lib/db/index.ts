import { getEnv } from "@/lib/config/env";
import { MemoryStore } from "./memory";
import type { DataStore } from "./store";

/**
 * Store selection. The memory store is kept on globalThis so Next.js dev-mode
 * module reloads and separate route bundles share one instance.
 */
const globalStore = globalThis as unknown as { __deepfindMemoryStore?: MemoryStore };

export function getMemoryStore(): MemoryStore {
  if (!globalStore.__deepfindMemoryStore) {
    globalStore.__deepfindMemoryStore = new MemoryStore();
  }
  return globalStore.__deepfindMemoryStore;
}

export async function getStore(): Promise<DataStore> {
  const env = getEnv();
  if (!env.SUPABASE_ENABLED || env.DEMO_MODE) {
    return getMemoryStore();
  }
  const { getSupabaseStore } = await import("./supabase-store");
  return getSupabaseStore();
}
