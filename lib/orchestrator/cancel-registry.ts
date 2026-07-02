/**
 * In-flight search registry so an explicit cancel request (e.g. from another
 * tab, or a stop button that outlives the fetch) can abort server-side work.
 * Keyed by the client-generated searchId; entries record the owning identity
 * key so one user cannot cancel another's search.
 */

interface RegistryEntry {
  controller: AbortController;
  identityKey: string;
  startedAt: number;
}

const globalRegistry = globalThis as unknown as {
  __deepfindCancelRegistry?: Map<string, RegistryEntry>;
};

function registry(): Map<string, RegistryEntry> {
  if (!globalRegistry.__deepfindCancelRegistry) {
    globalRegistry.__deepfindCancelRegistry = new Map();
  }
  return globalRegistry.__deepfindCancelRegistry;
}

export function registerSearch(
  searchId: string,
  identityKey: string,
  controller: AbortController,
): void {
  registry().set(searchId, { controller, identityKey, startedAt: Date.now() });
  // Sweep stale entries (defensive; normal path removes them on completion).
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, entry] of registry()) {
    if (entry.startedAt < cutoff) registry().delete(key);
  }
}

export function completeSearch(searchId: string): void {
  registry().delete(searchId);
}

/** Abort a search if it exists and belongs to the caller. */
export function cancelSearch(searchId: string, identityKey: string): boolean {
  const entry = registry().get(searchId);
  if (!entry || entry.identityKey !== identityKey) return false;
  entry.controller.abort();
  registry().delete(searchId);
  return true;
}

export function identityKeyOf(identity: {
  kind: string;
  userId?: string;
  sessionId?: string;
}): string {
  return identity.kind === "user"
    ? `user:${identity.userId}`
    : `anon:${identity.sessionId}`;
}
