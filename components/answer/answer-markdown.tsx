"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkifyCitations } from "@/lib/citations/render";
import type { PublicSource } from "@/lib/core/types";
import { sanitizeMarkdownUrl } from "@/lib/security/url";
import { cn } from "@/lib/utils";

const CITATION_HREF_PREFIX = "#df-source-";

/** Scroll the matching source card into view and pulse-highlight it. */
export function highlightSourceCard(id: number): void {
  const card = document.getElementById(`df-source-${id}`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.remove("df-source-highlight");
  // Force a reflow so re-adding the class restarts the animation.
  void card.offsetWidth;
  card.classList.add("df-source-highlight");
}

function CitationChip({ id, source }: { id: number; source: PublicSource | undefined }) {
  return (
    <button
      type="button"
      onClick={() => highlightSourceCard(id)}
      data-testid={`citation-chip-${id}`}
      aria-label={`Citation ${id}${source ? `: ${source.domain}` : ""} — show source`}
      title={source ? `${source.title} (${source.domain})` : `Source ${id}`}
      className="mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] translate-y-[-1px] items-center justify-center rounded-md bg-amber-glow/15 px-1 align-middle text-[0.7rem] font-semibold text-amber-soft transition-colors hover:bg-amber-glow hover:text-graphite-950"
    >
      {id}
    </button>
  );
}

/**
 * Renders the streamed answer: GitHub-flavored markdown (no raw HTML),
 * sanitized link targets, and inline citation chips wired to source cards.
 */
export function AnswerMarkdown({
  content,
  sources,
  streaming = false,
  className,
}: {
  content: string;
  sources: PublicSource[];
  streaming?: boolean;
  className?: string;
}) {
  const validIds = React.useMemo(() => new Set(sources.map((s) => s.id)), [sources]);
  const sourceById = React.useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );
  const processed = React.useMemo(
    () => linkifyCitations(content, validIds),
    [content, validIds],
  );

  return (
    <div className={cn("df-answer", streaming && "df-caret", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) =>
          url.startsWith(CITATION_HREF_PREFIX) ? url : sanitizeMarkdownUrl(url)
        }
        components={{
          a: ({ href, children, ...props }) => {
            if (href?.startsWith(CITATION_HREF_PREFIX)) {
              const id = Number(href.slice(CITATION_HREF_PREFIX.length));
              return <CitationChip id={id} source={sourceById.get(id)} />;
            }
            if (!href) return <span {...props}>{children}</span>;
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
