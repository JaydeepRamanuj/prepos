import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-[12px] font-medium [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        outline: "border-line bg-transparent text-ink-2",
        highlight: "border-transparent bg-hl-soft text-ink",
        secondary: "border-transparent bg-sunken text-ink-2",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
