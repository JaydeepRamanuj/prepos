"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[14px] font-medium transition-colors hover:bg-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-40 data-[state=on]:bg-sunken data-[state=on]:text-ink [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent text-ink-2",
        outline: "border border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-surface",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-[13px]",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({ className, variant, size, ...props }: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive.Root data-slot="toggle" className={cn(toggleVariants({ variant, size }), className)} {...props} />;
}

export { Toggle, toggleVariants };
