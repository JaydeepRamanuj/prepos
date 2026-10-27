---
title: "What is the critical rendering path, and what blocks rendering?"
level: medium
type: concept
tags: [critical-rendering-path, render-blocking, css, defer, async, parsing]
related: [performance/loading-resource-hints, performance/lcp-fixes, performance/images-and-fonts-loading]
---

## Question
Walk through how a browser turns HTML, CSS and JavaScript into pixels. Which resources block rendering or parsing, and how do `async`, `defer`, `media` attributes and module scripts change that?

## Interview Answer
The browser parses HTML into the DOM, parses CSS into the CSSOM, combines them into a render tree, then does layout (geometry) and paint/composite. CSS is render-blocking: the browser won't paint until the CSSOM for stylesheets in the head is ready. Classic `<script>` tags are parser-blocking: parsing pauses to download and run them, and scripts also wait for pending CSS because they might query styles. `defer` downloads in parallel and executes after parsing in order; `async` downloads in parallel and executes as soon as ready, in no guaranteed order; `type="module"` scripts are deferred by default. To speed up first render I inline critical CSS or keep the CSS small, load non-critical CSS without blocking (`media="print"` swap or `rel="preload"`), put scripts at the end or use `defer`, avoid `@import` chains, preload key resources, and reduce DOM size and layout work.

## Explanation
### Pipeline

```txt
HTML bytes → tokens → DOM ─┐
CSS bytes  → CSSOM ────────┼→ render tree → layout → paint → composite
JS: can modify DOM/CSSOM   ┘
```

- **DOM** construction is incremental (streaming HTML parsing).
- **CSSOM** must be complete for the render to avoid FOUC, so CSS is render-blocking.
- **Layout** computes sizes/positions; **paint** records draw operations; **composite** layers are combined by the GPU.

### What blocks what

| Resource | Blocks parsing? | Blocks rendering? |
|---|---|---|
| `<link rel="stylesheet">` in head | no (preload scanner continues) | yes |
| `<style>` in head | no | yes (but no network) |
| `<script src>` (classic) | **yes** (waits for fetch + execution) | yes (indirectly) |
| `<script defer>` | no | no (runs after parsing, before `DOMContentLoaded`) |
| `<script async>` | no during download; pauses parsing when executing | no/briefly |
| `<script type="module">` | no (deferred) | no |
| inline `<script>` | yes (executes immediately, waits for preceding CSS) | yes |
| Web fonts | no | text rendering delayed or swapped depending on `font-display` |
| Images | no | no (but affect LCP/CLS) |

A script placed after a stylesheet must wait for the CSS to load because JS could read computed styles.

### Script loading attributes

```html
<script src="app.js" defer></script>      <!-- ordered, after parse; best default for app code -->
<script src="analytics.js" async></script><!-- independent scripts, no dependencies -->
<script type="module" src="main.js"></script>   <!-- deferred; modules are fetched with their dependency graph -->
```

### Optimise the path

1. **Minimise critical bytes**: compress (Brotli), minify, remove unused CSS/JS, split by route.
2. **Reduce critical resources and round trips**: avoid `@import`, flatten dependency chains, inline small critical CSS (above-the-fold) and load the rest async:

```html
<style>/* critical CSS */</style>
<link rel="preload" href="/app.css" as="style" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/app.css"></noscript>
<!-- or: <link rel="stylesheet" href="/print.css" media="print"> for non-screen styles -->
```

3. **Defer JavaScript**: `defer`/`async`, code splitting, dynamic imports, hydrate lazily; avoid long tasks on load.
4. **Prioritise**: `preload` for late-discovered critical resources (fonts, LCP image), `fetchpriority`, `preconnect` for critical origins.
5. **Avoid layout thrash** and keep the DOM small; large DOM increases style/layout cost.
6. **Server**: fast TTFB, HTTP/2 or 3, CDN, streaming HTML so the browser starts parsing early.

### The preload scanner
Browsers scan ahead of the parser to discover resources in HTML (`<img src>`, `<link>`, `<script src>`) and fetch them early, but it can't see resources referenced only in CSS (`background-image`, `@import`) or JS (dynamic injection), which is why LCP images in CSS or injected by JS load late.

### Metrics mapping
- **FCP/LCP** improve with less render-blocking CSS and faster resource discovery.
- **TBT/INP** improve with less script on the critical path.
- **CLS** improves with reserved space and font handling.

### Measuring
DevTools Network waterfall (blocking resources), Performance panel (parse HTML, recalculate style, layout, long tasks), Lighthouse "Eliminate render-blocking resources" and "Reduce unused CSS/JS".

## Follow-ups
- **Why is CSS render-blocking but not parser-blocking?** — The browser keeps building the DOM but won't paint until the CSSOM is available, to avoid unstyled flashes; scripts that follow must wait for it.
- **`async` vs `defer` for analytics?** — `async` is fine for independent scripts; `defer` preserves order.

## Common Mistakes
- Blocking scripts in `<head>` without `defer`.
- Large unused CSS bundles.
- Hiding the LCP element behind JS.

## Tips
- Draw the pipeline and mark what blocks what.
