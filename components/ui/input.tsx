import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-xl border border-graphite-700 bg-graphite-900 px-3.5 text-sm text-cream-100 placeholder:text-graphite-400 focus:border-amber-glow/60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-graphite-700 bg-graphite-900 px-3.5 py-2.5 text-sm text-cream-100 placeholder:text-graphite-400 focus:border-amber-glow/60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
