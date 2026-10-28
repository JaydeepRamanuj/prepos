---
title: "Measure Core Web Vitals in a Next.js app: lab, field and attribution"
level: hard
type: design
tags: [web-vitals, rum, lcp, inp, cls, useReportWebVitals, instrumentation-client]
related: [nextjs/lcp-image-fix, performance/field-vs-lab-data, nextjs/bundle-analysis-optimization]
---

## Question
How would you set up performance monitoring for a Next.js app so that you can tell whether a release improved or regressed LCP, INP and CLS for real users? Cover lab versus field data, how to collect metrics, attribution, and budgets.

## Clues
- Lab tools are reproducible; field data represents real devices and networks.
- Collect metrics from the browser with the web-vitals library or Next.js' hook.
- Attribution tells you which element or interaction caused a bad score.

## Interview Answer
I use both kinds of data. Lab tools such as Lighthouse and DevTools give reproducible diagnosis, and Lighthouse CI enforces budgets in CI on a production build. Field data from real users, via CrUX for a public overview and my own RUM for per-release detail, decides whether users are actually better off, using the 75th percentile and the thresholds LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1. In Next.js I send metrics from the browser with the `useReportWebVitals` hook in a Client Component (or the `web-vitals` library), include the route, device and connection, and the attribution build so I know the LCP element, the slow interaction target or the layout-shift source. I tag metrics with the deployment id to compare releases, aggregate percentiles server-side, and alert on regressions. Vercel Speed Insights or other RUM products can replace the custom pipeline.

## Explanation
### Targets (p75)

| Metric | Good | Measures |
|---|---|---|
| LCP | ≤ 2.5 s | when the main content is painted |
| INP | ≤ 200 ms | responsiveness across all interactions |
| CLS | ≤ 0.1 | visual stability |
| (TTFB, FCP) | supporting metrics | diagnosis |

### Lab vs field

| | Lab (Lighthouse, WebPageTest, DevTools) | Field (CrUX, RUM) |
|---|---|---|
| Environment | controlled, throttled | real devices and networks |
| Reproducible | yes | no, distributions |
| Interactions | scripted, INP not really measured (TBT proxy) | real INP |
| Use | debug, CI budgets | prove impact, alert |

### Collecting in Next.js

```tsx
// app/_components/web-vitals.tsx
"use client";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    const body = JSON.stringify({
      name: metric.name,          // "LCP" | "INP" | "CLS" | "FCP" | "TTFB"
      value: metric.value,
      rating: metric.rating,      // "good" | "needs-improvement" | "poor"
      id: metric.id,
      navigationType: metric.navigationType,
      path: location.pathname,
      deployment: process.env.NEXT_PUBLIC_BUILD_ID,
    });
    navigator.sendBeacon?.("/api/vitals", body) || fetch("/api/vitals", { body, method: "POST", keepalive: true });
  });
  return null;
}
```

Render `<WebVitals />` once in the root layout. `sendBeacon`/`keepalive` ensure the report survives page unload. Next.js also supports `instrumentation-client` for code that runs early on the client, and a `webVitalsAttribution` config to include attribution details for selected metrics.

### Attribution
Enable attribution (via the `web-vitals/attribution` build or Next's `webVitalsAttribution` option) to capture:
- LCP element selector and resource URL, load delay vs duration vs render delay.
- INP: the interaction target, input delay, processing time, presentation delay, and long animation frame (LoAF) scripts.
- CLS: the shifting elements.

Without attribution you see that INP is bad, but not why.

### Pipeline
1. Endpoint stores metrics (warehouse, time-series DB, or a vendor).
2. Aggregate p75 by route, device class, connection type and deployment id.
3. Dashboard: trend lines, release markers, top offenders.
4. Alerts on p75 regressions with minimum sample sizes.
5. Compare against CrUX (28-day rolling) for external validation.

### Budgets and CI
- Lighthouse CI on the production build against key pages with assertions for LCP/TBT/CLS and JS size.
- Bundle size checks per route (from `next build` or the analyzer).
- Performance tests in preview deployments.

### Common causes of regressions
New third-party scripts, large unoptimised images, client-side rendering of above-the-fold content, layout shifts from late-loaded fonts/ads, expensive event handlers (INP), hydration of huge client trees.

### Privacy
Collect only technical metrics, avoid PII in URLs (strip query strings), respect consent requirements where applicable.

## Follow-ups
- **Why p75?** — It balances typical experience with robustness to outliers and is the threshold Google uses.
- **Why can't Lighthouse measure INP?** — INP needs real user interactions; Lighthouse reports TBT as a lab proxy (and has user-flow modes for interaction audits).

## Common Mistakes
- Judging by Lighthouse alone.
- Reporting averages instead of percentiles.
- Collecting without attribution or release tags.

## Tips
- Pair a number with its source (lab or field) and its percentile whenever you quote it.
