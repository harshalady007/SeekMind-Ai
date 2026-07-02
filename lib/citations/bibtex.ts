import type { PublicSource } from "@/lib/core/types";

/**
 * Build a BibTeX entry from source metadata. Returns null when there is not
 * enough metadata for a useful entry (needs at least a title and a year).
 */
export function toBibtex(source: PublicSource): string | null {
  const year = source.metadata.year ?? yearOf(source.publishedAt);
  if (!source.title || !year) return null;

  const firstAuthor = source.author?.split(/,|\band\b/)[0]?.trim() ?? source.domain;
  const key = `${firstAuthor.toLowerCase().replace(/[^a-z0-9]/g, "")}${year}`;
  const fields: Array<[string, string]> = [["title", source.title]];
  if (source.author) fields.push(["author", source.author]);
  fields.push(["year", String(year)]);
  if (source.metadata.venue) fields.push(["journal", source.metadata.venue]);
  if (source.metadata.doi) fields.push(["doi", source.metadata.doi]);
  fields.push(["url", source.url]);
  const accessed = source.retrievedAt.slice(0, 10);
  fields.push([
    "note",
    `Accessed ${accessed}${source.metadata.isPreprint ? "; preprint" : ""}`,
  ]);

  const body = fields.map(([k, v]) => `  ${k} = {${escapeBibtex(v)}}`).join(",\n");
  const entryType =
    source.metadata.isPreprint || !source.metadata.venue ? "misc" : "article";
  return `@${entryType}{${key},\n${body}\n}`;
}

function escapeBibtex(value: string): string {
  return value.replace(/[{}]/g, "").replace(/([&%$#_])/g, "\\$1");
}

function yearOf(iso: string | null): number | null {
  if (!iso) return null;
  const year = new Date(iso).getUTCFullYear();
  return Number.isNaN(year) ? null : year;
}
