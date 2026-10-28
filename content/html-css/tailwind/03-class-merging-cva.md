---
title: "Merge Tailwind classes safely: clsx, tailwind-merge and cva variants"
level: medium
type: implement
tags: [tailwind-merge, clsx, cva, class-variance-authority, variants, cn]
related: [html-css/tailwind-utility-first-tradeoffs, html-css/tailwind-v4-css-first, react/headless-components]
---

## Question
A `Button` component sets `px-4` by default but a caller passes `className="px-8"`, and both classes end up in the output. Which one wins and why is it unpredictable? Implement a `cn` helper and a `Button` with size and variant props using `cva`.

## Interview Answer
Tailwind utilities are single-class selectors with equal specificity, so when two conflicting utilities (`px-4` and `px-8`) appear on an element, the one that comes later in the generated stylesheet wins, not the one later in the class string; that's an implementation detail that can change. `tailwind-merge` solves this by understanding Tailwind's class groups and removing earlier conflicting classes, so the caller's `px-8` replaces `px-4`. The common helper is `cn(...inputs) = twMerge(clsx(inputs))`: `clsx` handles conditionals and arrays, `twMerge` resolves conflicts. For components with variants I use `class-variance-authority` (`cva`), which declares base classes, variant maps, compound variants and defaults and returns a function that builds the class string with full type inference via `VariantProps`. The pattern is the foundation of shadcn/ui components.

## Explanation
### The problem

```tsx
<button className={`px-4 py-2 ${className}`} />   // className="px-8"
// output class: "px-4 py-2 px-8": which padding applies depends on CSS order in the stylesheet, not the attribute
```

### `cn`

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```ts
cn("px-4 py-2", cond && "bg-primary", { "opacity-50": disabled }, className);
cn("px-4", "px-8");                       // "px-8"
cn("text-sm text-lg");                    // "text-lg"
cn("bg-red-500", "bg-primary");           // "bg-primary"
cn("p-4", "px-2");                        // "p-4 px-2"  (not a conflict: px refines p; order-specific resolution)
```

`tailwind-merge` v3 targets Tailwind v4 class names; v2 targets v3. Keep the major versions aligned. Custom theme tokens (custom font sizes, colours) may need `extendTailwindMerge` configuration so they're recognised as the right group.

### `cva` variants

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-10 px-6 text-base",
        icon: "size-9",
      },
    },
    compoundVariants: [
      { variant: "outline", size: "sm", class: "border-dashed" },
    ],
    defaultVariants: { variant: "default", size: "md" },
  }
);

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

Usage: `<Button variant="outline" size="lg" className="w-full" />`; passing an invalid `variant` is a TypeScript error; caller `className` is merged last so it wins conflicts.

### Notes
- Pass `className` last to `cn` so overrides take precedence.
- `cva` has no Tailwind dependency; it just builds strings. Tailwind Variants (`tv`) is an alternative with slots and built-in merging.
- Don't generate class names dynamically (`bg-${color}-500`); include full class names in the variant map so Tailwind can detect them.
- For many conditional states prefer data attributes: `data-[state=open]:bg-accent`, `aria-[invalid=true]:border-destructive`.
- Slot-based components: use multiple `cva` calls or `tv` with `slots`.

### Testing
Snapshot or assertion tests on `cn` outputs for known conflicts; Storybook for visual variants; TypeScript ensures only valid variant combinations compile.

## Follow-ups
- **Does `twMerge` have a runtime cost?** — Small; results are cached with an LRU cache; avoid calling it inside tight render loops with new strings every time if profiling shows an issue.
- **Alternatives to avoid merge entirely?** — `!` important modifier or CSS layers, but merge is the least surprising.

## Common Mistakes
- Concatenating `className` strings without `twMerge`.
- Using mismatched `tailwind-merge` and Tailwind major versions.
- Building class names dynamically.

## Tips
- Show `cn` (3 lines) first, then `cva`; that mirrors how real codebases are structured.
