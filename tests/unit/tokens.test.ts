import { describe, expect, it } from "vitest";
import {
  fingerprintHash,
  generateAnonymousSessionId,
  generateShareToken,
  isPlausibleShareToken,
} from "@/lib/security/tokens";

describe("generateShareToken", () => {
  it("produces unique, URL-safe, high-entropy tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateShareToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(30);
      expect(isPlausibleShareToken(token)).toBe(true);
    }
  });
});

describe("isPlausibleShareToken", () => {
  it("rejects short, long and unsafe strings", () => {
    expect(isPlausibleShareToken("short")).toBe(false);
    expect(isPlausibleShareToken("a".repeat(100))).toBe(false);
    expect(isPlausibleShareToken("has spaces in the token here")).toBe(false);
    expect(isPlausibleShareToken("../../../etc/passwd-token")).toBe(false);
  });
});

describe("generateAnonymousSessionId", () => {
  it("matches the format expected by session parsing", () => {
    const id = generateAnonymousSessionId();
    expect(id).toMatch(/^anon_[A-Za-z0-9_-]{8,64}$/);
  });
});

describe("fingerprintHash", () => {
  it("is deterministic and never echoes the input", () => {
    const hash = fingerprintHash("1.2.3.4|ua");
    expect(hash).toBe(fingerprintHash("1.2.3.4|ua"));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("1.2.3.4");
  });
});
