---
title: "The CSS box model, box-sizing and margin collapsing"
level: easy
type: concept
tags: [box-model, box-sizing, margin-collapse, padding, border]
related: [html-css/flexbox-vs-grid, html-css/positioning-sticky-absolute, html-css/specificity-cascade-inheritance]
---

## Question
Describe the CSS box model. What does `box-sizing: border-box` change, and when do vertical margins collapse?

## Interview Answer
Every element generates a rectangular box made of content, padding, border and margin, from the inside out. By default (`box-sizing: content-box`) the `width` and `height` properties set only the content box, so adding padding and border makes the element bigger than its declared width. With `box-sizing: border-box`, `width` includes content, padding and border, so sizes are predictable, which is why most resets apply it to everything. Vertical margins of adjacent block-level siblings (and of a parent and its first or last child when nothing separates them) collapse into the larger of the two rather than adding up; margins do not collapse for flex or grid items, floats, absolutely positioned elements, or when padding, border, or a new formatting context separates them. Percentage padding and margin resolve against the containing block's width.

## Explanation
### Anatomy

```txt
┌──────────── margin ─────────────┐
│ ┌────────── border ──────────┐  │
│ │ ┌──────── padding ───────┐ │  │
│ │ │        content         │ │  │
│ │ └────────────────────────┘ │  │
│ └────────────────────────────┘  │
└─────────────────────────────────┘
```

### content-box vs border-box

```css
.a { width: 200px; padding: 20px; border: 5px solid; }
/* content-box: total = 200 + 40 + 10 = 250px wide */

.b { box-sizing: border-box; width: 200px; padding: 20px; border: 5px solid; }
/* border-box: total = 200px; content shrinks to 150px */
```

Common reset:

```css
*, *::before, *::after { box-sizing: border-box; }
```

Tailwind's preflight applies this. Remember `min-width`/`max-width` and `height` also follow the box-sizing value.

### Margin collapsing

```css
.p1 { margin-bottom: 30px; }
.p2 { margin-top: 20px; }
/* gap between them: 30px (the larger), not 50px */
```

Rules:
- Only vertical (block-axis) margins collapse in normal block flow.
- Adjacent siblings collapse; a parent's top margin collapses with its first child's top margin if no border, padding, inline content or clearance separates them (the "child margin escapes parent" surprise).
- Empty blocks collapse their own top and bottom margins.
- Negative margins combine: the largest positive and the most negative are summed.

Prevent collapse:

```css
.container { display: flow-root; }       /* creates a block formatting context (clean fix) */
.container { padding-top: 1px; }         /* or border/padding separating them */
.stack { display: flex; flex-direction: column; gap: 1rem; }   /* flex/grid items never collapse */
```

### Useful details
- `margin: auto` centres block elements horizontally when width is set; in flex/grid it absorbs free space on that axis.
- Inline elements ignore vertical `width`/`height`/vertical margin; `display: inline-block` allows them.
- `outline` doesn't take space; `box-shadow` doesn't affect layout.
- `gap` (flex/grid) is preferred over margins for spacing between siblings, since margins couple siblings to their context.
- Logical properties: `margin-block`, `padding-inline` adapt to writing direction.
- Percent padding: `padding-top: 56.25%` was the old aspect-ratio hack; use `aspect-ratio: 16 / 9` now.

### Debugging
DevTools shows the box model diagram; toggle elements' layout overlays; use `outline: 1px solid red` for temporary boundaries (it doesn't affect layout, unlike `border`).

## Follow-ups
- **Does `border-box` include margin?** — No; margin is always outside the box.
- **Why do margins collapse?** — Historically for typographic spacing between paragraphs.

## Common Mistakes
- Forgetting that padding enlarges `content-box` elements and causes overflow at `width: 100%`.
- Expecting flex items' margins to collapse.

## Tips
- Mention `display: flow-root` and `gap` as modern fixes.
