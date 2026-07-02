import type { SearchResult } from "@/lib/core/types";

/** Maximum accepted query length; enforced again by API validation. */
export const MAX_QUERY_LENGTH = 2_000;

/**
 * Normalize a user query: collapse whitespace, strip control characters,
 * clamp length. Returns null when nothing usable remains.
 */
export function normalizeQuery(raw: string): string | null {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/** Normalize provider result metadata into a consistent shape. */
export function normalizeResult(result: SearchResult): SearchResult {
  return {
    ...result,
    title: cleanText(result.title, 300) || result.url,
    snippet: cleanText(result.snippet, 1_000),
    content: result.content ? cleanText(result.content, 20_000) : null,
    author: result.author ? cleanText(result.author, 200) || null : null,
    publishedAt: normalizeDate(result.publishedAt),
    providerScore:
      typeof result.providerScore === "number" && Number.isFinite(result.providerScore)
        ? Math.min(1, Math.max(0, result.providerScore))
        : undefined,
  };
}

function cleanText(text: string, maxLen: number): string {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Parse a provider date into ISO-8601, or null when unparseable/absent. */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  // Reject absurd dates (before 1990 or more than 2 days in the future).
  const d = new Date(ts);
  if (d.getFullYear() < 1990) return null;
  if (ts > Date.now() + 2 * 24 * 60 * 60 * 1000) return null;
  return d.toISOString();
}

/** Tokenize text for keyword-overlap scoring. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}
