import { describe, expect, it } from "vitest";
import { dedupeResults, jaccard } from "@/lib/retrieval/dedupe";
import type { SearchResult } from "@/lib/core/types";

const result = (url: string, title: string): SearchResult => ({
  url,
  title,
  snippet: "snippet",
});

describe("dedupeResults", () => {
  it("removes exact canonical URL duplicates, keeping the first", () => {
    const results = dedupeResults([
      result("https://www.example.com/a?utm_source=x", "First copy"),
      result("http://example.com/a/", "Second copy of totally different title"),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("First copy");
  });

  it("removes near-duplicate titles from different domains", () => {
    const results = dedupeResults([
      result("https://a.com/1", "Solid-state batteries edge closer to commercial EVs"),
      result("https://b.com/2", "Solid-state batteries edge closer to commercial EVs"),
      result("https://c.com/3", "A completely different story about coral reefs"),
    ]);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.url)).toEqual(["https://a.com/1", "https://c.com/3"]);
  });

  it("drops results with invalid URLs", () => {
    const results = dedupeResults([
      result("javascript:alert(1)", "Bad"),
      result("https://ok.com/x", "Good"),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe("https://ok.com/x");
  });
});

describe("jaccard", () => {
  it("is 1 for identical sets and 0 for disjoint sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
});
