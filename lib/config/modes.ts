import type { SearchMode } from "@/lib/core/types";

/**
 * Per-mode retrieval configuration. All tuning values live here rather than
 * as magic numbers scattered through the pipeline.
 */
export interface ModeConfig {
  /** Maximum focused queries generated from the user question. */
  maxQueries: number;
  /** Candidate results requested per query from the search provider. */
  resultsPerQuery: number;
  /** Maximum sources passed to the model. */
  maxSelectedSources: number;
  /** Minimum sources we aim for before answering (best effort). */
  minSelectedSources: number;
  /** Scoring weights; they need not sum to 1 — scores are normalized. */
  weights: {
    semanticRelevance: number;
    keywordOverlap: number;
    sourceQuality: number;
    recency: number;
  };
  /** Half-life in days for the recency score decay. */
  recencyHalfLifeDays: number;
  /** Approximate per-source content budget (characters) sent to the model. */
  sourceContentBudgetChars: number;
  /** Total evidence budget (characters) across all sources. */
  totalContextBudgetChars: number;
  /** Whether this mode runs the iterative research loop. */
  iterative: boolean;
  /** Hard cap on total orchestration time for this mode (ms). */
  maxDurationMs: number;
  /** Provider topic hint (Tavily supports "general" | "news"). */
  providerTopic: "general" | "news";
  label: string;
  description: string;
}

export const MODE_CONFIGS: Record<SearchMode, ModeConfig> = {
  quick: {
    maxQueries: 3,
    resultsPerQuery: 6,
    maxSelectedSources: 8,
    minSelectedSources: 4,
    weights: {
      semanticRelevance: 0.45,
      keywordOverlap: 0.2,
      sourceQuality: 0.25,
      recency: 0.1,
    },
    recencyHalfLifeDays: 180,
    sourceContentBudgetChars: 2_400,
    totalContextBudgetChars: 16_000,
    iterative: false,
    maxDurationMs: 45_000,
    providerTopic: "general",
    label: "Quick",
    description: "One search pass, concise direct answer",
  },
  research: {
    maxQueries: 8,
    resultsPerQuery: 6,
    maxSelectedSources: 12,
    minSelectedSources: 6,
    weights: {
      semanticRelevance: 0.4,
      keywordOverlap: 0.2,
      sourceQuality: 0.3,
      recency: 0.1,
    },
    recencyHalfLifeDays: 365,
    sourceContentBudgetChars: 3_200,
    totalContextBudgetChars: 32_000,
    iterative: true,
    maxDurationMs: 150_000,
    providerTopic: "general",
    label: "Research",
    description: "Iterative searches, structured report",
  },
  academic: {
    maxQueries: 4,
    resultsPerQuery: 8,
    maxSelectedSources: 10,
    minSelectedSources: 4,
    weights: {
      semanticRelevance: 0.35,
      keywordOverlap: 0.15,
      sourceQuality: 0.45,
      recency: 0.05,
    },
    recencyHalfLifeDays: 1_460,
    sourceContentBudgetChars: 2_800,
    totalContextBudgetChars: 24_000,
    iterative: false,
    maxDurationMs: 60_000,
    providerTopic: "general",
    label: "Academic",
    description: "Papers, journals and primary sources",
  },
  news: {
    maxQueries: 3,
    resultsPerQuery: 8,
    maxSelectedSources: 8,
    minSelectedSources: 4,
    weights: {
      semanticRelevance: 0.3,
      keywordOverlap: 0.15,
      sourceQuality: 0.25,
      recency: 0.3,
    },
    recencyHalfLifeDays: 3,
    sourceContentBudgetChars: 2_000,
    totalContextBudgetChars: 14_000,
    iterative: false,
    maxDurationMs: 45_000,
    providerTopic: "news",
    label: "News",
    description: "Recent reporting with publication dates",
  },
};

export function getModeConfig(mode: SearchMode): ModeConfig {
  return MODE_CONFIGS[mode];
}
