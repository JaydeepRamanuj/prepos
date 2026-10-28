---
title: "Container queries and :has(): component-level responsive design"
level: hard
type: concept
tags: [container-queries, container-type, "has", parent-selector, responsive, container-units]
related: [html-css/css-units-and-clamp, html-css/grid-responsive-layouts, html-css/cascade-layers-nesting]
---

## Question
What are container queries and how do they differ from media queries? How do you set one up, what are container query units, and what can `:has()` do that wasn't possible before? Give real examples.

## Clues
- A container query asks about the size of an ancestor container, not the viewport.
- The container must opt in with `container-type`.
- `:has()` selects an element based on its descendants or following siblings.

## Interview Answer
Media queries respond to the viewport, but a reusable component can be placed in a narrow sidebar or a wide main area, so its layout should depend on the space it actually has. Container queries do that: you mark an ancestor with `container-type: inline-size` (optionally `container-name`), then write `@container (min-width: 30rem) { … }` rules that style descendants based on that container's width. Container query length units (`cqw`, `cqi`, `cqb`) size things relative to the container. `:has()` is a relational pseudo-class that lets a selector match an element based on what it contains or what follows it, enabling "parent selectors" such as `.card:has(img)` or form groups styled when an input is invalid. Both are supported in all modern browsers. Together they let components adapt to content and context without JavaScript or global breakpoints.

## Explanation
### Container queries

```css
.card-wrapper {
  container-type: inline-size;       /* size containment on the inline axis */
  container-name: card;              /* optional name */
}

.card { display: grid; gap: 1rem; }

@container card (min-width: 32rem) {
  .card { grid-template-columns: 12rem 1fr; }       /* horizontal layout when the wrapper is wide */
}

@container (width < 20rem) {
  .card .meta { display: none; }
}
```

- The queried container is the nearest ancestor with a matching `container-type` (and name if given). You can't style the container itself with its own query, only descendants.
- `container-type: inline-size` applies layout, style and inline-size containment: the container's inline size can't depend on its children. `size` also contains block size (rarely used). `normal` (default) makes it a style container only.
- Shorthand: `container: card / inline-size`.
- Range syntax: `@container (400px <= width < 800px)`.
- Style queries (`@container style(--theme: dark)`) are supported for custom properties in modern engines.

### Container units

```css
.card h2 { font-size: clamp(1rem, 4cqi, 2rem); }     /* 4% of the container's inline size */
```

`cqw/cqh` (1% of width/height), `cqi/cqb` (inline/block axes), `cqmin/cqmax`.

### Media vs container queries

| | Media query | Container query |
|---|---|---|
| Responds to | viewport / user preferences | size of an ancestor container |
| Use for | page-level layout, `prefers-*`, print | reusable components |
| Same component in sidebar vs main | same styles | adapts to each |
| Setup | none | `container-type` on an ancestor |

Use media queries for user preferences (`prefers-color-scheme`, `prefers-reduced-motion`, `hover`) and top-level layout; container queries for components.

### `:has()`

```css
/* Card layout changes if it contains an image */
.card:has(img) { grid-template-columns: 8rem 1fr; }

/* Style a field wrapper based on its input state */
.field:has(input:invalid:not(:placeholder-shown)) { --border: var(--danger); }
.field:has(input:focus-visible) { outline: 2px solid var(--ring); }

/* Lock scroll when a dialog is open */
body:has(dialog[open]) { overflow: hidden; }

/* Previous sibling: highlight a label before a checked radio */
label:has(+ input:checked) { font-weight: 600; }

/* Quantity-like logic: grid with 3+ children */
.list:has(> :nth-child(3)) { columns: 2; }

/* Dark mode toggle without JS */
:root:has(#theme-toggle:checked) { color-scheme: dark; }
```

Notes:
- `:has()` takes a relative selector list (`:has(> img)`, `:has(+ p)`).
- Specificity is that of its most specific argument.
- It can't be nested inside another `:has()`, and pseudo-elements aren't allowed inside it.
- Performance is good in modern engines; avoid extremely broad uses like `*:has(...)` on huge DOMs.

### Practical uses
- Responsive cards, media objects, dashboards widgets, design system components.
- Parent-aware styling (form groups, table rows with checkboxes).
- Replacing JS class toggling for state styling.

### Gotchas
- Container queries need the container to have a definable inline size; `inline-size` containment prevents shrink-wrapping (`display: inline` containers or auto-width ones may collapse).
- Container units fall back to the small viewport units if no container applies.
- Tailwind v4 includes `@container` support (`@container`, `@md:`/`@lg:` variants).
- Don't wrap everything in containers; use them on layout boundaries.

## Follow-ups
- **Can a container query style the container itself?** — No; only descendants, to avoid circular dependencies.
- **Is `:has()` a performance risk?** — It was a concern; modern browsers optimise it, but be reasonable.

## Common Mistakes
- Forgetting `container-type` (the query silently never matches).
- Querying the same element that is the container.
- Overusing `:has()` for logic better placed in markup/state.

## Tips
- Give the "same card in a sidebar and in main" example for containers.
