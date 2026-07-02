import { extractCitedIds } from "./extract";

export interface CitationSourceLike {
  citationNumber?: number;
  /** PublicSource uses a numeric id; stored records may use a string uuid. */
  id?: number | string;
}

export interface CitationValidationResult {
  valid: boolean;
  /** All IDs cited in the answer, first-occurrence order. */
  citedIds: number[];
  /** Cited IDs with no corresponding source. */
  invalidIds: number[];
  /** Supplied source IDs never cited. */
  uncitedSourceIds: number[];
}

function sourceId(s: CitationSourceLike): number {
  if (typeof s.citationNumber === "number") return s.citationNumber;
  if (typeof s.id === "number") return s.id;
  return -1;
}

/**
 * Validate that every citation in the answer maps to a supplied source.
 * Accepts both server-side RankedSource ({citationNumber}) and client-side
 * PublicSource ({id}) shapes.
 */
export function validateCitations(
  answer: string,
  sources: CitationSourceLike[],
): CitationValidationResult {
  const available = new Set(sources.map(sourceId).filter((n) => n > 0));
  const citedIds = extractCitedIds(answer);
  const invalidIds = citedIds.filter((id) => !available.has(id));
  const citedSet = new Set(citedIds);
  const uncitedSourceIds = [...available]
    .filter((id) => !citedSet.has(id))
    .sort((a, b) => a - b);
  return {
    valid: invalidIds.length === 0,
    citedIds,
    invalidIds,
    uncitedSourceIds,
  };
}

/**
 * Remove citations whose IDs do not exist in the supplied source set.
 * Used as the controlled repair step; the result is re-validated afterwards.
 */
export function stripInvalidCitations(
  answer: string,
  sources: CitationSourceLike[],
): string {
  const available = new Set(sources.map(sourceId).filter((n) => n > 0));
  return answer
    .replace(/\[(\d{1,3})\]/g, (whole, num: string) =>
      available.has(Number(num)) ? whole : "",
    )
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ");
}
