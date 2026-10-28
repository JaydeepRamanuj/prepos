---
title: "CSS positioning: static, relative, absolute, fixed and sticky (and why sticky fails)"
level: medium
type: concept
tags: [position, sticky, absolute, fixed, containing-block, overflow]
related: [html-css/stacking-contexts, html-css/box-model-sizing, html-css/flexbox-vs-grid]
---

## Question
Explain the `position` values and their containing blocks. Why does `position: sticky` sometimes not stick, and why does `position: fixed` sometimes behave like absolute?

## Interview Answer
`static` is normal flow. `relative` keeps the element in flow but allows offsets from its normal position and makes it a positioning reference for absolutely positioned descendants. `absolute` removes the element from flow and positions it relative to the nearest positioned ancestor (anything other than `static`), or the initial containing block. `fixed` positions relative to the viewport and stays during scrolling. `sticky` is a hybrid: the element behaves as relative until its scroll position crosses a threshold (`top`, `bottom`, `left`, `right`), then sticks while staying inside its parent. Sticky fails when no threshold is set, when an ancestor has `overflow` other than `visible` (that ancestor becomes the scroll container), when the parent is not taller than the element, or when the element's flex/grid alignment stretches it. Fixed behaves like absolute when an ancestor has `transform`, `filter`, `perspective`, `contain` or `will-change` of those, because that ancestor then becomes the containing block.

## Explanation
### Values

| Value | In flow? | Offset reference | Notes |
|---|---|---|---|
| `static` | yes | — | default; `top/left` ignored |
| `relative` | yes (space reserved) | its own normal position | creates a reference for children |
| `absolute` | no | nearest positioned ancestor's padding box | needs `top/left/…` or it stays at its static position |
| `fixed` | no | viewport (or transformed ancestor) | |
| `sticky` | yes | scroll container + threshold | only moves within its parent |

```css
.card { position: relative; }
.card .badge { position: absolute; top: 8px; right: 8px; }      /* anchored to the card */

.header { position: sticky; top: 0; z-index: 10; background: Canvas; }

.toast { position: fixed; inset-inline: 1rem; bottom: 1rem; }
```

`inset: 0` shorthand sets top/right/bottom/left; an absolutely positioned element with `inset: 0` fills its containing block.

### Why `sticky` doesn't work

1. **No threshold**: `position: sticky` needs `top`, `bottom`, etc.
2. **Ancestor overflow**: `overflow: hidden | auto | scroll` on any ancestor (between the sticky element and the intended scroller) makes that ancestor the sticky reference; if it doesn't scroll, nothing sticks. Fix by removing overflow or using `overflow: clip`.
3. **Parent too short**: a sticky element can't leave its parent's box; when the parent scrolls out of view the element goes with it.
4. **Flex/grid stretching**: in a flex row, `align-items: stretch` makes the sticky sidebar as tall as its parent, so there's no room to stick. Use `align-self: flex-start`.
5. **Table cells**: sticky works on `th` in modern browsers but not on all table elements, depending on the context.
6. **Height 100% parent** or `display: contents` surprises.

```css
.layout { display: flex; align-items: flex-start; }      /* or align-self on the sidebar */
.sidebar { position: sticky; top: 1rem; }
```

### Why `fixed` stops being fixed
If any ancestor has `transform`, `perspective`, `filter`, `backdrop-filter`, `contain: paint/layout`, or `will-change` of those properties, it becomes the containing block for `fixed` descendants, so they scroll with that ancestor. Common culprit: animated wrappers or modals rendered inside transformed containers. Fix by rendering overlays in a portal at the body level.

### Offsets and sizing
- Absolute elements' percentages refer to the containing block's padding box.
- `top` + `bottom` with `height: auto` stretches the element between them.
- `margin: auto` with all four insets set centres an element of known size (`inset: 0; margin: auto; width: 20rem; height: 10rem`).
- Absolutely positioned elements don't affect their parent's height; parents may collapse.

### Mobile viewport fixed
`position: fixed; bottom: 0` can jump on mobile with dynamic toolbars; use `dvh` units and `env(safe-area-inset-bottom)`.

### Alternatives
- Layout with flex/grid before reaching for absolute.
- `anchor-positioning` (CSS Anchor Positioning API) positions popovers relative to anchors with fallbacks (supported in Chromium; check browser support).
- The Popover API + top layer for tooltips, menus.

## Follow-ups
- **`position: relative` without offsets?** — Still creates a containing block for absolute descendants and enables `z-index`.
- **`sticky` vs `fixed` header?** — Sticky keeps the header in flow (no layout jump) and respects its container.

## Common Mistakes
- Forgetting `position: relative` on the parent of an absolute child.
- Hiding overflow on a wrapper and breaking sticky.

## Tips
- Memorise the sticky checklist (threshold, overflow, parent height, stretch).
