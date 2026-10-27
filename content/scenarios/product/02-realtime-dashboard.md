---
title: "Build a live operations dashboard with thousands of updates per minute"
level: hard
type: scenario
tags: [realtime, dashboard, websockets, sse, batching, rendering-performance, charts]
related: [browser-security/websockets-sse-polling, react/react-profiler, state/why-tanstack-query]
---

## Question
Operations wants a dashboard showing live order counts, error rates and a table of the latest 500 events. Updates arrive at several hundred per second. The prototype freezes the browser after a few minutes. How do you design it so it stays smooth and correct?

## Clues
- Receiving data and rendering data should be decoupled.
- Humans cannot perceive more than a few updates per second per widget.
- Unbounded arrays and per-message state updates are the usual culprits.

## Interview Answer
I decouple ingestion from rendering. Messages arrive over a single SSE or WebSocket connection into a plain in-memory buffer (not React state); a scheduler flushes batches to state at a fixed cadence (for example every 250–500 ms or per animation frame) so React renders a few times per second regardless of message rate. Data is aggregated before it reaches the UI (the server should send pre-computed metrics or deltas, not raw events), the event table keeps a bounded ring buffer (last 500) and is virtualised, charts use a fixed-size window with a canvas-based library or downsampling, and components subscribe to narrow slices (selectors in a Zustand store or `useSyncExternalStore`) so only the affected widget re-renders. I handle reconnects with backoff and a resume or snapshot-refetch so counts stay correct, pause updates when the tab is hidden, and show connection state and "last updated" so users trust the numbers. Finally I profile with the React DevTools profiler and the Performance panel, and set budgets (render under X ms, memory stable over an hour).

## Explanation
### Why the prototype freezes
```ts
ws.onmessage = (e) => setEvents((prev) => [...prev, JSON.parse(e.data)]);   // ❌
```
- A state update and re-render per message (hundreds per second).
- An array that grows forever: memory grows, copying becomes O(n) each time.
- Rendering a table of thousands of rows and re-rendering every chart each time.

### Pattern: buffer, batch, bound

```ts
const MAX = 500;
const buffer: DashboardEvent[] = [];

ws.onmessage = (e) => buffer.push(JSON.parse(e.data));              // cheap, no render

setInterval(() => {
  if (!buffer.length || document.hidden) return;
  const batch = buffer.splice(0, buffer.length);
  store.getState().applyBatch(batch);                               // one state update per tick
}, 300);

// store
applyBatch: (batch) => set((s) => ({
  events: [...batch.reverse(), ...s.events].slice(0, MAX),          // bounded
  counts: reduceCounts(s.counts, batch),                            // aggregate incrementally
}))
```
Use `requestAnimationFrame` for smooth chart animation, `setInterval` or `scheduler`/`startTransition` for lower-priority table updates.

### Rendering performance
- **Selectors / narrow subscriptions**: the "orders per minute" tile subscribes only to its number.
- **Virtualise the event table** (TanStack Virtual) and give rows stable keys; memoise row components.
- **Charts**: prefer canvas/WebGL (uPlot, ECharts canvas renderer) over thousands of SVG nodes; keep a fixed time window and downsample older points.
- **Avoid animation on every tick**; animate only meaningful changes.
- **Web Worker** for heavy parsing/aggregation if the main thread is still busy; send compact binary or batched JSON.
- **Server-side aggregation**: send `{ ordersPerMin: 1432, errorRate: 0.7 }` per second instead of every event; stream raw events only to the table that needs them, sampled if necessary.

### Correctness and resilience
- **Sequence numbers** or timestamps to drop duplicates and detect gaps; on a gap or reconnect, fetch a fresh snapshot, then continue the stream.
- **Backoff with jitter** on reconnect; heartbeat to detect dead connections.
- **Clock**: display server timestamps in a consistent time zone; don't trust the client clock for ordering.
- **Visibility**: pause rendering when hidden; on return, apply a snapshot rather than replaying minutes of events.
- **Status UI**: connected/reconnecting, last update time, stale indicators when data is older than a threshold.
- **Accessibility**: don't spam screen readers; use `aria-live="off"` for rapidly changing numbers and offer a "pause updates" button (also helps users who want to read a row).

### Testing and monitoring
Soak test with a mock stream at 2–5× expected rate; watch heap size, long tasks and dropped frames; add budgets in CI where possible; log client-side performance metrics (INP, long tasks) to catch regressions.

### Options at a glance
| Concern | Naive | Better |
|---|---|---|
| State updates | per message | batched on a timer |
| Data growth | unbounded array | ring buffer / window |
| Table | render all rows | virtualised |
| Charts | SVG with thousands of nodes | canvas, windowed |
| Data volume | raw events | server aggregates |
| Reconnect | none | backoff + resync |

## Follow-ups
- **SSE or WebSocket?** — SSE is enough for one-way streams and gets auto-reconnect; choose WebSockets for bidirectional needs.
- **How do you keep multiple tabs from multiplying load?** — Share one connection through a `SharedWorker` or `BroadcastChannel` leader election.

## Common Mistakes
- Putting the stream directly into `useState`.
- Never trimming collections.
- Assuming the server can't help by aggregating.

## Tips
- Use the three verbs: buffer, batch, bound.
