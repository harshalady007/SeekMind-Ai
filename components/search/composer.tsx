"use client";

import * as React from "react";
import { ArrowUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NEWS_TIME_RANGES, type NewsTimeRange, type SearchMode } from "@/lib/core/types";
import { MAX_QUERY_LENGTH } from "@/lib/retrieval/normalize";
import { cn } from "@/lib/utils";
import { ModePicker } from "./mode-picker";

const TIME_RANGE_LABELS: Record<NewsTimeRange, string> = {
  day: "Past 24 hours",
  week: "Past week",
  month: "Past month",
  any: "Any time",
};

export function SearchComposer({
  onSubmit,
  busy = false,
  variant = "hero",
  initialMode = "quick",
  placeholder = "Ask anything — answers come with sources",
  autoFocus = false,
}: {
  onSubmit: (input: {
    query: string;
    mode: SearchMode;
    timeRange?: NewsTimeRange;
  }) => void;
  busy?: boolean;
  variant?: "hero" | "followup";
  initialMode?: SearchMode;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<SearchMode>(initialMode);
  const [timeRange, setTimeRange] = React.useState<NewsTimeRange>("week");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed || busy) return;
    onSubmit({
      query: trimmed,
      mode,
      timeRange: mode === "news" ? timeRange : undefined,
    });
    if (variant === "followup") setQuery("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "rounded-card border border-graphite-700 bg-graphite-900/90 shadow-lg shadow-black/30 transition-colors focus-within:border-amber-glow/50",
        variant === "hero" ? "p-3 sm:p-4" : "p-2.5",
      )}
    >
      <label htmlFor={`composer-${variant}`} className="sr-only">
        {variant === "hero" ? "Ask a question" : "Ask a follow-up question"}
      </label>
      <textarea
        id={`composer-${variant}`}
        ref={textareaRef}
        value={query}
        onChange={(e) => setQuery(e.target.value.slice(0, MAX_QUERY_LENGTH))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={variant === "hero" ? placeholder : "Ask a follow-up…"}
        rows={variant === "hero" ? 2 : 1}
        autoFocus={autoFocus}
        data-testid={variant === "hero" ? "search-input" : "followup-input"}
        className="w-full resize-none bg-transparent px-1.5 py-1 text-base text-cream-50 outline-none placeholder:text-graphite-400"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ModePicker value={mode} onChange={setMode} compact={variant === "followup"} />
          {mode === "news" && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-graphite-400" aria-hidden="true" />
              <label htmlFor={`timerange-${variant}`} className="sr-only">
                News time range
              </label>
              <select
                id={`timerange-${variant}`}
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as NewsTimeRange)}
                data-testid="news-time-range"
                className="rounded-lg border border-graphite-700 bg-graphite-900 px-2 py-1 text-xs text-cream-100"
              >
                {NEWS_TIME_RANGES.map((range) => (
                  <option key={range} value={range}>
                    {TIME_RANGE_LABELS[range]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size={variant === "hero" ? "md" : "sm"}
          disabled={busy || query.trim().length === 0}
          aria-label={variant === "hero" ? "Search" : "Send follow-up"}
          data-testid={variant === "hero" ? "search-submit" : "followup-submit"}
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
          {variant === "hero" && <span>Search</span>}
        </Button>
      </div>
    </form>
  );
}
