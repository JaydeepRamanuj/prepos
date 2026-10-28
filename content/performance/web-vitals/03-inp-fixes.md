---
title: "How do you diagnose and improve poor INP?"
level: hard
type: scenario
tags: [inp, long-tasks, event-handlers, loaf, hydration, yielding]
related: [performance/core-web-vitals-overview, performance/long-tasks-main-thread, react/use-transition, performance/third-party-scripts]
---

## Question
Field data shows INP of 480 ms on a product listing page. Explain what INP measures, how to find which interactions are slow, and the techniques to reduce each part: input delay, processing time and presentation delay.

## Clues
- INP = input delay + processing time + presentation delay for the worst interaction.
- The Long Animation Frames API shows which scripts block frames.
- Don't do heavy work synchronously in an event handler; yield or defer it.

## Interview Answer
INP records, for each click, tap or key press, the time from the user's input until the browser paints the next frame, and reports roughly the slowest interaction of the visit. I split it into three parts. Input delay is time waiting because the main thread is busy (long tasks, hydration, third-party scripts, timers), processing time is how long the event handlers run, and presentation delay is style, layout and paint after handlers finish (large DOM, forced reflow, expensive rendering). To find the culprits I use field attribution (`web-vitals/attribution` gives the interaction target, phases, and LoAF scripts) and the DevTools Performance panel's Interactions track with CPU throttling. Fixes: break up long tasks and yield (`scheduler.yield()`, `setTimeout`), keep handlers small and do only the visual update first, defer non-urgent work (`requestIdleCallback`, transitions), reduce rendering cost (smaller DOM, `content-visibility`, memoisation, virtualisation), remove or delay third-party scripts, and move heavy computation to Web Workers.

## Explanation
### Anatomy of an interaction

```txt
pointerdown ──▶ [input delay] ──▶ [event handlers: processing time] ──▶ [style/layout/paint: presentation delay] ──▶ next frame
                 main thread        click handler, state updates         DOM size, layout, rendering
                 was busy
```

Threshold: ≤ 200 ms good, > 500 ms poor (p75).

### Find the slow interactions
1. **Field**: RUM with `web-vitals/attribution`: `interactionTarget`, `inputDelay`, `processingDuration`, `presentationDelay`, `longAnimationFrameEntries` (scripts with source URLs and function names).
2. **CrUX/PageSpeed** to confirm real-user impact; Search Console groups URLs.
3. **Lab**: DevTools Performance → record, interact (menus, filters, add to cart), look at the Interactions track; use 4–6× CPU throttling to mimic mid-range phones; "Core Web Vitals" overlay in DevTools.
4. Reproduce the specific interaction, not page load.

### Reduce input delay
- Break long tasks (> 50 ms), especially around load: hydration, analytics init, large JSON parsing.
- Delay or lazy-load third-party scripts; use `async`/`defer`, `requestIdleCallback`, or on-interaction loading.
- Avoid timers or polling that run heavy callbacks.
- Reduce hydration cost: smaller client bundles, Server Components, selective hydration, lazy-loaded components.

### Reduce processing time

```js
button.addEventListener("click", async () => {
  // 1. Do the minimal visual update first
  showSpinner();
  await yieldToMain();                // let the browser paint

  // 2. Then heavier work
  const result = await heavyWork();   // or move to a worker
  render(result);
});

const yieldToMain = () =>
  globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0));
```

- Avoid synchronous heavy loops, sorting/filtering large arrays, `JSON.parse` of big payloads inside handlers.
- Debounce/throttle input handlers (`onChange` filters); in React use `useDeferredValue`/`useTransition` so urgent updates paint first.
- Avoid triggering many state updates that each re-render large trees; batch and memoise, or move state down.
- Use `passive` listeners for scroll/touch.

### Reduce presentation delay
- Keep the DOM small (< ~1,500 nodes is a good target); virtualise long lists.
- Avoid layout thrashing (interleaved reads and writes of layout properties).
- `content-visibility: auto` for off-screen sections.
- Animate with `transform`/`opacity`; avoid animating layout properties.
- Avoid expensive CSS (large blurs, huge box-shadows) on interactive elements.
- Reduce style recalculation scope (simpler selectors, containment: `contain: layout paint`).

### Framework-specific tips (React/Next.js)
- Use the React Profiler to find components re-rendering on interaction; apply colocated state, `memo`, the React Compiler, or virtualization.
- `startTransition` for non-urgent state updates (filters, tab switches).
- Server Components reduce client JavaScript and hydration.
- Avoid `useEffect` chains that trigger cascades of renders.
- Lazy-load heavy components below the fold or on interaction.

### Example: filter input
Before: each keystroke filters 5,000 products synchronously and re-renders the grid (processing 350 ms + presentation 120 ms).
After: input state updates immediately; `useDeferredValue` for the query feeding a memoised, virtualised list; filtering moved to a memoised selector; result INP ≈ 120 ms.

### Validate
Compare p75 INP by interaction type before and after in RUM, run lab traces with throttling, and add a monitoring alert on INP regressions per release.

## Follow-ups
- **Why doesn't scroll count for INP?** — INP measures discrete interactions (tap, click, key); scrolling is handled by the compositor and measured elsewhere.
- **Do hover or focus count?** — No, only click, tap and keyboard interactions (pointer down/up, key down/up grouped into an interaction).

## Common Mistakes
- Optimising load-time JS but ignoring interaction-time work.
- Making handlers async without yielding (still blocks until the heavy part runs).
- Measuring on a fast desktop only.

## Tips
- State the three components of INP and map each fix to one.
