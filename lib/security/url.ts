/**
 * A link is safe to render/open only when it is a well-formed absolute
 * http(s) URL. Everything else (javascript:, data:, vbscript:, relative
 * tricks) is rejected. Used both for source links and markdown link
 * sanitization.
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Markdown URL transform: neutralize unsafe link/image targets. */
export function sanitizeMarkdownUrl(url: string): string {
  return isSafeExternalUrl(url) ? url : "";
}
