---
title: "z-index and stacking contexts: why does my dropdown appear behind another element?"
level: hard
type: debugging
tags: [z-index, stacking-context, isolation, transform, overlay, top-layer]
related: [html-css/positioning-sticky-absolute, react/portals, html-css/accessible-modal-dialog]
---

## Question
A dropdown menu with `z-index: 9999` is hidden behind a sibling card, while a modal with `z-index: 10` shows above everything. Explain how stacking contexts work, what creates them, and how to fix such bugs systematically.

```html
<header class="header">           <!-- position: relative; z-index: 1 -->
  <div class="menu">…</div>      <!-- position: absolute; z-index: 9999 -->
</header>
<main>
  <article class="card">…</article>   <!-- position: relative; z-index: 2 -->
</main>
```

## Clues
- `z-index` only compares elements within the same stacking context.
- Some properties create a new stacking context even without `z-index`.
- The dropdown's ancestor has its own `z-index`.

## Interview Answer
Stacking contexts are isolated groups: a child's `z-index` only competes with siblings inside the same context, and the whole context is then ranked as a single unit against other contexts in its parent. The header creates a stacking context (`position: relative` with `z-index: 1`), so the menu's `9999` is only meaningful inside the header; the card's context has `z-index: 2`, which beats the whole header, so the entire header, including its menu, paints below the card. The fix is to raise the header's z-index above the card, to restructure so the menu isn't inside a lower context (portal the menu to `body`), or to use top-layer features (`<dialog>`, `popover`). New stacking contexts are created by the root element, positioned elements with a `z-index` other than `auto`, flex/grid children with `z-index`, and properties like `opacity < 1`, `transform`, `filter`, `will-change`, `isolation: isolate`, `position: fixed|sticky`, and `contain: paint|layout`. Using `isolation: isolate` deliberately scopes z-index values to a component.

## Explanation
### Paint order inside one context (low → high)

1. Context root's background/borders.
2. Negative `z-index` children.
3. In-flow, non-positioned block descendants.
4. Floats.
5. In-flow inline content.
6. `z-index: auto/0` positioned descendants (in DOM order).
7. Positive `z-index` children (ascending).

Elements with the same effective `z-index` stack by DOM order (later on top).

### The bug visualised

```txt
root context
├─ header   (z=1, creates context)  → paints as a unit at level 1
│   └─ menu (z=9999)                → only competes inside the header
└─ card     (z=2, creates context)  → level 2, above the whole header
```

`9999` inside level 1 can never beat level 2.

### What creates a stacking context
- Root `<html>`.
- `position: absolute | relative` with `z-index` not `auto`.
- `position: fixed | sticky` (always).
- Flex or grid item with `z-index` not `auto`.
- `opacity` below 1, `mix-blend-mode` not normal.
- `transform`, `filter`, `backdrop-filter`, `perspective`, `clip-path`, `mask`.
- `isolation: isolate`.
- `will-change` naming those properties.
- `contain: layout | paint | strict | content`.
- Container query containers (`container-type`), top layer elements.

Accidental culprits: `transform: translateZ(0)` hacks, hover effects with `transform` or `opacity`, animation libraries, `overflow` containers with `filter`.

### Fixes

```css
/* 1. Raise the context that contains the menu */
.header { position: relative; z-index: 10; }

/* 2. Render overlays at the root (portal) so they aren't trapped */
/* React: createPortal(<Menu />, document.body) */

/* 3. Scope component internals so z-index values don't leak */
.card { isolation: isolate; }

/* 4. Use the top layer for overlays */
dialog::backdrop { … }      /* <dialog>.showModal() and [popover] render above everything */

/* 5. Define a z-index scale with tokens */
:root { --z-dropdown: 100; --z-sticky: 200; --z-modal: 300; --z-toast: 400; }
```

### Debugging process
1. Inspect the hidden element; walk up ancestors looking for properties in the list above.
2. In Chrome DevTools use the Layers panel or "3D View"; Firefox shows stacking context info in the inspector (the "stacking context" badge); the "CSS Stacking Context inspector" extensions help.
3. Temporarily set `outline` on candidates, or disable properties to test.
4. Avoid escalating numbers (9999, 99999): fix structure instead.

### Best practices
- Keep a small z-index scale and document it.
- Prefer `isolation: isolate` on components to contain their z-index.
- Use portals or the top layer for modals, tooltips, toasts and dropdowns.
- Be careful with `overflow: hidden` + `position: absolute` dropdowns: clipping is separate from stacking (portals solve both).
- `z-index` has no effect on static elements (except flex/grid items).

## Follow-ups
- **Why does `opacity: 0.99` change stacking?** — It creates a stacking context, which can reorder how children layer against outside elements.
- **What is the top layer?** — A browser-managed layer above all stacking contexts for modal dialogs, popovers and fullscreen elements.

## Common Mistakes
- Increasing z-index numbers without checking parents.
- Applying `transform` to a wrapper and wondering why fixed children moved.

## Tips
- Say "z-index only competes within the same stacking context" first.
