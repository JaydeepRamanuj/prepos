---
title: "How do you diagnose and fix a slow LCP?"
level: hard
type: scenario
tags: [lcp, ttfb, preload, fetchpriority, critical-path, images]
related: [performance/core-web-vitals-overview, nextjs/lcp-image-fix, performance/loading-resource-hints, performance/images-and-fonts-loading]
---

## Question
A landing page has an LCP of 4.5 s at the 75th percentile on mobile. Describe how you find the cause and the changes you would make, ordered by likely impact.

## Clues
- Break LCP into four phases and find the biggest.
- The browser can only fetch what it can discover early.
- The LCP element could be text, not only an image.

## Interview Answer
I break LCP into four sub-parts using DevTools or field attribution: time to first byte, resource load delay (time before the LCP resource starts downloading), resource load duration, and element render delay. Ideally TTFB plus load delay is under about 40% of the budget, load duration about 40%, and render delay near zero. If TTFB is high, I fix server/CDN caching, compression, redirects and rendering strategy. If load delay is high, the resource is discovered late: it's lazy-loaded, set via CSS background or JS, or behind a client-rendered shell, so I make it discoverable in the initial HTML, add `fetchpriority="high"` and a preload where appropriate, and never lazy-load it. If load duration is high, I reduce bytes with the right dimensions, AVIF/WebP, compression and a CDN. If render delay is high, render-blocking CSS/JS, web fonts or hydration/JS-driven display are holding the paint. Then I verify with field data.

## Explanation
### The four phases

```txt
|-- TTFB --|-- load delay --|-- load duration --|-- render delay --|
navigation  first byte       LCP resource        resource           LCP painted
start                         request starts      finishes
```

Target split (approx.): TTFB ≈ 40% / load delay < 10% / load duration ≈ 40% / render delay < 10%.

### Identify the LCP element
DevTools Performance panel (LCP marker), Lighthouse "Largest Contentful Paint element", or `web-vitals/attribution` in RUM, which reports the element selector, URL and phase timings.

### Fix by phase

**TTFB**
- Cache HTML at the CDN (static or ISR); avoid per-request server rendering for public pages.
- Compress (Brotli), HTTP/2 or HTTP/3, keep-alive, TLS 1.3, remove redirect chains (http → https → www → locale).
- Speed up backend/data queries; stream HTML so the shell goes early.
- `103 Early Hints` to preload critical resources before the final response.

**Load delay (discovery)**
```html
<img src="hero.avif" width="1200" height="600" alt="…" fetchpriority="high" decoding="async">
<!-- not loading="lazy" -->
```
- Put the hero `<img>` in server-rendered HTML; avoid injecting it with JS or hydrating a carousel first.
- Avoid CSS `background-image` for the LCP image, or add `<link rel="preload" as="image" href="hero.avif" fetchpriority="high">`; for responsive images use `imagesrcset`/`imagesizes` on the preload.
- Don't preload everything; only the LCP resource (and critical fonts).
- Remove chains: HTML → CSS → `@import` → image.

**Load duration (bytes)**
- Serve the right size via `srcset`/`sizes`; AVIF/WebP; quality 60–75; strip metadata.
- Use a CDN with good cache hit ratio and `Cache-Control: immutable` for hashed assets.
- For text LCP: web font loading and CSS size.

**Render delay**
- Eliminate render-blocking CSS/JS in `<head>` (inline critical CSS, defer scripts, `media` attributes on non-critical CSS).
- Fonts: `font-display: swap/optional`, preload the key font, metric-matched fallbacks (`next/font`).
- Avoid client-side redirects, A/B testing flicker scripts that hide the body, and hydration-gated content (`opacity: 0` until mounted).
- Reduce main-thread work before first paint (long tasks).

### Frequent real-world culprits
1. Hero image lazy-loaded or discovered after JS.
2. Image hundreds of KB larger than needed (desktop asset on mobile).
3. Slow server response from uncached SSR.
4. Client-side rendering of above-the-fold content.
5. Third-party tag managers or consent banners delaying paint.
6. Web fonts blocking text LCP.
7. Redirect chain at the start.

### Verifying
- Lab: Lighthouse on mobile profile; WebPageTest filmstrip.
- Field: CrUX/RUM p75 before and after, segmented by route and device; check the LCP element type distribution.
- Guard with a performance budget in CI.

### Example result

| Phase | Before | After | Change |
|---|---|---|---|
| TTFB | 1.4 s | 0.4 s | CDN-cached HTML |
| Load delay | 1.5 s | 0.1 s | `fetchpriority=high`, server-rendered `<img>` |
| Load duration | 1.2 s | 0.6 s | AVIF + `sizes` |
| Render delay | 0.4 s | 0.1 s | removed blocking script |
| **LCP** | **4.5 s** | **1.2 s** | |

## Follow-ups
- **Does lazy-loading hurt LCP?** — Yes if applied to the LCP image; it delays fetching until layout.
- **What if LCP is a video poster?** — Preload the poster image and ensure the `<video poster>` loads with priority.

## Common Mistakes
- Preloading multiple large images.
- Optimising image bytes when TTFB is the bottleneck.
- Measuring only in lab.

## Tips
- Always start with the phase breakdown; it focuses the work.
