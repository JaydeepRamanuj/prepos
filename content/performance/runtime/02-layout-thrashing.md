---
title: "Layout thrashing and forced synchronous layout: find and fix it"
level: hard
type: debugging
tags: [layout-thrashing, reflow, forced-synchronous-layout, requestAnimationFrame, fastdom, resize-observer]
related: [performance/long-tasks-main-thread, performance/animation-performance-compositor, html-css/positioning-sticky-absolute]
---

## Question
This code resizes 2,000 elements to match the tallest one and takes 900 ms. Explain why, and fix it. List the properties and methods that force layout.

```js
const items = document.querySelectorAll(".card");
items.forEach((el) => {
  const h = el.offsetHeight;                 // read
  el.style.height = h + 20 + "px";           // write
});

function syncWidths() {
  for (const el of items) {
    el.style.width = el.parentElement.clientWidth / 2 + "px";
  }
}
```

## Clues
- The browser batches style/layout work lazily, but reading a layout property forces it to compute right away if styles are dirty.
- Interleaving reads and writes makes layout run once per iteration.
- Separate the phases: read everything first, then write everything.

## Interview Answer
Layout thrashing is repeatedly alternating DOM writes that invalidate layout with reads that need up-to-date layout, so the browser recalculates style and layout synchronously on each read ("forced synchronous layout") instead of once per frame. In the loop, `el.style.height = …` dirties layout, and the next iteration's `el.offsetHeight` forces a reflow, so 2,000 elements cause up to 2,000 layouts. The fix is to batch: first read all the measurements into an array, then write all the styles (two phases), ideally inside `requestAnimationFrame`. Better still, avoid measuring in JS: use CSS (flex/grid, `align-items: stretch`) or `ResizeObserver` instead of manual calculations. Libraries like FastDOM schedule reads and writes separately. In React, avoid reading layout in render and use `useLayoutEffect` sparingly, grouping measurements.

## Explanation
### Why it happens

```txt
Frame work normally:  JS (writes) → style → layout → paint → composite   (once per frame)

Thrashing:   write → read(force layout) → write → read(force layout) → …   (layout N times in one task)
```

Writes mark style/layout dirty. Reading a layout-dependent value requires a clean layout, so the browser must run it immediately.

### Fix: batch reads then writes

```js
const items = [...document.querySelectorAll(".card")];

// Phase 1: reads only
const heights = items.map((el) => el.offsetHeight);

// Phase 2: writes only
requestAnimationFrame(() => {
  items.forEach((el, i) => { el.style.height = heights[i] + 20 + "px"; });
});

function syncWidths() {
  const parent = items[0].parentElement;
  const half = parent.clientWidth / 2;                 // one read
  requestAnimationFrame(() => {
    for (const el of items) el.style.width = half + "px";   // writes
  });
}
```

### Avoid JS measuring where CSS can do it

```css
.row { display: grid; grid-auto-rows: 1fr; }          /* equal-height cards, no JS */
.card { width: 50%; }                                  /* half width via CSS */
```

### What forces layout (when styles/layout are dirty)

| Category | APIs |
|---|---|
| Element geometry | `offsetWidth/Height/Top/Left`, `clientWidth/Height/Top/Left`, `scrollWidth/Height/Top/Left`, `getBoundingClientRect()`, `getClientRects()`, `innerText`, `scrollIntoView()`, `focus()` (sometimes) |
| Computed style | `getComputedStyle(el).<layout prop>` (e.g. `width`, `height`, `display` after changes) |
| Window | `window.innerWidth/Height`, `scrollX/Y`, `visualViewport` reads in some cases |
| Misc | `elementFromPoint`, `Range.getBoundingClientRect`, `input.select()` |

Writes that dirty layout: changing `width/height/margin/padding/top/left/display/font-size`, adding/removing nodes, changing classes that affect geometry. Changes to `transform` and `opacity` don't affect layout.

### Better tools
- **`ResizeObserver` / `IntersectionObserver`**: get size/visibility without synchronous reads; callbacks are delivered after layout in the rendering cycle.
- **FastDOM**: `fastdom.measure(() => …)`, `fastdom.mutate(() => …)` batch automatically.
- **`requestAnimationFrame`**: schedule writes before paint; measure at the start of the frame.
- **CSS containment** (`contain: layout paint`, `content-visibility: auto`) limits the layout scope.
- **Class toggles** instead of many inline style writes; a single write that changes many elements.
- **`DocumentFragment`** or building off-DOM before inserting.
- **Virtualise** huge lists so fewer nodes need layout.

### Diagnose
- DevTools Performance: purple "Layout" blocks repeated inside one task, and warnings "Forced reflow is a likely performance bottleneck" with stack traces.
- Chrome's "Rendering → Layout Shift Regions/Paint flashing" for related issues.
- Lighthouse "Avoid an excessive DOM size" and "Minimize main-thread work".
- `performance.measure` around suspect code.

### In React
- Reading `getBoundingClientRect` in `useLayoutEffect` once per commit is fine; reading inside loops per item causes thrash. Batch measurements into one effect and set a single state.
- Prefer CSS and refs with observers (`ResizeObserver`) to JS-driven layout.
- Avoid layout reads in render or event handlers triggered at high frequency (scroll, mousemove) without throttling.

## Follow-ups
- **Does reading right after one write always thrash?** — No: one forced layout is normal; thrashing is the repeated alternation.
- **Is `transform` free?** — Mostly: it avoids layout and paint, only compositing, if the element is on its own layer.

## Common Mistakes
- Measuring in a loop that writes styles.
- Using `offsetHeight` as a hack to "force reflow" repeatedly.

## Tips
- Say "read phase, write phase" and name two forcing APIs.
