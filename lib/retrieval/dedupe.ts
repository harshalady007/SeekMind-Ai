import type { SearchResult } from "@/lib/core/types";
import { canonicalizeUrl } from "./canonicalize";
import { tokenize } from "./normalize";

/**
 * Remove exact duplicates (same canonical URL) and near-duplicates
 * (very similar titles from any domain — typically syndicated copies).
 * Order is preserved; the first occurrence wins, so callers should sort
 * by preference (e.g. provider score) before deduplicating.
 */
export function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seenUrls = new Set<string>();
  const keptTitleTokens: Set<string>[] = [];
  const out: SearchResult[] = [];

  for (const result of results) {
    const canonical = canonicalizeUrl(result.url);
    if (!canonical) continue;
    if (seenUrls.has(canonical)) continue;

    const tokens = new Set(tokenize(result.title));
    const isNearDuplicate = keptTitleTokens.some((kept) => jaccard(kept, tokens) >= 0.85);
    if (isNearDuplicate) continue;

    seenUrls.add(canonical);
    keptTitleTokens.push(tokens);
    out.push(result);
  }
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}
