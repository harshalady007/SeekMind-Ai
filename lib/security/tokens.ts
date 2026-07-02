import { randomBytes, createHash } from "node:crypto";

/**
 * Cryptographically secure, URL-safe share token.
 * 24 random bytes → 32 base64url chars ≈ 192 bits of entropy.
 */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Anonymous session identifier (opaque, unguessable). */
export function generateAnonymousSessionId(): string {
  return `anon_${randomBytes(18).toString("base64url")}`;
}

/** Constant shape check so lookups can reject junk before hitting the store. */
export function isPlausibleShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

/** Hash used for anonymous-session fingerprints; never store raw values. */
export function fingerprintHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
