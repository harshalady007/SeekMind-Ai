import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The DeepFind wordmark: an original "depth sounding" mark — three nested
 * arcs converging on an amber point — beside editorial serif lettering.
 */
export function Wordmark({
  className,
  asLink = true,
}: {
  className?: string;
  asLink?: boolean;
}) {
  const mark = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M4 8 A13 13 0 0 1 24 8"
          stroke="#7c8496"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M7 13 A9.5 9.5 0 0 1 21 13"
          stroke="#b0aa9c"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10 18 A6 6 0 0 1 18 18"
          stroke="#ffb224"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="14" cy="23" r="2.4" fill="#ffb224" />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight text-cream-50">
        Deep<span className="text-amber-glow">Find</span>
      </span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <Link href="/" aria-label="DeepFind home" className="rounded-md">
      {mark}
    </Link>
  );
}
