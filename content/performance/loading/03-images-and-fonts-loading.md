---
title: "Optimise images and web fonts for loading performance"
level: medium
type: concept
tags: [images, fonts, avif, webp, srcset, lazy-loading, font-display, preload]
related: [nextjs/next-image-basics, nextjs/next-font-optimization, performance/lcp-fixes, performance/cls-fixes]
---

## Question
Describe a checklist for delivering images and web fonts efficiently: formats, sizing, loading behaviour, priority, and layout stability. What are the common pitfalls?

## Interview Answer
For images, I serve modern formats (AVIF with WebP and JPEG fallbacks), resize to the displayed dimensions with `srcset` and `sizes`, compress sensibly, set `width` and `height` (or `aspect-ratio`) to avoid layout shift, lazy-load images below the fold with `loading="lazy"` and decode asynchronously, and give the LCP image high priority and never lazy-load it. SVG suits icons and illustrations, and a CDN with long-lived immutable caching delivers them. For fonts, I self-host WOFF2, subset to needed glyphs, limit the number of families and weights (variable fonts help), choose `font-display: swap` (or `optional` to avoid shifts), preload the one or two critical files with `crossorigin`, and use metric-compatible fallback fonts to minimise layout shift when the web font loads. Both are measured through LCP, CLS and total transferred bytes.

## Explanation
### Images

```html
<picture>
  <source type="image/avif" srcset="hero-480.avif 480w, hero-960.avif 960w, hero-1600.avif 1600w" sizes="(min-width: 64rem) 50vw, 100vw">
  <source type="image/webp" srcset="hero-480.webp 480w, hero-960.webp 960w, hero-1600.webp 1600w" sizes="(min-width: 64rem) 50vw, 100vw">
  <img src="hero-960.jpg" width="1600" height="900" alt="Product on a desk"
       fetchpriority="high" decoding="async">         <!-- LCP image: eager, high priority -->
</picture>

<img src="card.avif" width="400" height="300" alt="" loading="lazy" decoding="async">   <!-- below the fold -->
```

Checklist:
1. **Format**: AVIF > WebP > JPEG for photos (AVIF ~30–50% smaller than JPEG at similar quality; encoding slower); PNG only for lossless needs; SVG for vector.
2. **Dimensions**: never ship 4000 px images for 400 px slots; `srcset`/`sizes` let browsers pick (density and viewport aware).
3. **Quality**: 60–80 for photos; test visually.
4. **Loading**: lazy for offscreen, eager + high priority for LCP; don't lazy-load images in the initial viewport.
5. **Layout**: `width`/`height` attributes and `height: auto` in CSS preserve aspect ratio.
6. **CDN & caching**: image CDN (Cloudinary, imgix, Vercel/Next image optimisation) with `Cache-Control: public, max-age=31536000, immutable` for hashed URLs; content negotiation via `Accept` header for formats.
7. **Placeholders**: blur-up or dominant-colour placeholders (LQIP) for perceived speed.
8. **Background images**: not discoverable by the preload scanner; avoid for LCP or preload them.
9. **Video**: prefer `<video>` with `preload="metadata"` over animated GIFs (10× smaller).
10. **Accessibility**: meaningful `alt`.

### Fonts

```css
@font-face {
  font-family: "Brand";
  src: url("/fonts/brand-var.woff2") format("woff2");
  font-weight: 100 900;                  /* variable font range */
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;   /* latin subset */
}
```

```html
<link rel="preload" href="/fonts/brand-var.woff2" as="font" type="font/woff2" crossorigin>
```

Checklist:
1. **WOFF2 only** (universal support); self-host to avoid extra connections and caching partitioning issues.
2. **Subset** with tools like `pyftsubset`/`glyphhanger`; use `unicode-range` so scripts load on demand.
3. **Variable fonts** replace many static weights with one file.
4. **`font-display`**: `swap` (show fallback immediately), `optional` (no swap if slow; best for CLS), `block` avoided.
5. **Preload** only the critical font(s); `crossorigin` is required even for same-origin fonts; unused preloads waste bandwidth and warn in the console.
6. **Fallback metrics**: `size-adjust`, `ascent-override`, etc. (or frameworks like `next/font`) to minimise reflow.
7. **System font stack** for UI-heavy apps removes the font cost.
8. **Icon fonts** → inline SVG.
9. Avoid FOIT: don't hide text waiting for fonts.

### Measuring
- Network waterfall: are fonts discovered late (only after CSS parsed)? Preload helps.
- Lighthouse audits: "Properly size images", "Serve images in next-gen formats", "Preload key requests", "Ensure text remains visible".
- Filmstrip to see swaps and shifts.

### Pitfalls
- Lazy-loading the LCP image or a carousel's first slide.
- Preloading images responsive-agnostically (wrong size downloaded twice): use `imagesrcset`/`imagesizes`.
- Many weights/styles (400, 500, 600, 700 italic ...) loaded for little visible benefit.
- Third-party font CSS (Google Fonts) adds DNS/TLS and render-blocking CSS: self-host or use `next/font`.
- Missing `crossorigin` on font preloads → fetched twice.

## Follow-ups
- **`decoding="async"`?** — Lets the browser decode off the main thread/paint without blocking; fine for most images.
- **AVIF everywhere?** — Supported in all modern browsers; keep fallbacks for older ones via `<picture>`.

## Common Mistakes
- Serving the same large image to all devices.
- Using `font-display: block`.
- Preloading too many assets.

## Tips
- Mention both bytes and layout stability; images and fonts affect LCP and CLS.
