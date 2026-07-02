/** Matches citation chips like [1], [2][7]. Bare numbers in prose don't count. */
const CITATION_PATTERN = /\[(\d{1,3})\]/g;

/**
 * Extract cited source IDs in first-occurrence order.
 * `"A [2] B [1] C [2]"` → `[2, 1]`.
 */
export function extractCitedIds(answer: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const match of answer.matchAll(CITATION_PATTERN)) {
    const id = Number(match[1]);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** All citation occurrences with positions, for repair/highlighting. */
export function findCitationOccurrences(
  answer: string,
): Array<{ id: number; index: number; length: number }> {
  const out: Array<{ id: number; index: number; length: number }> = [];
  for (const match of answer.matchAll(CITATION_PATTERN)) {
    out.push({ id: Number(match[1]), index: match.index, length: match[0].length });
  }
  return out;
}
