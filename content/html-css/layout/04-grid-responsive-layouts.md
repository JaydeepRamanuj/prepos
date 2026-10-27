---
title: "Build responsive layouts with CSS Grid: auto-fit, minmax and the holy grail"
level: medium
type: implement
tags: [grid, auto-fit, auto-fill, minmax, responsive, grid-template-areas]
related: [html-css/flexbox-vs-grid, html-css/css-units-and-clamp, html-css/container-queries-has]
---

## Question
Implement two layouts with CSS Grid and no media queries where possible:
1. A card gallery that fits as many 240px+ columns as possible and stretches them evenly.
2. A page with header, sidebar, main and footer where the sidebar stacks above the content on narrow screens and the footer sticks to the bottom on short pages.

## Interview Answer
For the gallery, `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` creates as many columns as fit, each at least 240px and sharing leftover space; `auto-fit` collapses empty tracks so a few cards stretch, while `auto-fill` keeps empty tracks. For the page layout I use `grid-template-areas` with a two-column definition and `min-height: 100dvh` on the container, giving `main` `1fr` height so the footer sits at the bottom. On narrow screens, I redefine the areas in a media query (or container query) to stack. I use `minmax(0, 1fr)` where content might overflow, and `gap` for spacing.

## Explanation
### 1. Card gallery

```css
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 1rem;
}
```

- `minmax(240px, 1fr)`: each track at least 240px, then grows equally.
- `min(240px, 100%)` prevents overflow on screens narrower than 240px.
- `auto-fit` vs `auto-fill`: with 2 cards in a wide container, `auto-fit` stretches the 2 cards across the row (empty tracks collapse to 0); `auto-fill` keeps the empty tracks, so cards stay 240px-ish wide.

```html
<ul class="gallery">
  <li class="card">…</li> <li class="card">…</li> <li class="card">…</li>
</ul>
```

### 2. Page layout

```css
.page {
  display: grid;
  min-height: 100dvh;
  grid-template-columns: 16rem minmax(0, 1fr);
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
  gap: 0;
}
.page > header { grid-area: header; }
.page > nav    { grid-area: sidebar; }
.page > main   { grid-area: main; min-width: 0; }
.page > footer { grid-area: footer; }

@media (max-width: 48rem) {
  .page {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "header"
      "sidebar"
      "main"
      "footer";
  }
}
```

`grid-template-rows: auto 1fr auto` gives the middle row all leftover height, so the footer sits at the bottom even with little content. `100dvh` uses the dynamic viewport height (mobile browser UI aware); `100vh` can cause jumpiness.

### Sticky footer alternative with flex

```css
body { min-height: 100dvh; display: flex; flex-direction: column; }
main { flex: 1; }
```

### Other useful patterns

```css
/* Equal-height sidebar + content, sidebar width by content */
.with-sidebar { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2rem; }

/* Dense masonry-like packing (not true masonry) */
.tiles { display: grid; grid-auto-flow: dense; grid-auto-rows: 8rem; grid-template-columns: repeat(4, 1fr); }
.tile.wide { grid-column: span 2; }

/* Overlap in the same cell */
.hero { display: grid; }
.hero > * { grid-area: 1 / 1; }          /* image and text stacked */

/* Centre with max width and gutters (full-bleed system) */
.content {
  display: grid;
  grid-template-columns: 1fr min(65ch, 100% - 2rem) 1fr;
}
.content > * { grid-column: 2; }
.content > .full { grid-column: 1 / -1; }
```

### Key concepts
- `fr` shares leftover space after fixed tracks and content minima; `1fr` = `minmax(auto, 1fr)`, hence `minmax(0, 1fr)` for shrinkability.
- Implicit tracks: `grid-auto-rows`, `grid-auto-columns`, `grid-auto-flow`.
- Lines are numbered from 1; negative numbers count from the end (`-1` is the last line).
- `grid-template-areas` makes layouts readable and easy to rearrange in media queries.
- Container queries can swap the grid template based on the component's width rather than the viewport.
- Reading order: reordering areas visually doesn't change DOM/tab order; keep logical order in HTML.

## Follow-ups
- **When use `auto-fill`?** — When you want a consistent column width even if there are few items.
- **Masonry?** — `grid-template-rows: masonry` is being standardised (experimental); otherwise columns (`column-count`) or JS.

## Common Mistakes
- Using `1fr` and getting overflow from long content.
- Using `100vh` for full-page layouts on mobile.
- Forgetting `min(240px, 100%)` for small screens.

## Tips
- Say "auto-fit + minmax gives responsive columns without media queries".
