import { describe, expect, it } from "vitest";
import { extractCitedIds, findCitationOccurrences } from "@/lib/citations/extract";
import { stripInvalidCitations, validateCitations } from "@/lib/citations/validate";
import { linkifyCitations } from "@/lib/citations/render";

const sources = [{ citationNumber: 1 }, { citationNumber: 2 }, { citationNumber: 3 }];

describe("extractCitedIds", () => {
  it("returns ids in first-occurrence order without duplicates", () => {
    expect(extractCitedIds("A [2] then [1], again [2] and [3].")).toEqual([2, 1, 3]);
  });
  it("handles adjacent citations like [1][3]", () => {
    expect(extractCitedIds("Claim [1][3].")).toEqual([1, 3]);
  });
  it("ignores non-citation brackets", () => {
    expect(extractCitedIds("array[i] and [notes] and [12ab]")).toEqual([]);
  });
  it("returns empty for no citations", () => {
    expect(extractCitedIds("No citations here.")).toEqual([]);
  });
});

describe("findCitationOccurrences", () => {
  it("reports positions and lengths", () => {
    const occurrences = findCitationOccurrences("x [12] y");
    expect(occurrences).toEqual([{ id: 12, index: 2, length: 4 }]);
  });
});

describe("validateCitations", () => {
  it("passes when every citation maps to a source", () => {
    const result = validateCitations("A [1] and [3].", sources);
    expect(result.valid).toBe(true);
    expect(result.citedIds).toEqual([1, 3]);
    expect(result.invalidIds).toEqual([]);
    expect(result.uncitedSourceIds).toEqual([2]);
  });

  it("flags citations to nonexistent sources", () => {
    const result = validateCitations("A [1] and [7].", sources);
    expect(result.valid).toBe(false);
    expect(result.invalidIds).toEqual([7]);
  });

  it("accepts PublicSource-shaped ids", () => {
    const result = validateCitations("A [4].", [{ id: 4 }]);
    expect(result.valid).toBe(true);
  });

  it("treats an answer with no citations as valid", () => {
    const result = validateCitations("No web claims.", sources);
    expect(result.valid).toBe(true);
    expect(result.uncitedSourceIds).toEqual([1, 2, 3]);
  });
});

describe("stripInvalidCitations", () => {
  it("removes only invalid ids and cleans spacing", () => {
    const repaired = stripInvalidCitations("Fact [1] wrong [9] end [2].", sources);
    expect(repaired).toBe("Fact [1] wrong end [2].");
    expect(validateCitations(repaired, sources).valid).toBe(true);
  });

  it("handles adjacent mixed validity", () => {
    const repaired = stripInvalidCitations("Claim [1][9][2].", sources);
    expect(repaired).toBe("Claim [1][2].");
  });
});

describe("linkifyCitations", () => {
  const valid = new Set([1, 2]);

  it("converts valid citations to anchor links", () => {
    expect(linkifyCitations("Fact [1].", valid)).toBe("Fact [1](#df-source-1).");
  });

  it("leaves unknown ids untouched", () => {
    expect(linkifyCitations("Fact [9].", valid)).toBe("Fact [9].");
  });

  it("does not touch code fences or inline code", () => {
    const md = "Use `arr[1]` here.\n```\nlist[2]\n```\nReal [1].";
    const output = linkifyCitations(md, valid);
    expect(output).toContain("`arr[1]`");
    expect(output).toContain("list[2]\n");
    expect(output).toContain("[1](#df-source-1)");
  });
});
