import type { SearchMode, SearchResult } from "@/lib/core/types";
import { getModeConfig } from "@/lib/config/modes";
import { domainOf } from "./canonicalize";
import { tokenize } from "./normalize";

export interface ScoredResult {
  result: SearchResult;
  relevanceScore: number;
  qualityScore: number;
  finalScore: number;
}

/** Domain suffixes / hosts that indicate high-quality primary sources. */
const HIGH_QUALITY_PATTERNS: Array<{ test: (domain: string) => boolean; score: number }> =
  [
    { test: (d) => d.endsWith(".gov") || d.includes(".gov."), score: 0.95 },
    { test: (d) => d.endsWith(".edu") || d.includes(".ac."), score: 0.9 },
    { test: (d) => d === "arxiv.org" || d === "pubmed.ncbi.nlm.nih.gov", score: 0.92 },
    {
      test: (d) => d === "doi.org" || d === "nature.com" || d === "science.org",
      score: 0.92,
    },
    { test: (d) => d.endsWith(".org"), score: 0.7 },
    {
      test: (d) =>
        [
          "reuters.com",
          "apnews.com",
          "bbc.com",
          "bbc.co.uk",
          "ft.com",
          "economist.com",
          "nytimes.com",
          "wsj.com",
          "theguardian.com",
          "bloomberg.com",
        ].includes(d),
      score: 0.85,
    },
    { test: (d) => d === "wikipedia.org" || d.endsWith(".wikipedia.org"), score: 0.75 },
    { test: (d) => d === "github.com" || d === "stackoverflow.com", score: 0.75 },
  ];

/** Domains never worth citing (link aggregators, outright spam surfaces). */
const BLOCKED_DOMAINS = new Set([
  "pinterest.com",
  "quora.com",
  "answers.com",
  "slideshare.net",
]);

export function domainQualityScore(domain: string): number {
  for (const { test, score } of HIGH_QUALITY_PATTERNS) {
    if (test(domain)) return score;
  }
  return 0.55;
}

/** Fraction of query tokens present in the result title + snippet. */
export function keywordOverlapScore(query: string, result: SearchResult): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const docTokens = new Set(tokenize(`${result.title} ${result.snippet}`));
  let hits = 0;
  for (const t of queryTokens) if (docTokens.has(t)) hits++;
  return hits / queryTokens.size;
}

/** Exponential decay by age with a mode-specific half-life. Unknown date → 0.3. */
export function recencyScore(
  publishedAt: string | null | undefined,
  halfLifeDays: number,
  now: Date = new Date(),
): number {
  if (!publishedAt) return 0.3;
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return 0.3;
  const ageDays = Math.max(0, (now.getTime() - ts) / (24 * 60 * 60 * 1000));
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/** Filter out unsafe, blocked, or obviously irrelevant results. */
export function filterResults(query: string, results: SearchResult[]): SearchResult[] {
  return results.filter((r) => {
    const domain = domainOf(r.url);
    if (!domain || BLOCKED_DOMAINS.has(domain)) return false;
    if (!r.url.startsWith("http://") && !r.url.startsWith("https://")) return false;
    // Require at least minimal keyword or provider-score signal.
    const overlap = keywordOverlapScore(query, r);
    const providerScore = r.providerScore ?? 0;
    return overlap > 0.05 || providerScore > 0.25;
  });
}

/**
 * Score results with mode-specific weights. "Semantic relevance" uses the
 * provider's relevance score when present (Tavily computes embedding-based
 * relevance) with keyword overlap as fallback signal.
 */
export function scoreResults(
  query: string,
  results: SearchResult[],
  mode: SearchMode,
  now: Date = new Date(),
): ScoredResult[] {
  const config = getModeConfig(mode);
  const w = config.weights;
  const weightTotal =
    w.semanticRelevance + w.keywordOverlap + w.sourceQuality + w.recency;

  return results
    .map((result) => {
      const overlap = keywordOverlapScore(query, result);
      const semantic = result.providerScore ?? overlap;
      const quality = domainQualityScore(domainOf(result.url));
      const recency = recencyScore(result.publishedAt, config.recencyHalfLifeDays, now);
      const finalScore =
        (w.semanticRelevance * semantic +
          w.keywordOverlap * overlap +
          w.sourceQuality * quality +
          w.recency * recency) /
        weightTotal;
      return {
        result,
        relevanceScore: Number(semantic.toFixed(4)),
        qualityScore: Number(quality.toFixed(4)),
        finalScore: Number(finalScore.toFixed(4)),
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}
