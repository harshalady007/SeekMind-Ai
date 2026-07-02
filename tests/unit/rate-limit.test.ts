import { describe, expect, it } from "vitest";
import {
  ConcurrencyGate,
  DailyLimiter,
  SlidingWindowLimiter,
} from "@/lib/rate-limit/limiter";

describe("SlidingWindowLimiter", () => {
  it("allows up to the limit then blocks with retry-after", () => {
    const limiter = new SlidingWindowLimiter(2, 60_000);
    const t0 = 1_000_000;
    expect(limiter.check("ip", t0).allowed).toBe(true);
    expect(limiter.check("ip", t0 + 1).allowed).toBe(true);
    const blocked = limiter.check("ip", t0 + 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("frees capacity once the window slides past", () => {
    const limiter = new SlidingWindowLimiter(1, 60_000);
    const t0 = 1_000_000;
    expect(limiter.check("ip", t0).allowed).toBe(true);
    expect(limiter.check("ip", t0 + 30_000).allowed).toBe(false);
    expect(limiter.check("ip", t0 + 60_001).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = new SlidingWindowLimiter(1, 60_000);
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("b", 0).allowed).toBe(true);
  });
});

describe("DailyLimiter", () => {
  it("blocks after the daily quota and resets next UTC day", () => {
    const limiter = new DailyLimiter(2);
    const day1 = Date.parse("2026-07-01T10:00:00Z");
    expect(limiter.check("u", day1).allowed).toBe(true);
    expect(limiter.check("u", day1).allowed).toBe(true);
    const blocked = limiter.check("u", day1);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(14 * 3600);
    const day2 = Date.parse("2026-07-02T00:00:01Z");
    expect(limiter.check("u", day2).allowed).toBe(true);
  });

  it("reports used counts", () => {
    const limiter = new DailyLimiter(5);
    const now = Date.parse("2026-07-01T10:00:00Z");
    limiter.check("u", now);
    limiter.check("u", now);
    expect(limiter.used("u", now)).toBe(2);
  });
});

describe("ConcurrencyGate", () => {
  it("caps concurrent acquisitions per key and releases correctly", () => {
    const gate = new ConcurrencyGate(2);
    expect(gate.tryAcquire("u")).toBe(true);
    expect(gate.tryAcquire("u")).toBe(true);
    expect(gate.tryAcquire("u")).toBe(false);
    gate.release("u");
    expect(gate.tryAcquire("u")).toBe(true);
    gate.release("u");
    gate.release("u");
    expect(gate.activeCount("u")).toBe(0);
  });
});
