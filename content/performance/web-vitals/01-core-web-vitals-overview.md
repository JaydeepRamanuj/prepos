---
title: "What are the Core Web Vitals (LCP, INP, CLS) and how are they scored?"
level: easy
type: concept
tags: [core-web-vitals, lcp, inp, cls, thresholds, ranking]
related: [performance/lcp-fixes, performance/inp-fixes, performance/cls-fixes, performance/field-vs-lab-data]
---

## Question
Name the three Core Web Vitals, say what each measures, give the "good" thresholds and the percentile used, and explain why INP replaced FID.

## Interview Answer
Core Web Vitals are Google's user-centred metrics for loading, interactivity and visual stability. Largest Contentful Paint (LCP) measures when the largest visible content element, usually a hero image or heading block, finishes rendering, and is good at 2.5 seconds or less. Interaction to Next Paint (INP) measures responsiveness across all clicks, taps and key presses during a visit, reporting roughly the slowest interaction's latency from input to the next frame, and is good at 200 ms or less. Cumulative Layout Shift (CLS) sums unexpected layout shifts and is good at 0.1 or less. Each is judged at the 75th percentile of real-user page loads, segmented by mobile and desktop. INP replaced First Input Delay in March 2024 because FID measured only the delay before the first interaction's handler started; INP covers every interaction and the full path through processing and rendering.

## Explanation
### Thresholds (p75 of field data)

| Metric | Measures | Good | Needs improvement | Poor |
|---|---|---|---|---|
| LCP | loading: render time of the largest image/text block in the viewport | ≤ 2.5 s | 2.5–4 s | > 4 s |
| INP | responsiveness: latency of interactions across the page life | ≤ 200 ms | 200–500 ms | > 500 ms |
| CLS | visual stability: sum of the largest burst of layout-shift scores | ≤ 0.1 | 0.1–0.25 | > 0.25 |

A page "passes" Core Web Vitals when all three are good at the 75th percentile for the page or origin over a 28-day window (CrUX).

### What each includes

**LCP** candidates: `<img>`, `<image>` in SVG, `<video>` poster, elements with CSS background images (loaded via `url()`), and block-level text nodes. Sub-parts: TTFB, resource load delay, resource load duration, element render delay.

**INP** components for one interaction: input delay (main thread busy) + processing time (event handlers) + presentation delay (rendering until the next frame). The reported value is the worst (or near-worst for many interactions) interaction in the visit. Scrolling and hovering are not interactions; clicks, taps and key presses are.

**CLS**: each shift has `impact fraction × distance fraction`; shifts within 1 s of each other and within a 5 s window form a session window; the largest window counts. Shifts within 500 ms of a user input don't count.

### Why INP replaced FID
- FID measured only the first interaction and only the input delay (not handler time or rendering), so most sites passed trivially.
- INP observes all interactions and includes processing and presentation, matching what users feel as "snappy".
- Most sites had poor INP even with good FID because of heavy JavaScript during later interactions.

### Other metrics you should know
- **TTFB**: time to first byte (server and network); a diagnosis metric for LCP.
- **FCP**: first contentful paint.
- **TBT**: total blocking time (lab proxy for INP).
- **Speed Index**, **Long tasks**, **Long Animation Frames (LoAF)**.
- **Soft navigations** in SPAs are being incorporated into field measurement.

### Why they matter
- User experience and conversion (faster, more stable pages convert and retain better).
- Google Search uses page experience signals; CWV is a tie-breaker, not a substitute for relevant content.
- Competitive and regulatory (accessibility overlaps with stability).

### Typical fixes by metric
- LCP: prioritise the hero resource, optimise image size/format, reduce TTFB, avoid client-only rendering of above-the-fold content.
- INP: shorten tasks, yield to the main thread, reduce work in handlers, avoid heavy re-renders, defer third-party scripts.
- CLS: reserve space for images/embeds/ads, avoid inserting content above existing content, use font fallbacks with matching metrics, animate with transforms.

### How to read your data
Use CrUX (PageSpeed Insights, Search Console) for field data, Lighthouse for lab diagnostics, and RUM for your own segmentation by route and release.

## Follow-ups
- **Which is hardest to fix?** — Commonly INP, since it depends on the whole app's JavaScript behaviour.
- **Does a page need a good score on every metric?** — To pass the assessment, yes; each should be tracked per route.

## Common Mistakes
- Quoting lab scores as Core Web Vitals.
- Forgetting INP replaced FID.
- Optimising averages instead of p75.

## Tips
- Memorise 2.5 s / 200 ms / 0.1 and "p75, field data".
