---
title: "Find and fix a memory leak in a single-page app using Chrome DevTools"
level: hard
type: debugging
tags: [memory-leak, heap-snapshot, detached-dom, event-listeners, devtools, garbage-collection]
related: [javascript/closure-memory-leaks, react/use-effect-cleanup, javascript/map-set-weakmap-weakset]
---

## Question
Users report that after an hour in your dashboard the tab uses 1.5 GB and becomes sluggish. How do you confirm it's a leak, locate it with DevTools, and what are the usual causes in React/SPA apps?

## Clues
- Memory that grows after repeating an action and forcing GC is a leak.
- Heap snapshot comparison shows which objects accumulate and what retains them.
- "Detached" DOM nodes are removed from the document but still referenced.

## Interview Answer
First I confirm it: use the Performance monitor or Memory panel's timeline, repeat a suspect action (open/close a modal, navigate between routes) several times, force garbage collection, and see whether the baseline rises. To locate it, I take a heap snapshot, perform the action several times, take another, and use the Comparison view to see objects that grew, or the allocation timeline for retained allocations. Searching for "Detached" shows DOM nodes removed from the tree but still referenced, and the Retainers panel shows the reference chain (for example an event listener, closure, global variable, timer or cache). Common causes in SPAs are event listeners and timers not removed on unmount, subscriptions (WebSocket, observers) not cleaned up, closures capturing large objects, unbounded caches or global arrays, detached DOM nodes held by variables, stale references in module state, and per-render allocations such as new `Map`s stored globally. Fixes are cleanup in effects, `AbortController`, `WeakMap`/`WeakRef` for caches keyed by objects, bounded LRU caches, and removing references on unmount.

## Explanation
### Confirm
1. DevTools → Performance monitor (JS heap size, DOM nodes, event listeners) or the Memory tab "Allocation instrumentation on timeline".
2. Click the trash can icon (force GC), note the baseline.
3. Repeat the action N times (e.g. open/close a modal 10×), force GC again.
4. A staircase pattern (each cycle leaves more) indicates a leak; a sawtooth returning to baseline is normal.

Growth that stabilises is usually cache/working set, not a leak.

### Locate with heap snapshots (3-snapshot technique)
1. Load the page, perform the action once (warm up lazy initialisation), take snapshot A.
2. Perform the action several times, take snapshot B.
3. Perform it several more times, take snapshot C.
4. In snapshot C choose "Objects allocated between Snapshot B and Snapshot C" (or compare B and C); anything still alive that should have been freed is suspect.
5. Sort by Retained Size or # New; filter by "Detached" to list orphaned DOM nodes.
6. Select an object → Retainers panel: follow the path to a GC root (window, listener, closure context, timer).

```txt
Detached <div class="modal"> ← context in closure ← event listener on window ← (GC root)
```

### Typical sources

| Source | Example | Fix |
|---|---|---|
| Listeners | `window.addEventListener("resize", handler)` without removal | `removeEventListener` / `{ signal }` / effect cleanup |
| Timers | `setInterval` never cleared | `clearInterval` in cleanup |
| Subscriptions | WebSocket, `EventSource`, store subscriptions, `ResizeObserver` | `close()` / `disconnect()` / unsubscribe |
| Closures | callback capturing a big array or component state | narrow captured variables, null out references |
| Global caches | `const cache = new Map()` growing forever | LRU / TTL / `WeakMap` keyed by object |
| Detached DOM | storing element references in module-level arrays | clear on unmount |
| Third-party widgets | maps/charts not destroyed | call `destroy()`/`dispose()` |
| React state | holding huge responses in state/context needlessly | store IDs, paginate, free on route change |
| Closures in effects | effect re-subscribes each render without cleanup | cleanup + stable deps |
| Promises | pending promises holding data indefinitely | abort/ignore after unmount |

### Example fix

```tsx
useEffect(() => {
  const controller = new AbortController();
  const ws = new WebSocket(url);
  ws.onmessage = (e) => setMessages((m) => [...m.slice(-499), JSON.parse(e.data)]);   // bounded buffer
  window.addEventListener("resize", onResize, { signal: controller.signal });
  return () => {
    ws.close();
    controller.abort();             // removes the listener
  };
}, [url]);
```

### Prevention
- Lint for exhaustive deps and cleanup patterns; code review checklist for subscriptions.
- Automated memory regression tests with Playwright/Puppeteer (`performance.memory` or CDP `HeapProfiler`), repeating flows and asserting bounded growth.
- Monitor in production: `performance.measureUserAgentSpecificMemory()` (cross-origin isolated) or sampled `performance.memory` (Chrome) and long-session RUM.
- Use `WeakRef`/`FinalizationRegistry` sparingly; they aren't deterministic.
- Keep lists virtualised and data bounded.

### Garbage collection basics
JS engines use mark-and-sweep from roots (globals, stack, active timers/listeners); unreachable objects are collected. Circular references aren't leaks. A "leak" means unintended reachability.

## Follow-ups
- **Why can't I just call `gc()` in code?** — It's only exposed in debug flags; DevTools has a manual GC button.
- **Do detached nodes always mean a leak?** — Not if they're intentionally cached (e.g. offscreen reuse); but unexpected growth is.

## Common Mistakes
- Taking one snapshot and guessing.
- Forgetting to force GC before measuring.
- Fixing symptoms (reload prompts) instead of the retaining reference.

## Tips
- Name the 3-snapshot technique and the Retainers panel.
