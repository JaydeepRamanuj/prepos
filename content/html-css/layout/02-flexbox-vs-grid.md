---
title: "Flexbox vs Grid: one dimension or two? How to choose"
level: medium
type: concept
tags: [flexbox, grid, layout, alignment, gap, subgrid]
related: [html-css/flexbox-sizing-min-width, html-css/grid-responsive-layouts, html-css/container-queries-has]
---

## Question
Explain the difference between Flexbox and CSS Grid. When would you use each, how does alignment work in both, and what is subgrid?

## Interview Answer
Flexbox lays items out along a single axis (a row or a column), distributing space and aligning items based on content size; it's best for components like navbars, toolbars, button groups, and centring. Grid is two-dimensional: you define rows and columns and place items into the resulting cells, so it fits page layouts, card galleries, dashboards and anything where alignment across both axes matters. Both support `gap` and alignment properties (`justify-content`, `align-items`, `place-items`). In flexbox, sizing is content-out (items size themselves and flex), while grid is layout-in (the track definitions drive item sizes). They combine well: a grid for page structure with flex inside components. Subgrid lets a nested grid adopt its parent's tracks, so nested content aligns with the outer grid.

## Explanation
### Mental models

```txt
Flex (1D):  [ A ][ B ][  C  ]  →  main axis (wraps into new lines if allowed)

Grid (2D):  ┌───┬─────┬───┐
            │ A │  B  │ C │   rows and columns defined up front
            ├───┼─────┴───┤
            │ D │    E    │
            └───┴─────────┘
```

### Typical flex use

```css
.nav { display: flex; align-items: center; gap: 1rem; }
.nav .spacer { margin-inline-start: auto; }       /* pushes following items to the end */

.center { display: flex; justify-content: center; align-items: center; min-height: 100dvh; }
/* or: display: grid; place-items: center; */
```

### Typical grid use

```css
.layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  min-height: 100dvh;
  gap: 1rem;
}
.layout > header { grid-area: header; }
.layout > aside  { grid-area: sidebar; }
.layout > main   { grid-area: main; }
.layout > footer { grid-area: footer; }
```

### Alignment cheat sheet

| Property | Flex | Grid |
|---|---|---|
| `justify-content` | distributes items along the main axis | distributes tracks in the inline axis (when tracks don't fill the container) |
| `align-items` | cross-axis alignment of items in a line | block-axis alignment of items in their cells |
| `justify-items` | n/a | inline-axis alignment in cells |
| `align-content` | cross-axis distribution of lines (wrapping) | block-axis distribution of tracks |
| `place-items` / `place-content` | shorthand | shorthand |
| `align-self` / `justify-self` | per item | per item |

### Choosing

| Scenario | Pick |
|---|---|
| Row of buttons/inputs, navbar, tags | Flex |
| Centre one thing | either (`grid` + `place-items: center` is shortest) |
| Card gallery with equal columns | Grid (`repeat(auto-fill, minmax(...))`) |
| Page with header/sidebar/main/footer | Grid |
| Content-driven distribution where items vary in width | Flex |
| Overlapping elements | Grid (place items in the same cell) |
| Unknown number of items with wrapping lines | Flex wrap or Grid auto-fill |
| Aligning inner parts of different cards | Grid + subgrid |

### Subgrid

```css
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.card  { display: grid; grid-row: span 3; grid-template-rows: subgrid; }   /* title, body, footer rows align across cards */
```

Supported in all modern browsers (since Chrome 117).

### Other notes
- `gap` works in flex and grid; it replaces margin hacks.
- Flex items have `min-width: auto`, which can cause overflow with long content (see the flex sizing question).
- Grid items also have `min-width: auto` implications in `1fr` tracks: use `minmax(0, 1fr)` to allow shrinking.
- `display: contents` removes a box from the layout tree while keeping children (use carefully for accessibility).
- Source order vs visual order: reordering with `order`/`grid-area` doesn't change tab order.

## Follow-ups
- **Can you nest grid in flex?** — Yes, nest any combination.
- **Flex or grid for equal-height cards?** — Both work (`align-items: stretch` is the default in flex); grid is easier for aligning card internals.

## Common Mistakes
- Using grid when content-driven flex would be simpler, or flex hacks for 2D layouts.
- Forgetting `minmax(0, 1fr)`.

## Tips
- Say "content-out vs layout-in" and mention subgrid.
