import { describe, expect, it } from "vitest";
import { canonicalizeUrl, domainOf } from "@/lib/retrieval/canonicalize";

describe("canonicalizeUrl", () => {
  it("normalizes protocol, www and trailing slash", () => {
    expect(canonicalizeUrl("http://www.Example.com/path/")).toBe(
      "https://example.com/path",
    );
  });

  it("strips tracking parameters and sorts the rest", () => {
    expect(
      canonicalizeUrl("https://example.com/a?utm_source=x&b=2&a=1&fbclid=abc&gclid=1"),
    ).toBe("https://example.com/a?a=1&b=2");
  });

  it("removes fragments", () => {
    expect(canonicalizeUrl("https://example.com/page#section-2")).toBe(
      "https://example.com/page",
    );
  });

  it("keeps root slash", () => {
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("collapses duplicate slashes in the path", () => {
    expect(canonicalizeUrl("https://example.com//a///b/")).toBe(
      "https://example.com/a/b",
    );
  });

  it("rejects non-http(s) and invalid URLs", () => {
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalizeUrl("ftp://example.com/file")).toBeNull();
    expect(canonicalizeUrl("not a url")).toBeNull();
    expect(canonicalizeUrl("")).toBeNull();
  });

  it("treats identical pages with different tracking params as equal", () => {
    const a = canonicalizeUrl("https://news.site.com/story?utm_campaign=em");
    const b = canonicalizeUrl("http://www.news.site.com/story/");
    expect(a).toBe(b);
  });
});

describe("domainOf", () => {
  it("extracts lowercase host without www", () => {
    expect(domainOf("https://WWW.Example.ORG/x")).toBe("example.org");
  });
  it("returns empty string for junk", () => {
    expect(domainOf("::::")).toBe("");
  });
});
