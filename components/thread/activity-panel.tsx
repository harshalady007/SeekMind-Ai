"use client";

import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { SearchStage } from "@/lib/core/types";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<SearchStage, string> = {
  planning: "Planning",
  searching: "Searching",
  reading_sources: "Reading sources",
  evaluating_evidence: "Evaluating evidence",
  writing: "Writing",
  complete: "Complete",
  error: "Error",
};

/**
 * Collapsible research activity log. The latest status line doubles as the
 * ARIA live region announcing streaming progress to screen readers.
 */
export function ActivityPanel({
  activity,
  running,
}: {
  activity: Array<{ stage: SearchStage; message: string; at: number }>;
  running: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const latest = activity[activity.length - 1];

  if (activity.length === 0) return null;

  return (
    <div className="rounded-card border border-graphite-800 bg-graphite-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="activity-toggle"
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm text-cream-300"
      >
        <span className="flex items-center gap-2" aria-live="polite" role="status">
          {running && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-amber-glow"
              aria-hidden="true"
            />
          )}
          {latest ? `${STAGE_LABELS[latest.stage]} — ${latest.message}` : "Activity"}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ol className="border-t border-graphite-800 px-3.5 py-2 text-xs text-graphite-300">
          {activity.map((item, i) => (
            <li key={`${item.at}-${i}`} className="flex gap-2 py-1">
              <span className="w-32 shrink-0 font-medium text-graphite-400">
                {STAGE_LABELS[item.stage]}
              </span>
              <span>{item.message}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
