/** Tracking parameters stripped during URL canonicalization. */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
  "cmpid",
  "spm",
  "s_kwcid",
]);

/**
 * Canonicalize a URL for deduplication:
 * lowercased host, no default ports, no fragments, no tracking params,
 * sorted remaining query params, no trailing slash (except root),
 * "www." stripped, protocol normalized to https for comparison purposes.
 *
 * Returns null when the input is not a valid http(s) URL.
 */
export function canonicalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  let host = url.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  if (!host) return null;

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  let pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  const query =
    params.length > 0
      ? `?${params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`
      : "";

  return `https://${host}${pathname}${query}`;
}

/** Extract the registrable-ish domain for display and quality scoring. */
export function domainOf(url: string): string {
  try {
    let host = new URL(url).hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    return "";
  }
}
