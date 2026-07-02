import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, sanitizeMarkdownUrl } from "@/lib/security/url";

describe("isSafeExternalUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(isSafeExternalUrl("https://example.com/a?b=1")).toBe(true);
    expect(isSafeExternalUrl("http://example.com")).toBe(true);
  });

  it("rejects script, data and relative URLs", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,<script>1</script>")).toBe(false);
    expect(isSafeExternalUrl("vbscript:msgbox")).toBe(false);
    expect(isSafeExternalUrl("/relative/path")).toBe(false);
    expect(isSafeExternalUrl("//protocol-relative.com")).toBe(false);
  });
});

describe("sanitizeMarkdownUrl", () => {
  it("neutralizes unsafe targets to empty string", () => {
    expect(sanitizeMarkdownUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeMarkdownUrl("https://ok.com")).toBe("https://ok.com");
  });
});
