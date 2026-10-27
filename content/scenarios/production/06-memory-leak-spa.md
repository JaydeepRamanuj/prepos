---
title: "The single-page app gets slower and crashes after hours of use: hunt the memory leak"
level: advanced
type: scenario
tags: [memory-leak, heap-snapshot, devtools, event-listeners, timers, closures, detached-dom]
related: [react/use-effect-cleanup, javascript/closure-memory-leaks, scenarios/app-slow-after-release]
---

## Question
Support reports that the trading-style dashboard, which stays open all day, becomes sluggish and eventually the tab crashes ("Aw, Snap" / out of memory). It's fine after a refresh. How do you confirm a memory leak, locate it, and fix it?

## Clues
- A leak means memory is retained after it should have been released: growth that isn't reclaimed by garbage collection.
- The usual suspects are things that hold references: listeners, timers, subscriptions, caches, closures, detached DOM.
- Heap snapshots compared over time show what accumulates.

## Interview Answer
I'd first confirm a real leak: use the DevTools Memory panel or Performance monitor and watch JS heap size while repeating a workflow (navigate between views, open and close modals); force garbage collection, and if the post-GC baseline climbs steadily, it's a leak. Then I take heap snapshots before and after repeating the action several times and use the comparison view to see which object types and counts grew (for example `Detached HTMLDivElement`, closures, arrays, `Listener`s) and follow the **retainers** path to find what holds them. In SPAs the common causes are event listeners or subscriptions added on mount but never removed (`window.addEventListener`, WebSocket handlers, observers, `setInterval`), React effects missing cleanup, global stores or caches that grow without bounds (a messages array that never trims, TanStack Query cache set to infinite `gcTime`), closures capturing large objects, detached DOM nodes referenced from JavaScript, and third-party widgets not destroyed on unmount. Once I find the retainer I fix it with proper cleanup (return a cleanup function from effects, `AbortController` for listeners and fetches, `observer.disconnect()`), bound collections, and verify the baseline is flat. I'd add a soak test and heap monitoring to prevent regression.

## Explanation
### Confirm
1. Open DevTools → Performance monitor: watch "JS heap size" and "DOM nodes", "JS event listeners".
2. Run a repeating scenario (open view A → view B → back) 10–20 times; click the trash icon to force GC.
3. If the post-GC heap and counts keep climbing, you have a leak. A sawtooth that returns to the same baseline is healthy.

### Locate with heap snapshots
- Take Snapshot 1 (after warm-up), perform the action N times, take Snapshot 2, use "Comparison" or the "Objects allocated between Snapshot 1 and 2" view.
- Sort by **# Delta** and **Size Delta**; look for your own classes, arrays, closures, `Detached` DOM nodes.
- Select an object and inspect **Retainers**: the chain from GC roots (window, listeners, timers) that keeps it alive.
- The **Allocation instrumentation on timeline** shows where allocations occur over time with stacks.
- Filter "Detached" in the snapshot to find DOM nodes removed from the page but still referenced.

### Typical leaks and fixes

| Cause | Example | Fix |
|---|---|---|
| Missing effect cleanup | `useEffect(() => { window.addEventListener("resize", onResize) }, [])` | return `() => window.removeEventListener("resize", onResize)` |
| Timers | `setInterval(poll, 1000)` never cleared | clear on unmount; avoid duplicates on re-render |
| Subscriptions | WebSocket/EventSource/store subscription not closed | `socket.close()`, `unsubscribe()` in cleanup |
| Observers | `IntersectionObserver`, `ResizeObserver`, `MutationObserver` left connected | `observer.disconnect()` |
| Unbounded caches/arrays | append every tick to `events` | ring buffer, cap size, `gcTime`, LRU |
| Closures retaining big data | handler closes over a huge response | narrow the closure, null references, pass ids |
| Detached DOM | stored node refs in module scope/maps | clear refs on unmount; use `WeakMap`/`WeakRef` where appropriate |
| Third-party widgets | charts/maps not destroyed | call `chart.dispose()`/`map.remove()` in cleanup |
| Fetches after unmount | promise callbacks holding component state | `AbortController`, ignore results after cleanup |
| Global event bus | listeners accumulating across views | unsubscribe symmetrically |
| Console/log retention | logging huge objects (DevTools retains them while open) | not a production leak; test with DevTools closed |

### React example
```tsx
function PriceTicker({ symbol }: { symbol: string }) {
  const [price, setPrice] = useState<number>();

  useEffect(() => {
    const ws = new WebSocket(`wss://feed.example.com/${symbol}`);
    ws.onmessage = (e) => setPrice(JSON.parse(e.data).price);
    return () => ws.close();                           // ✅ without this, every symbol change leaks a socket + closure
  }, [symbol]);

  return <span>{price}</span>;
}
```
In Strict Mode development, effects run twice (setup → cleanup → setup); missing cleanup shows up as duplicate listeners or connections, which is a helpful early warning.

### Prevent regressions
- Lint rules for hooks (`exhaustive-deps`) and code review for cleanup.
- Playwright soak test that cycles through views and asserts heap/DOM node counts via CDP (`Performance.getMetrics`, `HeapProfiler`) stay within bounds.
- Production monitoring: report `performance.memory` (Chrome only) or the newer `measureUserAgentSpecificMemory()` where available (requires cross-origin isolation), plus crash rates and tab reload frequency.
- Memory budgets for long-lived pages; periodically reset heavy state (e.g. trim histories).
- Automatic refresh strategy as a last resort mitigation for kiosk-like dashboards (not a fix).

### Not every growth is a leak
Caches that are intentionally large, lazy-loaded bundles, images, and GC timing can all look like growth. Always compare after forced GC and with consistent steps.

## Follow-ups
- **`WeakMap`/`WeakRef` use?** — They allow associating data with objects without preventing their collection; useful for caches keyed by DOM nodes or objects, but not a substitute for cleanup.
- **Can React itself leak?** — Rarely; leaks usually come from app code retaining references (listeners, caches, closures) beyond component lifetime.

## Common Mistakes
- Judging by Task Manager without forcing GC.
- Fixing symptoms by increasing memory limits.
- Cleaning up in the wrong place (cleanup captured with stale references).

## Tips
- Describe the loop: confirm → repeat action → compare snapshots → follow retainers → fix → verify flat baseline.
