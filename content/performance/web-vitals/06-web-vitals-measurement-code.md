---
title: "Measure LCP, CLS and INP in the browser with PerformanceObserver (and the web-vitals library)"
level: hard
type: implement
tags: [performance-observer, web-vitals, lcp, cls, inp, beacon, rum]
related: [performance/field-vs-lab-data, nextjs/web-vitals-measurement, performance/inp-fixes]
---

## Question
Write code that collects LCP and CLS using `PerformanceObserver`, explains why INP is harder, and reports metrics reliably when the page is hidden or unloaded. Then show the equivalent with the `web-vitals` library including attribution.

## Clues
- Observer entry types: `largest-contentful-paint`, `layout-shift`, `event`.
- Use `buffered: true` to see entries from before the observer was created.
- Finalise and send metrics on `visibilitychange` (hidden), not `unload`.

## Interview Answer
I create `PerformanceObserver`s with `buffered: true` for `largest-contentful-paint` (keep the last entry's `startTime`) and `layout-shift` (sum `value` for entries without `hadRecentInput`, grouped into session windows to match the official CLS definition). Both are only final when the page is hidden or the user interacts, so I send them on `visibilitychange` to `hidden` with `navigator.sendBeacon`, which survives navigation; `unload` is unreliable and blocks the bfcache. INP is harder: it needs `event` timing entries with `durationThreshold`, grouping by `interactionId`, picking the worst (or 98th percentile for busy pages) per page view, which is why I normally use the `web-vitals` library, whose `onINP` handles these details, and import the attribution build to get the target element, phases and long animation frame scripts. I include route, device, connection and release in the payload.

## Explanation
### LCP and CLS by hand

```js
const metrics = {};

// LCP: the last candidate before user input or hidden
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const last = entries[entries.length - 1];
  metrics.lcp = last.startTime;
  metrics.lcpEl = last.element?.tagName;
}).observe({ type: "largest-contentful-paint", buffered: true });

// CLS: session windows (gap < 1s, window < 5s), take the max window
let windowValue = 0, windowEntries = [], maxWindow = 0;
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    if (e.hadRecentInput) continue;                   // ignore user-initiated shifts
    const first = windowEntries[0];
    const last = windowEntries[windowEntries.length - 1];
    if (windowEntries.length && (e.startTime - last.startTime > 1000 || e.startTime - first.startTime > 5000)) {
      windowValue = 0; windowEntries = [];
    }
    windowEntries.push(e);
    windowValue += e.value;
    maxWindow = Math.max(maxWindow, windowValue);
    metrics.cls = maxWindow;
  }
}).observe({ type: "layout-shift", buffered: true });
```

### Reporting reliably

```js
function report() {
  const body = JSON.stringify({
    ...metrics,
    path: location.pathname,
    ua: navigator.userAgent,
    conn: navigator.connection?.effectiveType,
    release: window.__RELEASE__,
  });
  // sendBeacon queues the request even while the page is being torn down
  if (!navigator.sendBeacon?.("/api/vitals", body)) {
    fetch("/api/vitals", { method: "POST", body, keepalive: true });
  }
}

let sent = false;
addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && !sent) { sent = true; report(); }
});
addEventListener("pagehide", () => { if (!sent) { sent = true; report(); } });   // Safari/bfcache fallback
```

Avoid `unload`/`beforeunload` handlers: they're unreliable on mobile and disable the back/forward cache.

### INP is the hard one
Interactions comprise several events (`pointerdown`, `pointerup`, `click`) sharing an `interactionId`. You observe `event` entries with `durationThreshold` (e.g. 40 ms), group them by `interactionId`, take the longest duration per interaction, and report the worst interaction (or the 98th percentile of interactions for long sessions). Detail matters (first-input, `processingStart/End`, presentation timing), so use the library.

### With `web-vitals`

```js
import { onLCP, onINP, onCLS } from "web-vitals/attribution";

function send({ name, value, rating, delta, id, attribution }) {
  navigator.sendBeacon("/api/vitals", JSON.stringify({
    name, value, rating, delta, id, path: location.pathname,
    // attribution highlights the cause:
    target: attribution.interactionTarget ?? attribution.element ?? attribution.largestShiftTarget,
    detail: attribution,                          // phases for LCP/INP, shift sources for CLS
  }));
}

onLCP(send);
onINP(send);
onCLS(send);
```

- Callbacks may fire multiple times as values change (`delta` is the change since the last report); by default `web-vitals` reports when the metric is final (page hidden); pass `{ reportAllChanges: true }` for debugging.
- The `id` identifies the page view's metric instance, so the backend can dedupe or update.

### In Next.js
`useReportWebVitals` from `next/web-vitals` wraps the same data; `instrumentation-client` can register the library early.

### Backend aggregation
Store raw samples with dimensions (route, device class, release). Compute p75 per dimension (e.g. via `percentile_cont(0.75)`) and chart over time; alert when p75 passes thresholds with a minimum sample size.

### Gotchas
- Browser support: Safari lacks LCP/INP/layout-shift APIs in some versions; the library handles feature detection and reports only supported metrics.
- Prerendered and bfcache-restored pages need handling (`navigationType`).
- Respect consent/privacy; strip query strings and IDs from paths.
- Sample if traffic is large; keep payloads small.

## Follow-ups
- **Why `buffered: true`?** — Entries emitted before your observer starts (e.g. early LCP candidates) are delivered retroactively.
- **Why not `unload`?** — Unreliable, blocks bfcache; `visibilitychange` + beacon is the recommended pattern.

## Common Mistakes
- Summing all layout shifts instead of the worst session window.
- Sending on `load` (LCP/CLS not final).
- Forgetting `hadRecentInput`.

## Tips
- Explain finalisation (hidden page) and prefer the library for INP.
