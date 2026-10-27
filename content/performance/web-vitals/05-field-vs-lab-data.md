---
title: "Field data vs lab data: why Lighthouse and CrUX disagree"
level: medium
type: concept
tags: [field-data, lab-data, crux, lighthouse, rum, percentiles]
related: [performance/core-web-vitals-overview, nextjs/web-vitals-measurement, performance/web-vitals-measurement-code]
---

## Question
What is the difference between lab and field performance data? Why can Lighthouse show a score of 95 while CrUX reports poor LCP, and how should each be used in a performance workflow?

## Interview Answer
Lab data is collected in a controlled environment with fixed hardware, network throttling and a scripted load (Lighthouse, WebPageTest), so it's reproducible and good for debugging and CI regression checks. Field data is collected from real users via the Chrome User Experience Report (CrUX) or your own Real User Monitoring (RUM), so it reflects the real mix of devices, networks, geographies, caches, logged-in states and interactions, and it is what Core Web Vitals assessments use (p75 over 28 days). They disagree because lab runs test one page load on a simulated device, ignore interactions (INP needs real input; lab uses Total Blocking Time as a proxy), don't include personalised or logged-in content, and can't see variability. I use lab data to diagnose and prevent regressions and field data to decide what to fix and to prove the impact, segmenting by route, device and connection.

## Explanation
### Comparison

| | Lab | Field |
|---|---|---|
| Source | Lighthouse, WebPageTest, DevTools | CrUX, RUM (web-vitals, Vercel/Datadog/SpeedCurve) |
| Environment | controlled device + network | real users |
| Repeatable | yes | no (distributions) |
| Metrics | LCP, CLS, TBT (INP proxy), FCP | LCP, INP, CLS, TTFB, FCP |
| Interactions | scripted only | real |
| Granularity | one run | percentiles over many sessions |
| Useful for | debugging, CI gates, before-ship checks | prioritising, validation, SLOs |
| Blind spots | personalisation, device variety, long sessions | needs traffic; harder to debug without attribution |

### Why numbers differ
1. **Different populations**: your own users on mid-range Android over 4G vs a simulated Moto G on throttled "Slow 4G".
2. **Cache state**: lab uses cold cache; real users often have warm caches or service workers.
3. **Single load vs whole session**: CLS and INP in the field accumulate across a visit; lab covers one load.
4. **Navigation types**: back/forward cache restores, prerender, soft navigations.
5. **Geography and CDN**: TTFB depends on user location.
6. **Logged-in/personalised pages** aren't reachable by lab tools.
7. **Percentiles**: field p75 includes the slow tail; a lab run is a single sample (which may be near the median).
8. **Browser and extension variance**.

### CrUX vs your RUM
- CrUX: free, only Chrome users who opted in, only for URLs/origins with enough traffic, 28-day rolling window, limited dimensions, no attribution.
- RUM: any browser (where APIs exist), your own dimensions (route, release, A/B variant), attribution data (LCP element, slow interaction), near-real-time.
- Use both: CrUX as the external "scoreboard" Google sees; RUM for engineering feedback loops.

### Workflow

1. Check field data (CrUX, RUM) to find failing metrics, URLs and segments.
2. Reproduce in lab with matching device/network (throttling profile, location).
3. Diagnose with traces; fix.
4. Add lab tests (Lighthouse CI budgets) to prevent regressions.
5. Deploy; watch field metrics by release for 1–4 weeks; the 28-day window lags, RUM shows changes sooner.

### Tools
- **PageSpeed Insights**: shows CrUX field data (top) and a Lighthouse lab run (bottom) for the same URL.
- **Search Console CWV report** grouping URLs.
- **web-vitals library** for RUM; `PerformanceObserver` entries.
- **WebPageTest** for filmstrips, connection profiles, multi-step flows.
- **Chrome DevTools** with CPU/network throttling and "Real-world metrics" from CrUX in the Performance panel.

### Caveats
- Don't compare p50 to p75 numbers.
- Sample size matters; avoid acting on low-traffic routes.
- Synthetic monitoring (scheduled lab runs) complements RUM for uptime-style alerts.

## Follow-ups
- **Why is TBT not equal to INP?** — TBT sums blocking time during load; INP is about the slowest interaction during the visit.
- **Is Lighthouse score a Core Web Vital?** — No; it's a weighted lab score.

## Common Mistakes
- Treating Lighthouse scores as the goal.
- Ignoring field segments (mobile vs desktop).
- Evaluating changes using the 28-day CrUX window too early.

## Tips
- Use the phrase "lab to diagnose, field to decide".
