import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-amber-glow text-graphite-950 font-semibold hover:bg-amber-soft active:bg-amber-deep disabled:bg-graphite-700 disabled:text-graphite-400",
  secondary:
    "bg-graphite-800 text-cream-100 hover:bg-graphite-700 border border-graphite-700",
  ghost: "text-cream-300 hover:text-cream-50 hover:bg-graphite-800",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
  outline:
    "border border-graphite-600 text-cream-100 hover:border-amber-glow/60 hover:text-amber-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
