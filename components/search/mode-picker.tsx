"use client";

import { MODE_CONFIGS } from "@/lib/config/modes";
import { SEARCH_MODES, type SearchMode } from "@/lib/core/types";
import { cn } from "@/lib/utils";

/** Accessible segmented control for the four search modes. */
export function ModePicker({
  value,
  onChange,
  compact = false,
}: {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Search mode"
      className="flex flex-wrap items-center gap-1 rounded-xl border border-graphite-700 bg-graphite-900 p-1"
    >
      {SEARCH_MODES.map((mode) => {
        const config = MODE_CONFIGS[mode];
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={config.description}
            data-testid={`mode-${mode}`}
            onClick={() => onChange(mode)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              compact && "px-2.5 py-1 text-xs",
              active
                ? "bg-amber-glow font-semibold text-graphite-950"
                : "text-cream-300 hover:bg-graphite-800 hover:text-cream-50",
            )}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
