---
title: "The app became slow after last week's release. How do you find and fix the cause?"
level: hard
type: scenario
tags: [performance, regression, profiling, web-vitals, bisect, rum, bundle-size]
related: [scenarios/production-errors-cannot-reproduce, performance/core-web-vitals-overview, performance/bundle-analysis]
---

## Question
Users and support report the dashboard "feels slow" since Thursday's release, which contained 14 merged PRs. There is no obvious error. How do you investigate systematically, communicate while you do it, and prevent a repeat?

## Clues
- "Slow" must be turned into a measurable symptom: which metric, which pages, which users?
- Real-user data (RUM) tells you where; lab tools tell you why.
- A regression window narrows the suspects: before/after release.

## Interview Answer
First I define and confirm the problem with data rather than anecdotes: compare RUM metrics (LCP, INP, TTFB, route-level timings) and server metrics before and after the release, segmented by page, device, network and geography, to learn what got slower and for whom. In parallel I reproduce it with a lab profile (Lighthouse and the Chrome Performance panel with CPU/network throttling, React Profiler) on the worst page. Then I narrow the cause by area: TTFB or API latency points to the backend or caching (a missing cache, new N+1 queries, a dynamic render that used to be static); large JS or slow LCP points to bundle growth, a new third-party script, an unoptimised image or a render-blocking resource; poor INP or jank points to expensive renders, effects, large lists or a new heavy component. I diff the release (14 PRs) and bisect with preview deployments or by reverting suspect PRs behind flags, confirm the fix with the same metrics, and communicate status early. Afterwards I add guardrails: performance budgets in CI, bundle-size checks, RUM alerts on regressions, and a post-release checklist.

## Explanation
### Step 1: Turn "slow" into numbers
| Question | Source |
|---|---|
| Which metric regressed? | RUM (web-vitals library, Vercel Speed Insights, Datadog/Sentry), p75/p95 |
| Which pages/routes? | route-level breakdown |
| Which users? | device class, network, region, new vs returning |
| Backend or frontend? | TTFB vs API latency vs client render timing |
| When exactly? | time series aligned to the deploy marker |

Add the release version to every metric and error so regressions map to deploys.

### Step 2: Reproduce
- Chrome DevTools Performance with 4× CPU throttle and "Slow 4G"; look at long tasks, scripting vs rendering time, layout thrash.
- Lighthouse / WebPageTest for before/after comparisons (run against the previous deployment URL).
- React Profiler "why did this render?" for interaction slowness.
- Network tab: bigger bundles, more requests, uncached responses, waterfalls.
- Server: slow query logs, APM traces, cache hit ratio changes.

### Step 3: Triage by symptom

| Symptom | Likely causes | Checks |
|---|---|---|
| High TTFB | page became dynamic (a `cookies()`/`headers()` call), cache miss, slow DB query, cold starts | response headers (`x-vercel-cache`/cache status), server timing, APM |
| Large LCP | bigger hero image, blocking script/CSS, client-side fetch before render | LCP element, request waterfall |
| JS bloat | new library, unsplit route, accidental barrel import, moment/lodash full import | bundle analyzer diff, `next build` output |
| Poor INP | heavy handlers, big re-renders, synchronous work, new analytics | Performance panel interactions, Profiler |
| CLS | new banner/ad/font swap without reserved space | layout shift regions |
| API slowness | N+1, missing index, new join, unbounded payload | traces, `EXPLAIN` |
| Third-party | new tag manager scripts | request blocking test |

### Step 4: Bisect the release
- Compare bundle analyzer reports and dependency changes between the two tags.
- Deploy previews for subsets of PRs, or `git bisect` with an automated performance script (Lighthouse CI or a Playwright timing).
- If flags exist, toggle features off for a cohort.
- Roll back or flag off the culprit first if user impact is severe; fix forward afterwards.

### Step 5: Fix and verify
Examples: restore static rendering/caching, lazy-load the heavy component, replace the library, add the missing index, memoise or virtualise, compress the image, defer the script. Verify with the same RUM metrics and a lab comparison; keep monitoring for a few days.

### Communication
Acknowledge quickly, share what is known and the next update time, assign an incident lead if impact is large, and write a short post-mortem (blameless): timeline, root cause, detection gap, preventive actions.

### Prevention
- Performance budgets (bundle size per route, Lighthouse CI thresholds) failing PRs.
- Automated RUM alerts on p75 regressions per release.
- PR template question: "Does this add dependencies or affect render/caching?"
- Canary or staged rollouts with metric comparison.
- Synthetic monitoring of key flows.

## Follow-ups
- **Why p75 and not the average?** — Averages hide tail pain; Core Web Vitals use the 75th percentile.
- **What if you can't reproduce it locally?** — Look at segments (low-end devices, certain regions) and use field data, session replays and throttled profiling.

## Common Mistakes
- Guessing and optimising before measuring.
- Only testing on a fast developer machine.
- Rolling forward with multiple speculative fixes at once.

## Tips
- Walk through measure → localise → bisect → fix → prevent.
