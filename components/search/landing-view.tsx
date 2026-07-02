"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MODE_CONFIGS } from "@/lib/config/modes";
import type {
  AnswerLength,
  NewsTimeRange,
  SearchMode,
  ThreadRecord,
} from "@/lib/core/types";
import { formatRelativeTime } from "@/lib/utils";
import { SearchComposer } from "./composer";

export function LandingView({
  demoMode,
  signedIn,
  recentThreads,
  exampleQueries,
  defaultMode,
  defaultAnswerLength,
}: {
  demoMode: boolean;
  signedIn: boolean;
  recentThreads: ThreadRecord[];
  exampleQueries: string[];
  defaultMode: SearchMode;
  defaultAnswerLength: AnswerLength;
}) {
  const router = useRouter();

  const startSearch = (input: {
    query: string;
    mode: SearchMode;
    timeRange?: NewsTimeRange;
  }) => {
    const params = new URLSearchParams({
      q: input.query,
      mode: input.mode,
      len: defaultAnswerLength,
    });
    if (input.timeRange) params.set("range", input.timeRange);
    router.push(`/thread/new?${params.toString()}`);
  };

  return (
    <div className="flex flex-col items-center pt-14 sm:pt-24">
      <h1 className="text-center font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-5xl">
        Ask the web.
        <br />
        <span className="text-amber-glow">Trace every answer.</span>
      </h1>
      <p className="mt-4 max-w-xl text-center text-sm text-graphite-300 sm:text-base">
        DeepFind searches live sources, writes the answer as it reads, and pins a citation
        on every claim — so you can check the evidence yourself.
      </p>
      {demoMode && (
        <p className="mt-3 text-center text-xs text-amber-soft">
          Running on demo data — answers are generated from local fixture sources, not the
          live web.
        </p>
      )}

      <div className="mt-8 w-full max-w-2xl">
        <SearchComposer onSubmit={startSearch} initialMode={defaultMode} autoFocus />
      </div>

      <section aria-label="Example searches" className="mt-6 w-full max-w-2xl">
        <h2 className="sr-only">Try an example</h2>
        <ul className="flex flex-wrap justify-center gap-2">
          {exampleQueries.map((query) => (
            <li key={query}>
              <button
                type="button"
                onClick={() => startSearch({ query, mode: "quick" })}
                data-testid="example-query"
                className="group inline-flex items-center gap-1.5 rounded-full border border-graphite-700 bg-graphite-900 px-3.5 py-1.5 text-xs text-cream-300 transition-colors hover:border-amber-glow/50 hover:text-cream-50"
              >
                <Sparkles
                  className="h-3 w-3 text-graphite-400 group-hover:text-amber-glow"
                  aria-hidden="true"
                />
                {query}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {recentThreads.length > 0 && (
        <section aria-label="Recent threads" className="mt-12 w-full max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-medium text-graphite-300">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Recent research
            </h2>
            <Link href="/library" className="text-xs text-amber-soft hover:underline">
              View library →
            </Link>
          </div>
          <ul className="divide-y divide-graphite-800 overflow-hidden rounded-card border border-graphite-800 bg-graphite-900/60">
            {recentThreads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/thread/${thread.id}`}
                  data-testid="recent-thread"
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-graphite-850"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-cream-100">
                      {thread.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-graphite-400">
                      {formatRelativeTime(thread.updatedAt)}
                    </span>
                  </span>
                  <Badge tone="neutral">{MODE_CONFIGS[thread.searchMode].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          {!signedIn && (
            <p className="mt-2 text-xs text-graphite-400">
              These threads belong to this browser session. Sign in to keep them.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
