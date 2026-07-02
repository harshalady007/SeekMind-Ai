/**
 * Turn citation markers like [3] into markdown links `[3](#df-source-3)`
 * so the renderer can mount interactive citation chips. Only IDs present in
 * the valid set are linked; anything else is left as plain text (it will
 * also have been stripped server-side). Code fences and inline code are
 * left untouched.
 */
export function linkifyCitations(markdown: string, validIds: Set<number>): string {
  // Split on fenced code blocks first, then inline code spans.
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((block, i) => {
      if (i % 2 === 1) return block; // fenced code
      return block
        .split(/(`[^`\n]*`)/g)
        .map((segment, j) => {
          if (j % 2 === 1) return segment; // inline code
          return segment.replace(/\[(\d{1,3})\]/g, (whole, num: string) => {
            const id = Number(num);
            return validIds.has(id) ? `[${id}](#df-source-${id})` : whole;
          });
        })
        .join("");
    })
    .join("");
}
