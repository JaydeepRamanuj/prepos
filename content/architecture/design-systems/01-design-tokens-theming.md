---
title: "Design tokens and theming: structure, naming and runtime switching"
level: medium
type: design
tags: [design-tokens, theming, css-variables, dark-mode, semantic-tokens, tailwind]
related: [architecture/design-system-component-api, html-css/tailwind-v4-css-first, architecture/version-design-system]
---

## Question
How would you structure design tokens for a product with light/dark themes and multiple brands? Explain primitive vs semantic tokens, naming, how they map to CSS variables and Tailwind, and how to switch themes without a flash.

## Interview Answer
Design tokens are named design decisions (colour, spacing, type, radius, shadow, motion) stored as data so design and code share one source of truth. I structure them in layers: primitive (reference) tokens like `blue-600` or `space-4` hold raw values; semantic (alias) tokens like `color-bg-surface`, `color-text-muted`, `color-action-primary` describe intent and reference primitives; and optionally component tokens like `button-bg` reference semantic ones. Themes (light, dark, brand B) only remap semantic tokens to different primitives, so components never reference raw colours. In CSS they become custom properties on `:root` and theme scopes (`[data-theme="dark"]`), exposed to Tailwind via `@theme inline`, and stored in a source format (Style Dictionary or the W3C Design Tokens JSON) from which platform outputs are generated. To avoid a flash, I set the theme attribute before first paint using a cookie read on the server or a tiny inline script, set `color-scheme`, and respect `prefers-color-scheme` as the default.

## Explanation
### Layers

```txt
primitives (what exists)      semantic (what it's for)          component (optional)
blue-600: #2445c9      →      color-action-primary: {blue-600}  →  button-primary-bg: {color-action-primary}
gray-50 / gray-900            color-bg-page / color-text-body
space-1..12, radius-sm..lg    space-inset-card, radius-control
```

- **Primitives** change rarely and are not used directly in product code.
- **Semantic tokens** are what components consume; they are the theming surface.
- **Component tokens** reduce coupling when many variants exist, but add indirection, so use sparingly.

### Naming
Pattern: `category-property-role-state` (`color-text-muted`, `color-border-focus`, `space-stack-md`). Name by purpose, not appearance: `color-danger`, not `color-red`. Keep the vocabulary small and documented; avoid numeric suffix proliferation in semantic layers.

### Source format and build
Use a tool-neutral source (W3C Design Tokens JSON `$value`/`$type`, or Tokens Studio exports) and generate outputs with Style Dictionary or similar:

```json
{
  "color": {
    "blue": { "600": { "$type": "color", "$value": "#2445c9" } },
    "action": { "primary": { "$type": "color", "$value": "{color.blue.600}" } }
  }
}
```

Outputs: CSS variables, Tailwind theme, TypeScript constants, iOS/Android tokens. Version tokens as part of the design system package.

### CSS implementation

```css
:root {
  --blue-600: #2445c9;
  --blue-300: #93a9ff;
  --gray-50: #f5f6f8;
  --gray-900: #172033;

  --color-bg: var(--gray-50);
  --color-text: var(--gray-900);
  --color-action: var(--blue-600);
  color-scheme: light;
}

[data-theme="dark"] {
  --color-bg: #0e1424;
  --color-text: #e5e8f1;
  --color-action: var(--blue-300);
  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --color-bg: #0e1424; /* … */ color-scheme: dark; }
}
```

Tailwind v4 mapping:

```css
@theme inline {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-text);
  --color-primary: var(--color-action);
}
```

Components use `bg-background text-foreground bg-primary`; switching the data attribute updates everything with no rebuild. (This repository follows the same pattern: notebook tokens in `:root`/`.dark`, shadcn semantic aliases on top.)

### Multiple brands
Add brand scopes remapping semantic tokens (`[data-brand="acme"] { --color-action: …; --radius-control: 2px; }`). Because components only know semantic tokens, white-labelling is a token swap. Consider the explosion of theme × brand × mode combinations; test with visual regression.

### Avoiding the theme flash
1. **Server-known preference** (cookie): render `<html data-theme="dark">` on the server (read `cookies()` in the root layout).
2. **No cookie yet**: inline script in `<head>` before CSS paints:

```html
<script>
  try {
    const t = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = t;
  } catch {}
</script>
```

with `suppressHydrationWarning` on `<html>` in React. Libraries like `next-themes` implement this.
3. Respect `color-scheme` so native controls and scrollbars match.
4. Transition between themes carefully (disable transitions on switch to avoid flicker).

### Governance and quality
- **Contrast** built into tokens: ensure semantic pairs (`text` on `bg`, `action` on `action-contrast`) meet WCAG AA in every theme; test automatically with a contrast script over token pairs.
- **No hardcoded values** in components: lint for hex colours and magic pixels; use design-token lint rules.
- **Token deprecation policy**: alias old names to new ones for a release cycle; document in a changelog.
- **Figma ↔ code sync**: Figma variables mirror tokens; pipeline syncs both ways or treats code as source.
- **Documentation**: a token browser in Storybook (swatches, usage).

### Non-colour tokens
Spacing scale (4px base), type scale with line heights, radii, shadows/elevation, z-index scale, breakpoints, durations/easing, opacity. Respect `prefers-reduced-motion` by remapping duration tokens to near zero.

## Follow-ups
- **CSS variables vs build-time theming?** — Variables allow runtime switching and per-subtree themes; build-time theming bakes values and needs separate bundles.
- **Why semantic tokens rather than just `primary`/`secondary`?** — They express roles (surface, border, text-muted) that map to many components and survive rebrands.

## Common Mistakes
- Components using primitive colours directly.
- Theme implemented with duplicated component CSS.
- Flash of the wrong theme at load.

## Tips
- Say "primitives → semantic → component, themes remap semantics".
