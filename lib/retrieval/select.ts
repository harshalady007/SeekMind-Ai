import type { RankedSource, SearchMode, SourceMetadata } from "@/lib/core/types";
import { getModeConfig } from "@/lib/config/modes";
import { canonicalizeUrl, domainOf } from "./canonicalize";
import type { ScoredResult } from "./score";

const ACADEMIC_DOMAINS = [
  "arxiv.org",
  "doi.org",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "nature.com",
  "science.org",
  "sciencedirect.com",
  "springer.com",
  "link.springer.com",
  "wiley.com",
  "onlinelibrary.wiley.com",
  "acm.org",
  "dl.acm.org",
  "ieee.org",
  "ieeexplore.ieee.org",
  "biorxiv.org",
  "medrxiv.org",
  "ssrn.com",
  "plos.org",
  "journals.plos.org",
  "semanticscholar.org",
  "openreview.net",
];

const PREPRINT_DOMAINS = new Set([
  "arxiv.org",
  "biorxiv.org",
  "medrxiv.org",
  "ssrn.com",
  "openreview.net",
]);

export function isAcademicDomain(domain: string): boolean {
  return (
    ACADEMIC_DOMAINS.includes(domain) ||
    domain.endsWith(".edu") ||
    domain.includes(".ac.") ||
    domain.endsWith(".gov")
  );
}

/** Extract a DOI from a URL or text snippet, if present. */
export function extractDoi(text: string): string | null {
  const match = text.match(/\b(10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+)\b/);
  if (!match || !match[1]) return null;
  return match[1].replace(/[.,;)]+$/, "");
}

function buildMetadata(scored: ScoredResult, query: string): SourceMetadata {
  const domain = domainOf(scored.result.url);
  const isAcademic = isAcademicDomain(domain);
  const doi = extractDoi(`${scored.result.url} ${scored.result.snippet}`);
  const year = scored.result.publishedAt
    ? new Date(scored.result.publishedAt).getUTCFullYear()
    : null;
  return {
    isAcademic,
    isPreprint: PREPRINT_DOMAINS.has(domain),
    doi,
    year,
    venue: null,
    query,
  };
}

/**
 * Select the final source set: take the highest-scoring results within the
 * mode's source-count cap and total content budget, and assign stable
 * 1-based citation numbers in rank order.
 */
export function selectSources(
  scored: ScoredResult[],
  mode: SearchMode,
  query: string,
  now: Date = new Date(),
): RankedSource[] {
  const config = getModeConfig(mode);
  const selected: RankedSource[] = [];
  let budgetUsed = 0;

  for (const item of scored) {
    if (selected.length >= config.maxSelectedSources) break;
    const canonical = canonicalizeUrl(item.result.url);
    if (!canonical) continue;

    const rawContent = item.result.content ?? item.result.snippet;
    const content = rawContent.slice(0, config.sourceContentBudgetChars);
    if (
      budgetUsed + content.length > config.totalContextBudgetChars &&
      selected.length >= config.minSelectedSources
    ) {
      break;
    }
    budgetUsed += content.length;

    const domain = domainOf(item.result.url);
    selected.push({
      citationNumber: selected.length + 1,
      url: item.result.url,
      canonicalUrl: canonical,
      domain,
      title: item.result.title,
      snippet: item.result.snippet,
      content,
      author: item.result.author ?? null,
      publishedAt: item.result.publishedAt ?? null,
      retrievedAt: now.toISOString(),
      faviconUrl: `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      relevanceScore: item.relevanceScore,
      qualityScore: item.qualityScore,
      metadata: buildMetadata(item, query),
    });
  }
  return selected;
}
