---
title: "What causes layout shift and how do you fix CLS?"
level: medium
type: concept
tags: [cls, layout-shift, aspect-ratio, fonts, ads, skeleton]
related: [performance/core-web-vitals-overview, nextjs/next-font-optimization, performance/images-and-fonts-loading]
---

## Question
List the most common causes of cumulative layout shift and how to prevent each. How is CLS calculated and which shifts are excluded?

## Interview Answer
A layout shift happens when a visible element changes its position between frames without user input. Typical causes are images, iframes and videos without reserved dimensions, late-loading ads and embeds, content injected above existing content (banners, cookie bars, "related" widgets), web fonts swapping with different metrics (FOUT), and animations that change layout properties. The fix is to reserve space ahead of time: set `width` and `height` (or `aspect-ratio`) on media, give slots for ads and embeds a `min-height`, insert dynamic content below the fold or in reserved space, use skeletons that match the final size, use `font-display` with metric-adjusted fallback fonts, and animate with `transform` instead of `top/height`. CLS sums the largest burst ("session window") of shift scores, each calculated as impact fraction times distance fraction; shifts within 500 ms after a user interaction are excluded, and a good score is 0.1 or less at p75.

## Explanation
### Calculation
`layout shift score = impact fraction × distance fraction`.
- Impact fraction: the share of the viewport affected by unstable elements (before and after union).
- Distance fraction: the largest movement distance relative to the viewport's largest dimension.
- Shifts grouped into session windows (gaps < 1 s, max 5 s); CLS = the maximum window. User-initiated shifts (within 500 ms of input) are excluded; transforms don't count as layout shifts.

### Causes and fixes

| Cause | Fix |
|---|---|
| `<img>`/`<video>`/`<iframe>` without dimensions | `width`/`height` attributes (browser derives `aspect-ratio`), or CSS `aspect-ratio: 16 / 9` |
| Late ads / embeds / widgets | reserve `min-height` for the slot; collapse after load rather than expanding |
| Banner/cookie bar inserted at the top | overlay (fixed/sticky) or reserve space initially; don't push content |
| Web font swap changing text metrics | `font-display: swap/optional` + `size-adjust`/`ascent-override` fallbacks (`next/font` does this); preload the key font |
| Content loaded client-side above existing content | placeholders with fixed sizes; render the above-the-fold content on the server |
| Skeletons of wrong height | match skeleton dimensions to the loaded content |
| Animations using `top/left/height/margin` | use `transform`/`opacity` |
| Dynamic injected UI (toasts, banners) | `position: fixed` overlay |
| Responsive images without sizes | `srcset` + `sizes` with intrinsic aspect ratio |
| Late-loading CSS | inline critical CSS; avoid FOUC |

### Code examples

```html
<img src="p.jpg" width="800" height="450" alt="…" style="height:auto;max-width:100%">

<div class="ad-slot" style="min-height:250px">…</div>
```

```css
.video { aspect-ratio: 16 / 9; width: 100%; }

.toast { position: fixed; bottom: 1rem; right: 1rem; transform: translateY(0); transition: transform .2s; }
.toast[hidden] { transform: translateY(150%); }

@font-face {
  font-family: "BrandFallback";
  src: local("Arial");
  size-adjust: 104%;
  ascent-override: 92%;
  descent-override: 24%;
  line-gap-override: 0%;
}
body { font-family: "Brand", "BrandFallback", sans-serif; }
```

### Finding shifts
1. DevTools Performance → "Layout Shifts" track; the Rendering panel's "Layout Shift Regions" highlights shifts as you load.
2. Lighthouse "Avoid large layout shifts" lists elements.
3. RUM attribution (`web-vitals/attribution`): `largestShiftTarget`, `largestShiftTime`, and `largestShiftSource` identify the element.
4. Compare unthrottled vs slow-network runs; slow networks expose late-loading assets.

### Frameworks
- Next.js: `next/image` requires dimensions or `fill` with a sized parent; `next/font` adjusts fallbacks; Suspense fallbacks must match content size.
- React: avoid mounting conditional UI that pushes content (render placeholders).
- SPAs: bfcache restores can avoid shifts; check for layout changes after hydration.

### Related
- **Back/forward cache**: avoid `unload` handlers to make pages bfcache-eligible, which also improves perceived stability.
- **Sticky headers**: when headers appear/disappear, use `transform`-based hiding.

## Follow-ups
- **Do transforms count as layout shifts?** — No; they don't change layout geometry.
- **Why do fonts cause CLS?** — Fallback and web fonts have different glyph widths and heights, so lines reflow on swap.

## Common Mistakes
- Setting only CSS `width: 100%; height: auto` without width/height attributes (no reserved ratio before load).
- Inserting banners at the top without reserved space.
- Ignoring shifts that happen only on slow networks.

## Tips
- "Reserve space for anything that loads later" is the one-line summary.
