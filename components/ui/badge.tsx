import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "amber" | "neutral" | "danger" | "success";

const TONES: Record<Tone, string> = {
  amber: "bg-amber-glow/15 text-amber-soft border-amber-glow/30",
  neutral: "bg-graphite-800 text-cream-300 border-graphite-700",
  danger: "bg-danger/10 text-danger border-danger/30",
  success: "bg-success/10 text-success border-success/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
