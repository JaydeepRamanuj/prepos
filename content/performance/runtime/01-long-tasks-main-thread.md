---
title: "Long tasks and the main thread: chunk work, yield and schedule it"
level: hard
type: implement
tags: [long-tasks, main-thread, scheduler-yield, requestIdleCallback, chunking, responsiveness]
related: [performance/inp-fixes, javascript/microtask-starvation, performance/web-workers]
---

## Question
Processing 50,000 rows on the main thread freezes the UI for 800 ms. Implement a helper that processes the array in chunks while yielding to the browser between chunks, supports cancellation and progress reporting, and explain the available scheduling APIs and their trade-offs.

```js
await processInChunks(rows, (row) => transform(row), { chunkMs: 8, signal, onProgress });
```

## Clues
- A task longer than 50 ms is a "long task" that blocks input and rendering.
- You can measure elapsed time inside the loop and yield when a time budget is exhausted.
- Yielding via a macrotask (not a promise microtask) lets the browser paint and handle input.

## Interview Answer
The main thread runs JavaScript, style, layout, paint and input handling in one stream, so a long synchronous task delays everything and hurts INP. The remedy is to split work into small chunks and yield between them, so the browser can process queued input and render. My helper loops over items for a time budget (about 8–10 ms), then yields using `scheduler.yield()` when available (it continues with high priority after the yield), falling back to `setTimeout(0)` or a `MessageChannel`; microtask-based yielding (`await Promise.resolve()`) doesn't help because rendering waits for the microtask queue to drain. It checks an `AbortSignal` between chunks for cancellation and reports progress. For work that is CPU-heavy overall, I'd move it to a Web Worker instead. `requestIdleCallback` suits low-priority background work but offers no timing guarantees, and `isInputPending()` can let chunks run longer when no input is waiting.

## Explanation
### Implementation

```js
const yieldToMain = () =>
  globalThis.scheduler?.yield
    ? scheduler.yield()
    : new Promise((resolve) => setTimeout(resolve, 0));

export async function processInChunks(items, fn, { chunkMs = 8, signal, onProgress } = {}) {
  const results = new Array(items.length);
  let i = 0;

  while (i < items.length) {
    signal?.throwIfAborted();
    const deadline = performance.now() + chunkMs;

    // Run until the time budget for this chunk is spent
    while (i < items.length && performance.now() < deadline) {
      results[i] = fn(items[i], i);
      i++;
    }

    onProgress?.(i / items.length);
    if (i < items.length) await yieldToMain();      // let the browser handle input and paint
  }
  return results;
}
```

Usage:

```js
const controller = new AbortController();
cancelButton.onclick = () => controller.abort();

try {
  const out = await processInChunks(rows, transform, {
    signal: controller.signal,
    onProgress: (p) => (progress.value = p),
  });
  render(out);
} catch (e) {
  if (e.name !== "AbortError") throw e;
}
```

### Why yielding via promises doesn't work

```js
await Promise.resolve();      // microtask: runs before the browser can paint or process input
await new Promise((r) => setTimeout(r));   // macrotask: gives the browser a chance
```

Rendering opportunities occur between tasks, after the microtask queue is drained. Chaining microtasks starves rendering.

### Scheduling APIs

| API | Use | Notes |
|---|---|---|
| `scheduler.yield()` | yield and resume with priority after the browser handles pending work | Chromium; feature-detect with a `setTimeout` fallback |
| `scheduler.postTask(fn, { priority, signal })` | prioritised tasks (`user-blocking`, `user-visible`, `background`) | Chromium; polyfills exist |
| `setTimeout(0)` | universally available yield | clamped to ≥4 ms after nesting; resumes at the back of the queue |
| `MessageChannel` | faster yield than `setTimeout` | used by React's scheduler |
| `requestAnimationFrame` | work tied to rendering (visual updates) | runs before the next paint; don't do heavy work |
| `requestIdleCallback(cb, { timeout })` | background work when idle | may never run on busy pages; add a timeout |
| `navigator.scheduling.isInputPending()` | check for waiting input (Chromium) | lets you extend a chunk when there's none |
| Web Workers | true parallelism | needs data transfer; best for heavy CPU |

### Other techniques
- **Break up by priority**: do user-visible updates first, defer analytics/logging.
- **Avoid forced synchronous layout** inside chunks (see the layout thrashing question).
- **Batch DOM writes** with `DocumentFragment` or virtualisation to avoid rendering 50k nodes.
- **React**: `startTransition`, `useDeferredValue`, and moving state down; React's own scheduler already time-slices rendering.
- **Debounce/throttle** frequent events to reduce task counts.
- **Detect long tasks**: `PerformanceObserver({ type: "longtask" })` and Long Animation Frames for attribution.

### Trade-offs
- Chunking increases total time slightly (scheduling overhead, 4 ms clamp) but keeps the page responsive.
- Intermediate state: UI may show partial results; design for it (progress indicators).
- Order and cancellation: ensure only the latest job runs when input changes.
- Memory: avoid holding giant intermediate arrays; stream results.

### Measuring
DevTools Performance with CPU throttling: long tasks are flagged with red corners; compare "Total Blocking Time" and INP before and after; test on mid-range Android.

## Follow-ups
- **Why 50 ms?** — The RAIL model: a response within 100 ms feels instant; leaving ≥50 ms for the browser to handle input means tasks should be ≤ 50 ms.
- **Is `requestIdleCallback` reliable in Safari?** — It isn't supported in Safari, so provide a fallback.

## Common Mistakes
- Using `await Promise.resolve()` to "yield".
- Not accounting for cancellation.
- Chunking tiny pieces so overhead dominates.

## Tips
- Explain microtask vs macrotask yielding explicitly.
