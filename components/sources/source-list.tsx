"use client";

import * as React from "react";
import type { PublicSource, SearchMode } from "@/lib/core/types";
import { SourceCard } from "./source-card";

/**
 * Numbered source cards. In news mode the list is ordered newest-first so
 * publication timing is prominent; otherwise citation order is kept.
 */
export function SourceList({
  sources,
  mode,
}: {
  sources: PublicSource[];
  mode: SearchMode;
}) {
  const ordered = React.useMemo(() => {
    if (mode !== "news") return sources;
    return [...sources].sort((a, b) =>
      (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
    );
  }, [sources, mode]);

  if (sources.length === 0) return null;

  return (
    <section aria-label={`Sources (${sources.length})`}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-graphite-300">
        Sources
        <span
          className="rounded-full bg-graphite-800 px-2 py-0.5 text-xs text-cream-300"
          data-testid="source-count"
        >
          {sources.length}
        </span>
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {ordered.map((source) => (
          <SourceCard key={source.id} source={source} mode={mode} />
        ))}
      </div>
    </section>
  );
}
