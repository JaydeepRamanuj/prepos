---
title: "Your hero image makes LCP 4.2 s on mobile: diagnose and fix it in Next.js"
level: hard
type: scenario
tags: [lcp, core-web-vitals, next-image, preload, fetchpriority, ttfb]
related: [nextjs/next-image-basics, nextjs/next-font-optimization, performance/lcp-fixes, nextjs/slow-ttfb-dynamic-page]
---

## Question
Lighthouse shows LCP of 4.2 s on a throttled mobile profile for a marketing page. The LCP element is a hero image rendered with `next/image`. How do you find where the time goes and what do you change?

## Clues
- Split LCP into four parts: TTFB, resource load delay, resource load duration, element render delay.
- The browser should discover the LCP image from the initial HTML, not after JavaScript runs.
- Lazy-loading the LCP image is a classic mistake.

## Interview Answer
I start with the LCP breakdown in DevTools (Performance panel or PageSpeed Insights) to see which sub-part is large. If the resource load delay is big, the image is discovered late: it's lazy-loaded, rendered client-side, or inserted by JavaScript; I fix that by making the hero image load eagerly with `preload` (formerly `priority`) or `fetchPriority="high"` and `loading="eager"`, ensuring it's in the server-rendered HTML. If load duration is large, I check the actual bytes: correct `sizes` so mobile doesn't download a desktop-width image, a modern format, a sensible quality, and that the CDN/cache serves it. If TTFB is high, the page is dynamic or the server is slow, so I look at caching, static shell and streaming. If render delay is high, blocking CSS/fonts or a client-side loading state hides the image. I verify with field data (CrUX / RUM), since lab numbers are only a proxy.

## Explanation
### 1. Measure first

```txt
LCP 4.2 s =  TTFB 0.8  +  load delay 1.6  +  load duration 1.2  +  render delay 0.6
```

The largest segment is the target. Test on production-like builds (`next build && next start`) with throttling; dev mode is not representative.

### 2. Fix discovery (load delay)

```tsx
<Image
  src={hero}
  alt="Spring collection"
  preload               // Next 16: replaces `priority`; adds <link rel="preload"> in the head
  fetchPriority="high"  // optional hint; the docs suggest preferring eager/fetchPriority in most cases
  sizes="100vw"
/>
```

- Never lazy-load the LCP image (`loading="lazy"` is the default for non-eager images, so mark the hero eager).
- Don't render the hero in a Client Component that waits for hydration or a `useEffect` fetch; render it in the server HTML.
- Avoid CSS `background-image` for the hero (not discoverable by the preload scanner, and not optimised); use an `<Image fill>`.
- Only one or two images should be eager; preloading many dilutes priority.

### 3. Fix size (load duration)
- Provide accurate `sizes` (for a full-width hero `100vw`, for a half-width `50vw`) so mobile gets ~640–828 px candidates.
- Use AVIF/WebP via `images.formats`; tune `quality` (65–75 is typically fine; allow-list it in `qualities`).
- Crop at source; don't ship a 4000 px original.
- Ensure caching: `minimumCacheTTL`, immutable headers on static assets, CDN hit ratio.

### 4. Fix TTFB
- Dynamic page waiting on data above the first Suspense boundary? Move fetches down, cache with `use cache`, and serve a static shell (PPR).
- Region mismatch between server and data source.
- Redirect chains and slow proxy logic.

### 5. Fix render delay
- Blocking resources: large CSS, `@import`, render-blocking scripts. Use `next/font` to avoid font blocking and FOIT; defer third-party scripts with `next/script`.
- Client-only wrappers that render nothing until mount.
- Layout work: avoid huge DOM before the image paints.

### 6. Prove it
- Re-run the breakdown; confirm the request starts near the top of the waterfall, with high priority.
- Compare field data (CrUX, RUM via `useReportWebVitals`) after rollout; LCP's good threshold is ≤ 2.5 s at the 75th percentile.
- Add a CI budget (Lighthouse CI) to catch regressions.

### Typical before/after

| Change | Effect on LCP |
|---|---|
| Hero eager + preload | −1.2 s load delay |
| `sizes` + AVIF | −0.7 s duration |
| Cache the shell, stream personalised bits | −0.5 s TTFB |
| Font `display: swap` via `next/font` | −0.2 s render delay |

## Follow-ups
- **Is `preload` always better?** — No; use it for the actual LCP image only. The docs say `loading="eager"` or `fetchPriority="high"` are usually enough.
- **What if the LCP is text?** — Fonts and CSS blocking matter more; use `next/font`, avoid font-display block, inline critical CSS where applicable.

## Common Mistakes
- Preloading five images.
- Optimising images but ignoring TTFB.
- Trusting dev-mode Lighthouse.

## Tips
- Name the four LCP sub-parts and pick the dominant one before touching code.
