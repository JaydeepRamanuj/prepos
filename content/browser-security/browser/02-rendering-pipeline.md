---
title: "Explain the browser rendering pipeline. What triggers layout, paint and composite?"
level: hard
type: concept
tags: [rendering, layout, paint, composite, reflow, cssom]
related: [browser-security/what-happens-when-you-type-a-url, performance/layout-thrashing, performance/inp-fixes]
---

## Question
Explain the rendering pipeline from DOM and CSSOM to pixels on screen. For each stage, tell me what kind of change forces the browser to redo it. Then explain why this snippet is slow and fix it:

```js
const items = document.querySelectorAll(".item");
items.forEach((el) => {
  el.style.width = el.parentElement.offsetWidth / 2 + "px";
});
```

## Clues
- Name the stages in order: style, layout, paint, composite. Which CSS properties only need the last one?
- What does reading `offsetWidth` force the browser to do if styles were just changed?
- Batch all the reads first, then all the writes.

## Interview Answer
The browser parses HTML into the DOM and CSS into the CSSOM, then for every frame it runs style recalculation (which rules apply to which elements), layout (the size and position of every box), paint (turning boxes into draw commands per layer) and composite (combining layers, usually on the GPU). Changing geometry like `width`, `top` or font size invalidates layout and everything after it; changing only visuals like `color` or `background` skips layout but needs paint; changing `transform` or `opacity` on an element with its own layer can be done by the compositor alone, which is why those are the properties to animate. The snippet is slow because each iteration writes a style and then the next iteration reads `offsetWidth`, so the browser has to run layout synchronously every loop — layout thrashing. The fix is to read all the values first, then write them all, so layout runs once.

## Explanation
### The stages

```txt
DOM + CSSOM
   │
   ▼
Style      which rules match, computed values          ← class/style changes
   │
   ▼
Layout     box geometry: x, y, width, height           ← width, height, margin, top,
   │                                                     font-size, adding/removing nodes
   ▼
Paint      fill pixels / draw lists per layer         ← color, background, box-shadow,
   │                                                     border-radius, visibility
   ▼
Composite  stack layers, apply transform/opacity       ← transform, opacity (on own layer)
   │
   ▼
Pixels
```

Two details people miss:
- The **render tree** (older term; Chrome now calls it the layout tree) contains only what is rendered. `display: none` elements are not in it; `visibility: hidden` elements are (they take space, they just are not painted).
- Every stage invalidates the ones **after** it. A layout change always means paint and composite too. A composite-only change skips all of the expensive work and can run even while the main thread is busy.

### What triggers what

| Change | Style | Layout | Paint | Composite |
|---|---|---|---|---|
| `width`, `padding`, `top`, `font-size`, insert DOM node | ✓ | ✓ | ✓ | ✓ |
| `color`, `background-color`, `box-shadow` | ✓ | – | ✓ | ✓ |
| `transform`, `opacity` (promoted layer) | ✓ | – | – | ✓ |

This is why "animate `transform: translateX()` instead of `left`" is the standard advice.

### Forced synchronous layout (layout thrashing)
Normally the browser is lazy: you change styles, and it runs style + layout once before the next frame. But if you **read** a geometry value (`offsetWidth`, `getBoundingClientRect()`, `scrollTop`, `getComputedStyle()`) after a **write**, the browser must run layout right now to give you a correct answer.

In the question, every iteration writes `el.style.width`, and the next iteration reads `offsetWidth` — so layout runs N times in one frame.

### The fix: read, then write

```js
const items = [...document.querySelectorAll(".item")];

// 1. Reads — layout runs at most once here
const widths = items.map((el) => el.parentElement.offsetWidth / 2);

// 2. Writes — no reads in between, so layout is deferred to the next frame
items.forEach((el, i) => {
  el.style.width = `${widths[i]}px`;
});
```

When reads and writes are spread across components, schedule writes in `requestAnimationFrame` so they run together just before the next frame. Even better, ask whether CSS can do it (`width: 50%` would remove the JavaScript entirely).

### Layers and `will-change`
The browser promotes some elements to their own compositor layer (video, canvas, 3D transforms, elements with `will-change: transform`). Layers make transform/opacity animations cheap, but each costs GPU memory. Add `will-change` just before an animation that needs it, not to every element.

### Containing the damage
- `contain: layout paint` tells the browser changes inside an element cannot affect outside it.
- `content-visibility: auto` skips rendering work for off-screen sections until they are near the viewport.

## Follow-ups
- **Is `display: none` vs `visibility: hidden` different for rendering?** — `display: none` removes the box from layout (toggling it triggers layout); `visibility: hidden` keeps the box and only skips painting it.
- **How do you see this in DevTools?** — The Performance panel shows purple "Layout" and green "Paint" blocks; forced reflows are flagged with a warning. Rendering → "Paint flashing" highlights repainted areas.
- **Does React avoid layout thrashing for you?** — React batches DOM writes in its commit phase, but `useLayoutEffect` code that measures and then sets state can still cause extra synchronous layouts.

## Common Mistakes
- Saying `transform` "never" triggers paint — it is compositor-only only when the element is on its own layer; otherwise it may repaint.
- Calling everything "reflow" — reflow means layout specifically; a colour change is a repaint without reflow.
- Adding `will-change` everywhere, which wastes memory and can make things slower.
- Thinking `requestAnimationFrame` alone fixes thrashing; you still have to separate reads from writes.

## Tips
- Memorise the chain **Style → Layout → Paint → Composite** and the rule "each stage invalidates everything after it". Every rendering performance question follows from those two lines.
- Mention you would confirm the problem in the Performance panel before optimising — it signals you measure first.
