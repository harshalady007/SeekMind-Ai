"use client";

import * as React from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toBibtex } from "@/lib/citations/bibtex";
import type { PublicSource, SearchMode } from "@/lib/core/types";
import { isSafeExternalUrl } from "@/lib/security/url";
import { formatDate } from "@/lib/utils";

export function SourceCard({ source, mode }: { source: PublicSource; mode: SearchMode }) {
  const [faviconFailed, setFaviconFailed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const bibtex = mode === "academic" ? toBibtex(source) : null;
  const safeUrl = isSafeExternalUrl(source.url) ? source.url : null;

  const copyBibtex = async () => {
    if (!bibtex) return;
    await navigator.clipboard.writeText(bibtex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article
      id={`df-source-${source.id}`}
      data-testid={`source-card-${source.id}`}
      className="rounded-card border border-graphite-700 bg-graphite-900 p-3.5 transition-colors"
      aria-label={`Source ${source.id}: ${source.title}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-glow/15 text-[0.7rem] font-semibold text-amber-soft"
        >
          {source.id}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-graphite-400">
            {source.faviconUrl && !faviconFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={source.faviconUrl}
                alt=""
                width={14}
                height={14}
                className="rounded-sm"
                onError={() => setFaviconFailed(true)}
              />
            ) : (
              <span
                className="inline-block h-3.5 w-3.5 rounded-sm bg-graphite-700"
                aria-hidden="true"
              />
            )}
            <span className="truncate">{source.domain}</span>
            {source.metadata.isPreprint && (
              <Badge tone="amber">Preprint — not peer reviewed</Badge>
            )}
          </div>

          {safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm font-medium leading-snug text-cream-50 hover:text-amber-soft"
            >
              {source.title}
              <ExternalLink
                className="ml-1 inline h-3 w-3 align-baseline text-graphite-400"
                aria-hidden="true"
              />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <p className="mt-1 text-sm font-medium leading-snug text-cream-50">
              {source.title}
            </p>
          )}

          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-graphite-300">
            {source.snippet}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.7rem] text-graphite-400">
            {source.author && <span>{source.author}</span>}
            {source.metadata.venue && <span>{source.metadata.venue}</span>}
            {source.publishedAt && (
              <span>Published {formatDate(source.publishedAt)}</span>
            )}
            <span>Retrieved {formatDate(source.retrievedAt)}</span>
            {source.metadata.doi && (
              <span className="truncate font-mono">DOI: {source.metadata.doi}</span>
            )}
            {bibtex && (
              <button
                type="button"
                onClick={copyBibtex}
                className="inline-flex items-center gap-1 text-amber-soft hover:underline"
                data-testid={`bibtex-${source.id}`}
              >
                <Copy className="h-3 w-3" aria-hidden="true" />
                {copied ? "Copied" : "BibTeX"}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
