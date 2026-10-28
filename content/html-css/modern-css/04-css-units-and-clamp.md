---
title: "CSS units and fluid sizing: rem, em, vw, dvh, clamp() and accessible type"
level: medium
type: concept
tags: [units, rem, em, viewport-units, clamp, fluid-typography, dvh]
related: [html-css/grid-responsive-layouts, html-css/container-queries-has, html-css/box-model-sizing]
---

## Question
Compare `px`, `rem`, `em`, `%`, `vw/vh`, `dvh/svh/lvh`, `ch` and `cqi`. When do you use each? How do `clamp()`, `min()` and `max()` produce fluid typography and spacing without media queries, and how do you keep text accessible when users zoom or change font size?

## Interview Answer
`px` is an absolute CSS pixel; `rem` is relative to the root font size and respects user preferences, so I use it for font sizes, spacing and breakpoints; `em` is relative to the element's own font size (or the parent's for `font-size`), which is useful for components that scale with their text, such as button padding; `%` is relative to the containing block (width for most properties); `vw/vh` are viewport percentages, and on mobile the dynamic units `dvh`, `svh` and `lvh` handle the collapsing browser toolbar (`dvh` for full-screen layouts); `ch` is the width of the `0` glyph, ideal for readable line lengths like `max-width: 65ch`; and `cqi` is relative to a container. `clamp(min, preferred, max)` gives fluid values: `font-size: clamp(1rem, 0.9rem + 1vw, 1.5rem)` grows with the viewport between bounds. For accessibility, avoid pure `vw` sizes (they don't respond to zoom), mix `rem` into the preferred value, and never set `html { font-size: 62.5% }` hacks that make users' default smaller.

## Explanation
### Units summary

| Unit | Relative to | Good for |
|---|---|---|
| `px` | CSS pixel | borders, hairlines, shadows |
| `rem` | root `font-size` (default 16px) | type, spacing, media queries, most sizing |
| `em` | element's font-size | padding that scales with text, icons next to text |
| `%` | containing block | widths, fluid layouts (height only if parent has height) |
| `vw`, `vh` | 1% of viewport width/height | full-bleed sections, fluid type (with caution) |
| `svh`, `lvh`, `dvh` | small / large / dynamic viewport height | mobile full-height layouts (`min-height: 100dvh`) |
| `vmin`, `vmax` | smaller/larger viewport dimension | squares, backgrounds |
| `ch` | width of "0" in the font | line length, code columns |
| `lh`, `rlh` | line height of element / root | vertical rhythm |
| `cqi`, `cqw` | container size | component-relative scaling |
| `fr` | grid free space | grid tracks |

### Fluid sizing with `clamp()`

```css
:root {
  --step-0: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --step-3: clamp(1.75rem, 1.2rem + 2.5vw, 3rem);
}
h1 { font-size: var(--step-3); }

.container { width: min(100% - 2rem, 72rem); margin-inline: auto; }     /* responsive width with gutters */
.section { padding-block: clamp(2rem, 6vw, 6rem); }
```

- `min(a, b)` picks the smaller (a cap), `max(a, b)` the larger (a floor), `clamp(min, val, max)` both.
- Calculations can mix units: `calc(100% - 2rem)`, `max(1rem, 2vw)`.
- Typography: tools like Utopia generate fluid type scales.

### Accessibility of units
- Users change browser default font size; `rem` follows it, `px` doesn't. WCAG 1.4.4 requires text to resize to 200% without loss.
- Pure viewport units (`font-size: 4vw`) do not scale with browser zoom in the expected way: always add a `rem` component in `clamp`.
- Avoid `html { font-size: 62.5% }`; instead use `rem` values like `1.5rem` directly or variables.
- Media queries in `em`/`rem` respond to user font-size settings; `px` queries don't.
- Respect `prefers-reduced-motion`, `prefers-contrast` and `forced-colors` too.

### Viewport units on mobile

```css
.hero { min-height: 100vh; }      /* jumps when the address bar hides on mobile */
.hero { min-height: 100svh; }     /* always fits the smallest viewport */
.app  { height: 100dvh; }         /* tracks the visible viewport (may reflow while scrolling) */
```

Use `svh` for hero sections (stable), `dvh` for app shells that should fill the visible area.

### Line length and rhythm

```css
.prose { max-width: 65ch; line-height: 1.6; }
.prose > * + * { margin-block-start: 1em; }
```

### Logical properties
Prefer `margin-inline`, `padding-block`, `inset-inline-start`, `inline-size`, `block-size` so layouts work in RTL and vertical writing modes.

### Gotchas
- `em` compounding in nested elements (nested lists with `font-size: 0.9em`).
- Percent heights need a defined parent height.
- `vw` includes the scrollbar width, causing horizontal overflow with `width: 100vw`; use `100%` or `100dvw` carefully.
- Browser minimum font-size settings can override small `px` sizes.

## Follow-ups
- **`rem` vs `em` for media queries?** — Both depend on the browser default, not on the root override; use `em` or `rem` consistently.
- **Why not `html { font-size: 62.5% }`?** — It breaks user preferences when combined with px-based assumptions and complicates inheritance.

## Common Mistakes
- Using only `vw` for text.
- `100vh` full-screen sections on mobile.
- Mixing `px` spacing and `rem` text and then breaking at larger user fonts.

## Tips
- Mention `dvh/svh`, `ch` for readable lines, and `clamp` with a rem term.
