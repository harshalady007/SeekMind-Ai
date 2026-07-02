import type { RankedSource, SearchMode, SearchResult } from "@/lib/core/types";
import { dedupeResults } from "./dedupe";
import { normalizeResult } from "./normalize";
import { filterResults, scoreResults } from "./score";
import { selectSources } from "./select";

/**
 * The core retrieval pipeline: normalize → dedupe → filter → score → select.
 * Pure and synchronous — searching happens upstream, persistence downstream —
 * so every stage is unit-testable in isolation.
 */
export function processResults(
  query: string,
  rawResults: SearchResult[],
  mode: SearchMode,
  now: Date = new Date(),
): { sources: RankedSource[]; consideredCount: number } {
  const normalized = rawResults.map(normalizeResult);
  // Sort by provider score first so dedupe keeps the strongest copy.
  normalized.sort((a, b) => (b.providerScore ?? 0) - (a.providerScore ?? 0));
  const deduped = dedupeResults(normalized);
  const filtered = filterResults(query, deduped);
  const scored = scoreResults(query, filtered, mode, now);
  const sources = selectSources(scored, mode, query, now);
  return { sources, consideredCount: rawResults.length };
}
