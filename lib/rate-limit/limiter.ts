/**
 * In-memory usage limits. Honest scope: these protect a single server
 * instance against accidental overuse and casual abuse. They are NOT robust
 * bot protection and reset on deploy/restart; a shared store (Redis/Upstash)
 * behind this same interface is the production-hardening path for
 * multi-instance deployments. Documented in docs/SECURITY.md.
 */

interface WindowEntry {
  timestamps: number[];
}

const WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class SlidingWindowLimiter {
  private entries = new Map<string, WindowEntry>();

  constructor(
    private readonly maxPerWindow: number,
    private readonly windowMs: number = WINDOW_MS,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    const entry = this.entries.get(key) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
    if (entry.timestamps.length >= this.maxPerWindow) {
      const oldest = entry.timestamps[0] ?? now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)),
      };
    }
    entry.timestamps.push(now);
    this.entries.set(key, entry);
    // Opportunistic cleanup to bound memory.
    if (this.entries.size > 10_000) {
      for (const [k, v] of this.entries) {
        if (v.timestamps.every((t) => now - t >= this.windowMs)) this.entries.delete(k);
      }
    }
    return {
      allowed: true,
      remaining: this.maxPerWindow - entry.timestamps.length,
      retryAfterSeconds: 0,
    };
  }
}

/** Daily counter keyed by (key, UTC day). */
export class DailyLimiter {
  private counts = new Map<string, number>();

  constructor(private readonly maxPerDay: number) {}

  private dayKey(key: string, now: number): string {
    return `${key}:${new Date(now).toISOString().slice(0, 10)}`;
  }

  used(key: string, now: number = Date.now()): number {
    return this.counts.get(this.dayKey(key, now)) ?? 0;
  }

  check(key: string, now: number = Date.now()): RateLimitResult {
    const dk = this.dayKey(key, now);
    const used = this.counts.get(dk) ?? 0;
    if (used >= this.maxPerDay) {
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil((midnight.getTime() - now) / 1000),
      };
    }
    this.counts.set(dk, used + 1);
    if (this.counts.size > 50_000) {
      const today = new Date(now).toISOString().slice(0, 10);
      for (const k of this.counts.keys()) {
        if (!k.endsWith(today)) this.counts.delete(k);
      }
    }
    return { allowed: true, remaining: this.maxPerDay - used - 1, retryAfterSeconds: 0 };
  }
}

/** Tracks in-flight searches per identity to cap concurrency. */
export class ConcurrencyGate {
  private active = new Map<string, number>();

  constructor(private readonly max: number) {}

  tryAcquire(key: string): boolean {
    const current = this.active.get(key) ?? 0;
    if (current >= this.max) return false;
    this.active.set(key, current + 1);
    return true;
  }

  release(key: string): void {
    const current = this.active.get(key) ?? 0;
    if (current <= 1) this.active.delete(key);
    else this.active.set(key, current - 1);
  }

  activeCount(key: string): number {
    return this.active.get(key) ?? 0;
  }
}
