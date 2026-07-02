import { describe, expect, it } from "vitest";
import { processResults } from "@/lib/retrieval/pipeline";
import { extractDoi, isAcademicDomain, selectSources } from "@/lib/retrieval/select";
import { scoreResults } from "@/lib/retrieval/score";
import { findEvidenceGaps } from "@/lib/orchestrator/run-search";
import { FIXTURE_TOPICS } from "@/lib/search/fixtures";
import type { SearchResult } from "@/lib/core/types";

const batteryResults = FIXTURE_TOPICS[0]!.results;

describe("processResults (full pipeline)", () => {
  it("returns ranked sources with stable sequential citation numbers", () => {
    const { sources } = processResults(
      "solid state battery progress",
      batteryResults,
      "quick",
    );
    expect(sources.length).toBeGreaterThanOrEqual(4);
    expect(sources.map((s) => s.citationNumber)).toEqual(sources.map((_, i) => i + 1));
    for (const source of sources) {
      expect(source.canonicalUrl).toMatch(/^https:\/\//);
      expect(source.domain.length).toBeGreaterThan(0);
      expect(source.retrievedAt).toBeTruthy();
    }
  });

  it("deduplicates repeated provider results", () => {
    const doubled = [...batteryResults, ...batteryResults];
    const { sources, consideredCount } = processResults(
      "solid state battery progress",
      doubled,
      "quick",
    );
    expect(consideredCount).toBe(doubled.length);
    const urls = sources.map((s) => s.canonicalUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("respects the mode's max selected sources", () => {
    const many: SearchResult[] = Array.from({ length: 30 }, (_, i) => ({
      url: `https://site${i}.com/battery-article`,
      title: `Battery progress report volume ${i}`,
      snippet: `Battery development analysis part ${i}`,
      providerScore: 0.9 - i * 0.01,
    }));
    const { sources } = processResults("battery progress", many, "quick");
    expect(sources.length).toBeLessThanOrEqual(8);
  });
});

describe("selectSources academic metadata", () => {
  it("marks preprints and extracts DOIs", () => {
    const scored = scoreResults(
      "battery interface engineering study",
      [
        {
          url: "https://arxiv.org/abs/2405.00001",
          title: "Interface engineering study",
          snippet: "See doi 10.1234/abc.123 for details.",
          providerScore: 0.9,
        },
      ],
      "academic",
    );
    const [source] = selectSources(scored, "academic", "battery interface");
    expect(source?.metadata.isPreprint).toBe(true);
    expect(source?.metadata.isAcademic).toBe(true);
    expect(source?.metadata.doi).toBe("10.1234/abc.123");
  });
});

describe("isAcademicDomain / extractDoi", () => {
  it("recognizes academic domains", () => {
    expect(isAcademicDomain("arxiv.org")).toBe(true);
    expect(isAcademicDomain("stanford.edu")).toBe(true);
    expect(isAcademicDomain("ox.ac.uk")).toBe(true);
    expect(isAcademicDomain("buzzfeed.com")).toBe(false);
  });
  it("extracts DOIs and trims trailing punctuation", () => {
    expect(extractDoi("see 10.1038/s41586-024-0001-2.")).toBe(
      "10.1038/s41586-024-0001-2",
    );
    expect(extractDoi("no doi here")).toBeNull();
  });
});

describe("findEvidenceGaps", () => {
  it("flags subquestions with no keyword coverage", () => {
    const covered = "How close are solid state batteries to commercial production?";
    const uncovered = "What about quantum entanglement teleportation?";
    const gaps = findEvidenceGaps([covered, uncovered], batteryResults);
    expect(gaps).toContain(uncovered);
    expect(gaps).not.toContain(covered);
  });

  it("returns no gaps when everything is covered", () => {
    expect(findEvidenceGaps([], batteryResults)).toEqual([]);
  });
});
