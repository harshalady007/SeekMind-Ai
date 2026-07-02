import { describe, expect, it } from "vitest";
import { toBibtex } from "@/lib/citations/bibtex";
import type { PublicSource } from "@/lib/core/types";

const base: PublicSource = {
  id: 1,
  url: "https://arxiv.org/abs/2405.00001",
  domain: "arxiv.org",
  title: "Interface engineering for sulfide solid electrolytes",
  snippet: "…",
  author: "L. Chen, R. Okafor",
  publishedAt: "2026-04-01T00:00:00.000Z",
  retrievedAt: "2026-07-01T00:00:00.000Z",
  faviconUrl: null,
  metadata: { isPreprint: true, year: 2026, doi: "10.1234/demo.5678" },
};

describe("toBibtex", () => {
  it("builds a misc entry for preprints with doi, url and access note", () => {
    const bib = toBibtex(base);
    expect(bib).toContain("@misc{");
    expect(bib).toContain("title = {Interface engineering");
    expect(bib).toContain("doi = {10.1234/demo.5678}");
    expect(bib).toContain("year = {2026}");
    expect(bib).toContain("preprint");
  });

  it("returns null when metadata is insufficient", () => {
    expect(toBibtex({ ...base, publishedAt: null, metadata: {} })).toBeNull();
  });

  it("escapes BibTeX-special characters", () => {
    const bib = toBibtex({ ...base, title: "Salt & pepper: 100% coverage" });
    expect(bib).toContain("Salt \\& pepper: 100\\% coverage");
  });
});
