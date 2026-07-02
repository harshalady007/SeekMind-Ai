import { describe, expect, it } from "vitest";
import {
  normalizeDate,
  normalizeQuery,
  normalizeResult,
  tokenize,
  MAX_QUERY_LENGTH,
} from "@/lib/retrieval/normalize";

describe("normalizeQuery", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeQuery("  what   is\n\tthis  ")).toBe("what is this");
  });
  it("strips control characters", () => {
    expect(normalizeQuery(`a${String.fromCharCode(0)}b${String.fromCharCode(7)}c`)).toBe(
      "a b c",
    );
  });
  it("clamps to the maximum length", () => {
    expect(normalizeQuery("x".repeat(MAX_QUERY_LENGTH + 500))?.length).toBe(
      MAX_QUERY_LENGTH,
    );
  });
  it("returns null for empty input", () => {
    expect(normalizeQuery("   \n ")).toBeNull();
  });
});

describe("normalizeDate", () => {
  it("parses valid dates to ISO", () => {
    expect(normalizeDate("2026-01-15")).toBe("2026-01-15T00:00:00.000Z");
  });
  it("rejects garbage, ancient and far-future dates", () => {
    expect(normalizeDate("not a date")).toBeNull();
    expect(normalizeDate("1980-01-01")).toBeNull();
    expect(normalizeDate(new Date(Date.now() + 30 * 86400_000).toISOString())).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
});

describe("normalizeResult", () => {
  it("cleans fields and clamps provider score", () => {
    const normalized = normalizeResult({
      url: "https://example.com",
      title: "  A  title  with   spaces ",
      snippet: "s".repeat(3000),
      providerScore: 4,
      publishedAt: "bogus",
      author: "  ",
      content: null,
    });
    expect(normalized.title).toBe("A title with spaces");
    expect(normalized.snippet.length).toBe(1000);
    expect(normalized.providerScore).toBe(1);
    expect(normalized.publishedAt).toBeNull();
    expect(normalized.author).toBeNull();
  });

  it("falls back to url when title is empty", () => {
    const normalized = normalizeResult({
      url: "https://example.com/x",
      title: "  ",
      snippet: "s",
    });
    expect(normalized.title).toBe("https://example.com/x");
  });
});

describe("tokenize", () => {
  it("lowercases, strips punctuation, drops single chars", () => {
    expect(tokenize("The EV's Battery-Pack, 2026!")).toEqual([
      "the",
      "ev",
      "battery",
      "pack",
      "2026",
    ]);
  });
});
