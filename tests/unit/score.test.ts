import { describe, expect, it } from "vitest";
import type { SearchResult } from "@/lib/core/types";
import {
  domainQualityScore,
  filterResults,
  keywordOverlapScore,
  recencyScore,
  scoreResults,
} from "@/lib/retrieval/score";

const result = (overrides: Partial<SearchResult>): SearchResult => ({
  url: "https://example.com/a",
  title: "Title",
  snippet: "Snippet",
  ...overrides,
});

describe("domainQualityScore", () => {
  it("ranks government and academic domains above generic ones", () => {
    expect(domainQualityScore("energy.gov")).toBeGreaterThan(
      domainQualityScore("randomblog.com"),
    );
    expect(domainQualityScore("mit.edu")).toBeGreaterThan(
      domainQualityScore("randomblog.com"),
    );
    expect(domainQualityScore("arxiv.org")).toBeGreaterThan(0.9);
  });
});

describe("keywordOverlapScore", () => {
  it("returns the fraction of query tokens found in the doc", () => {
    const r = result({ title: "solid state batteries", snippet: "for EVs" });
    expect(keywordOverlapScore("solid state batteries", r)).toBe(1);
    expect(keywordOverlapScore("quantum computing hardware", r)).toBe(0);
  });
});

describe("recencyScore", () => {
  const now = new Date("2026-07-01T00:00:00Z");
  it("decays with age by half-life", () => {
    const fresh = recencyScore("2026-06-30T00:00:00Z", 3, now);
    const stale = recencyScore("2026-06-01T00:00:00Z", 3, now);
    expect(fresh).toBeGreaterThan(stale);
    expect(recencyScore("2026-06-28T00:00:00Z", 3, now)).toBeCloseTo(0.5, 1);
  });
  it("returns neutral 0.3 for unknown dates", () => {
    expect(recencyScore(null, 3, now)).toBe(0.3);
    expect(recencyScore("garbage", 3, now)).toBe(0.3);
  });
});

describe("filterResults", () => {
  it("drops blocked domains and irrelevant results", () => {
    const kept = filterResults("solid state batteries", [
      result({ url: "https://pinterest.com/pin/1", title: "solid state batteries" }),
      result({ title: "solid state batteries explained" }),
      result({ title: "cake recipes", snippet: "flour and sugar", providerScore: 0.01 }),
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.title).toBe("solid state batteries explained");
  });
});

describe("scoreResults", () => {
  const now = new Date("2026-07-01T00:00:00Z");

  it("sorts by final score descending", () => {
    const scored = scoreResults(
      "battery research",
      [
        result({
          url: "https://randomblog.com/a",
          title: "battery research",
          providerScore: 0.5,
        }),
        result({
          url: "https://energy.gov/b",
          title: "battery research overview",
          providerScore: 0.9,
          publishedAt: "2026-06-20T00:00:00Z",
        }),
      ],
      "quick",
      now,
    );
    expect(scored[0]?.result.url).toBe("https://energy.gov/b");
    expect(scored[0]?.finalScore).toBeGreaterThan(scored[1]?.finalScore ?? 1);
  });

  it("weights recency more heavily in news mode", () => {
    const fresh = result({
      url: "https://a.com/fresh",
      title: "event coverage update",
      providerScore: 0.6,
      publishedAt: "2026-06-30T22:00:00Z",
    });
    const stale = result({
      url: "https://b.com/stale",
      title: "event coverage update analysis",
      providerScore: 0.7,
      publishedAt: "2026-05-01T00:00:00Z",
    });
    const news = scoreResults("event coverage", [stale, fresh], "news", now);
    expect(news[0]?.result.url).toBe("https://a.com/fresh");
  });
});
