import type { SearchResult } from "@/lib/core/types";
import { tokenize } from "@/lib/retrieval/normalize";
import { FIXTURE_TOPICS, GENERIC_RESULTS } from "./fixtures";
import type { SearchProvider, SearchRequest } from "./provider";

/**
 * Deterministic mock provider used by demo mode and automated tests.
 * Picks the fixture topic with the best keyword match, falling back to a
 * generic fixture set so any query produces a coherent, citable corpus.
 */
export class MockSearchProvider implements SearchProvider {
  readonly name = "mock";

  constructor(private readonly delayMs: number = 120) {}

  async search(input: SearchRequest): Promise<SearchResult[]> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const queryTokens = new Set(tokenize(input.query));
    let best: { score: number; results: SearchResult[] } = {
      score: 0,
      results: GENERIC_RESULTS,
    };
    for (const topic of FIXTURE_TOPICS) {
      const score = topic.keywords.filter((k) => queryTokens.has(k)).length;
      if (score > best.score) best = { score, results: topic.results };
    }
    return best.results.slice(0, input.maxResults).map((r) => ({ ...r }));
  }
}
