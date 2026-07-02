"use client";

import * as React from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={6}
        align="end"
        className={cn(
          "z-50 min-w-44 rounded-xl border border-graphite-700 bg-graphite-900 p-1.5 shadow-xl",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  className,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & {
  destructive?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-graphite-800",
        destructive ? "text-danger" : "text-cream-100",
        className,
      )}
      {...props}
    />
  );
}

export const DropdownSeparator = ({ className }: { className?: string }) => (
  <DropdownPrimitive.Separator className={cn("my-1 h-px bg-graphite-700", className)} />
);
