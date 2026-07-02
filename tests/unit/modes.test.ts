import { describe, expect, it } from "vitest";
import { getModeConfig, MODE_CONFIGS } from "@/lib/config/modes";
import { SEARCH_MODES } from "@/lib/core/types";

describe("mode configuration", () => {
  it("defines a config for every mode", () => {
    for (const mode of SEARCH_MODES) {
      const config = getModeConfig(mode);
      expect(config.maxQueries).toBeGreaterThan(0);
      expect(config.maxSelectedSources).toBeGreaterThanOrEqual(config.minSelectedSources);
      expect(config.totalContextBudgetChars).toBeGreaterThan(
        config.sourceContentBudgetChars,
      );
      expect(config.maxDurationMs).toBeGreaterThan(0);
    }
  });

  it("only research mode is iterative", () => {
    expect(MODE_CONFIGS.research.iterative).toBe(true);
    expect(MODE_CONFIGS.quick.iterative).toBe(false);
    expect(MODE_CONFIGS.academic.iterative).toBe(false);
    expect(MODE_CONFIGS.news.iterative).toBe(false);
  });

  it("news mode weights recency most and uses the news topic", () => {
    const weights = Object.entries(MODE_CONFIGS).map(
      ([mode, c]) => [mode, c.weights.recency] as const,
    );
    const newsRecency = MODE_CONFIGS.news.weights.recency;
    for (const [mode, recency] of weights) {
      if (mode !== "news") expect(newsRecency).toBeGreaterThan(recency);
    }
    expect(MODE_CONFIGS.news.providerTopic).toBe("news");
    expect(MODE_CONFIGS.news.recencyHalfLifeDays).toBeLessThan(30);
  });

  it("academic mode weights source quality most", () => {
    const academic = MODE_CONFIGS.academic.weights;
    expect(academic.sourceQuality).toBeGreaterThan(academic.semanticRelevance);
    expect(academic.sourceQuality).toBeGreaterThan(
      MODE_CONFIGS.quick.weights.sourceQuality,
    );
  });

  it("quick mode stays within the specified retrieval envelope", () => {
    const quick = MODE_CONFIGS.quick;
    expect(quick.maxQueries).toBeLessThanOrEqual(3);
    const maxCandidates = quick.maxQueries * quick.resultsPerQuery;
    expect(maxCandidates).toBeGreaterThanOrEqual(8);
    expect(quick.maxSelectedSources).toBeLessThanOrEqual(8);
    expect(quick.minSelectedSources).toBeGreaterThanOrEqual(4);
  });
});
