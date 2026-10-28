---
title: "Utility-first CSS with Tailwind: benefits, drawbacks and how to keep it maintainable"
level: medium
type: concept
tags: [tailwind, utility-first, components, design-tokens, maintainability]
related: [html-css/tailwind-v4-css-first, html-css/class-merging-cva, html-css/specificity-cascade-inheritance]
---

## Question
What are the trade-offs of utility-first CSS versus CSS Modules or BEM? How do you avoid unreadable class soup and duplicated styling in a Tailwind codebase?

## Interview Answer
Utility-first CSS styles elements by composing small single-purpose classes in the markup. Benefits: no naming overhead, styles live next to the markup, no dead CSS (the generated stylesheet contains only classes you use, and stays small and nearly constant as the app grows), a constrained design-token scale (spacing, colours, type) that keeps UIs consistent, built-in responsive/state variants (`md:`, `hover:`, `dark:`), and safe local changes (editing an element can't break another). Drawbacks: long class lists hurt readability, repeated patterns can drift, there is a learning curve, and utilities don't solve component reuse by themselves. I address them by extracting React components (not CSS `@apply` classes) for repeated UI, using variant helpers like `cva` with `tailwind-merge`, sorting classes with the Prettier plugin, keeping design tokens in the theme, and reserving custom CSS for what utilities can't express. It's a good fit for component-based frameworks; less compelling for content-heavy sites with untouchable markup.

## Explanation
### Example

```tsx
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
      {children}
    </span>
  );
}
```

The component is the abstraction; the classes are an implementation detail inside it.

### Comparison

| | Tailwind (utility-first) | CSS Modules / BEM |
|---|---|---|
| Naming | none | required (BEM) / local scope (Modules) |
| Where styles live | in markup | separate file |
| CSS size growth | flat | grows with features |
| Consistency | enforced by tokens | by convention |
| Dead CSS | none | possible |
| Readability of markup | noisier | cleaner markup |
| Theming | via theme variables | via custom properties |
| Dynamic styles | variants and CSS variables | classes/inline styles |
| Learning curve | learn the vocabulary | standard CSS |
| Third-party CSS override | more awkward | easier |

### Keeping it maintainable
1. **Components over `@apply`**: extract React/Vue components for repeated UI. `@apply` brings back naming and can hide the system; use it for third-party markup you can't touch.
2. **Variants with `cva`** (class-variance-authority) and merge conflicts with `tailwind-merge` (see the class merging question).
3. **Theme tokens** for colours/spacing/typography; avoid arbitrary values like `w-[437px]` except for real exceptions; avoid hardcoded hex in classes (`bg-[#2445c9]`).
4. **Formatting**: `prettier-plugin-tailwindcss` sorts classes consistently; ESLint plugin for contradictory classes.
5. **Group logically**: layout → box → typography → color → state, or rely on the plugin's order.
6. **Dynamic class names**: never build class strings by concatenation (`` `text-${color}-500` ``); the compiler scans source for complete class names. Map to full strings or use data attributes/CSS variables.
7. **Use CSS variables for runtime values**: ``style={{ "--progress": `${pct}%` }}`` with `w-(--progress)` (v4 syntax), instead of generating classes.
8. **Escape hatches**: write real CSS for complex animations, `:has()` logic, or things like prose content (`@tailwindcss/typography`).

### Performance and tooling
- Only used classes are emitted; v4's engine (Rust, Lightning CSS) rebuilds in milliseconds.
- Compression makes repeated class names cheap in HTML.
- Works with Server Components (no runtime), unlike runtime CSS-in-JS.

### When it's the wrong tool
- Heavily CMS-driven content with arbitrary HTML (use typography plugin or scoped CSS).
- Teams that dislike mixing styling and markup and have a mature BEM system.
- Highly bespoke, art-directed pages where each element is unique (still fine, but less benefit).

### Interview framing
Explain the problem Tailwind solves (naming, specificity wars, CSS growth, inconsistent values), the cost (verbosity), and your discipline for managing it (components, tokens, variants). Show you can read the output CSS and understand the cascade layers underneath.

## Follow-ups
- **Is inline style the same as utilities?** — No: utilities support media queries, pseudo-classes, design tokens and are cached/compressed.
- **What about specificity?** — Utilities are single classes (specificity 0,1,0) in the `utilities` layer, so order and layers decide conflicts.

## Common Mistakes
- Copy-pasting class lists instead of extracting components.
- Dynamic class construction that purges incorrectly.
- Overusing arbitrary values.

## Tips
- Balance the answer: acknowledge verbosity, then show the mitigation toolkit.
