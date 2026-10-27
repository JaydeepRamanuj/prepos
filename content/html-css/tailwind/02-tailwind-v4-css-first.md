---
title: "What changed in Tailwind CSS v4: CSS-first config, @theme and the new engine"
level: hard
type: concept
tags: [tailwind-v4, theme, css-first, custom-variant, dark-mode, design-tokens, lightningcss]
related: [html-css/tailwind-utility-first-tradeoffs, html-css/class-merging-cva, html-css/cascade-layers-nesting]
---

## Question
How is Tailwind v4 configured compared with v3? Explain `@import "tailwindcss"`, `@theme`, custom variants such as dark mode, automatic content detection, and how theme values become CSS variables. How would you map an existing design system (like shadcn/ui tokens) onto it?

## Clues
- Configuration moved from `tailwind.config.js` to CSS.
- Theme values are exposed as CSS custom properties.
- Dark mode strategy is declared with `@custom-variant`.

## Interview Answer
Tailwind v4 is configured in CSS instead of JavaScript: you `@import "tailwindcss"` and customise with directives such as `@theme` (design tokens), `@utility` (custom utilities), `@custom-variant` (variants like a class-based dark mode) and `@source` (extra content paths). Content detection is automatic (it respects `.gitignore` and ignores binary files), and the new engine, built in Rust with Lightning CSS, makes builds much faster with first-class native CSS features: cascade layers, `@property`, `color-mix()`, container queries and `:has()` variants. Everything in `@theme` becomes a CSS variable (`--color-primary`, `--spacing`, `--font-sans`), and defines utilities (`bg-primary`, `font-sans`) at the same time, so tokens are usable from plain CSS and at runtime for theming. To map shadcn-style semantic tokens, I define variables in `:root` and `.dark`, then expose them to Tailwind with `@theme inline` so utilities like `bg-background` reference the variable at runtime.

## Explanation
### Setup

```css
/* app/globals.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));       /* class-based dark mode (v4 default is prefers-color-scheme) */

@theme {
  --font-sans: "Instrument Sans", system-ui, sans-serif;
  --color-brand-500: oklch(0.62 0.19 260);
  --breakpoint-3xl: 120rem;
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
}
```

Install with `@tailwindcss/postcss` (Next.js, PostCSS) or `@tailwindcss/vite`; no `tailwind.config.js` or `postcss-import`/`autoprefixer` needed. A JS config can still be loaded with `@config "./tailwind.config.js"` for migration.

### Theme variables

```css
@theme {
  --color-primary: #2445c9;
}
/* generates: :root { --color-primary: #2445c9 } plus utilities bg-primary, text-primary, border-primary, ring-primary … */
```

Namespaces map to utilities: `--color-*` (colours), `--font-*`, `--text-*`, `--spacing` (the base for `p-4`, `gap-2`…), `--radius-*`, `--shadow-*`, `--breakpoint-*`, `--animate-*`, `--ease-*`. Reset a namespace with `--color-*: initial;` to remove defaults.

### Mapping semantic tokens (shadcn-style)

```css
:root { --background: #f5f6f8; --foreground: #172033; --primary: #2445c9; }
.dark { --background: #0e1424; --foreground: #e5e8f1; --primary: #93a9ff; }

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
}
```

`inline` makes utilities use `var(--background)` directly rather than copying the value into another variable, so overriding `--background` under `.dark` works. Without `inline`, theme variables that reference other variables resolve at the `:root` and ignore overrides in nested scopes. This repository's `globals.css` uses the same idea: notebook tokens in `:root`/`.dark`, semantic aliases on top, and components use `bg-primary`/`text-muted-foreground`.

### Custom utilities and variants

```css
@utility text-balance { text-wrap: balance; }
@utility scrollbar-hidden { scrollbar-width: none; &::-webkit-scrollbar { display: none; } }

@custom-variant hocus (&:is(:hover, :focus-visible));
@variant dark (&:where(.dark, .dark *));              /* use variants inside custom CSS */
```

### Syntax and behaviour changes from v3

| Area | v3 | v4 |
|---|---|---|
| Config | `tailwind.config.js` | CSS (`@theme`, `@source`, `@utility`) |
| Directives | `@tailwind base; components; utilities;` | `@import "tailwindcss";` |
| Content paths | `content: [...]` | automatic detection (`@source` to add) |
| Gradients | `bg-gradient-to-r` | `bg-linear-to-r`, `bg-radial`, `bg-conic` |
| Shadows/radius scale | `shadow-sm`, `rounded-sm` | shifted: `shadow-xs`, `rounded-xs` (old `sm` is now `xs`) |
| `ring` default | 3px | 1px (`ring-3` for old look) |
| Important modifier | `!bg-red-500` | `bg-red-500!` (trailing) |
| Variable arbitrary values | `w-[var(--x)]` | `w-(--x)` |
| Stacked variants order | right-to-left | left-to-right |
| `space-*`, `divide-*` | margin selectors | changed selectors; prefer `gap` |
| Default border colour | gray-200 | `currentColor` |
| Container queries | plugin | built in (`@container`, `@md:` variants) |
| Colours | rgb/hsl | `oklch`, wider gamut; opacity via `color-mix()` |
| Browser support | wide | modern (Safari 16.4+, Chrome 111+, Firefox 128+) |

### Engine and features
- Full builds several times faster and incremental builds orders of magnitude faster; Lightning CSS handles nesting, vendor prefixes and minification.
- Dynamic utility values: `grid-cols-15`, `mt-17` work without configuration; arbitrary spacing derives from `--spacing`.
- 3D transforms, `field-sizing`, `inset-shadow`, `not-*` variants, `starting:` variant for `@starting-style`, `nth-*`, `in-*` and `has-*` variants.
- Uses native cascade layers: `@layer theme, base, components, utilities;`.
- `@property` registered custom properties allow gradient and transition animations.

### Migration
`npx @tailwindcss/upgrade` automates much of the change (requires a clean git state): converts config to CSS, renames utilities, updates dependencies. Review `ring`/`border` colour defaults and removed deprecated utilities (`bg-opacity-*`, `flex-shrink-*`, `decoration-slice`).

### Runtime theming
Because tokens are CSS variables, you can switch themes by overriding variables on an element (`[data-theme="ocean"] { --color-primary: … }`), use them in inline styles and canvas/JS via `getComputedStyle`, and share them with non-Tailwind CSS.

## Follow-ups
- **Why `@theme inline`?** — To avoid resolving referenced variables at declaration time, preserving runtime overrides.
- **Is `tailwind.config.js` dead?** — It's optional; v4 can load it with `@config`, but new projects use CSS.

## Common Mistakes
- Using `@tailwind` directives from v3.
- Forgetting `@custom-variant dark` when using a class-based toggle.
- Expecting `@apply` to work in CSS Modules without `@reference`.

## Tips
- Say "tokens are CSS variables" and tie it to runtime theming.
