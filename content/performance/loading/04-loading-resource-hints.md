---
title: "Resource hints: preload, prefetch, preconnect, modulepreload and fetchpriority"
level: hard
type: concept
tags: [preload, prefetch, preconnect, dns-prefetch, modulepreload, fetchpriority, early-hints]
related: [performance/critical-rendering-path, react/document-metadata-preloading, performance/lcp-fixes]
---

## Question
Compare `preload`, `prefetch`, `preconnect`, `dns-prefetch`, `modulepreload` and `fetchpriority`. When is each appropriate, what are the costs of overusing them, and how do `103 Early Hints` fit in?

## Clues
- Some hints are for the current page, others for future navigations.
- Hints compete for bandwidth and connections.
- Fonts need the `crossorigin` attribute even when same-origin.

## Interview Answer
`preload` tells the browser to fetch a resource needed on this page soon with high priority, for late-discovered critical assets such as the LCP image, key fonts or a critical script; `prefetch` fetches a resource likely needed for a future navigation at idle, low priority; `preconnect` opens the DNS, TCP and TLS connection to an origin you'll need soon, `dns-prefetch` only resolves DNS (a cheaper fallback); `modulepreload` fetches and compiles an ES module and its dependencies; and `fetchpriority="high|low"` adjusts the relative priority of fetches (`img`, `link`, `script`, `fetch()`). They're hints, not commands, and misuse hurts: preloading too much delays truly critical resources, preloaded but unused resources waste bytes and trigger console warnings, and too many preconnects burn CPU and sockets. `103 Early Hints` lets the server send preload/preconnect headers before the final response is ready, so the browser starts fetching during server think time.

## Explanation
### Overview

| Hint | Purpose | Priority | Use for |
|---|---|---|---|
| `<link rel="preload" as="…">` | fetch now for this page | high (depends on `as`) | LCP image, critical font, above-the-fold CSS/JS discovered late |
| `<link rel="prefetch">` | fetch for next navigation | lowest, idle | next route's JS/data, likely next page |
| `<link rel="preconnect">` | DNS + TCP + TLS | n/a | critical third-party origins (fonts CDN, API, image CDN) |
| `<link rel="dns-prefetch">` | DNS only | n/a | less critical origins; fallback |
| `<link rel="modulepreload">` | fetch + parse module graph | high | ES module entry points and critical dynamic imports |
| `fetchpriority="high"` | raise relative priority | — | LCP `<img>`, important `fetch()` |
| `fetchpriority="low"` | lower priority | — | offscreen images in the initial viewport, non-critical scripts |
| `<link rel="prerender">` / Speculation Rules | render the next page | — | very likely next navigation |

### Examples

```html
<head>
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>
  <link rel="preload" as="image" href="/hero.avif" imagesrcset="/hero-800.avif 800w, /hero-1600.avif 1600w" imagesizes="100vw" fetchpriority="high">
  <link rel="preload" as="font" href="/fonts/brand.woff2" type="font/woff2" crossorigin>
  <link rel="modulepreload" href="/assets/main.js">
</head>

<img src="/hero.avif" fetchpriority="high" width="1600" height="900" alt="">
```

```js
// Prefetch the next route when the link is hovered or visible
link.addEventListener("pointerenter", () => import("./CheckoutPage"), { once: true });
fetch("/api/recommendations", { priority: "low" });   // Fetch Priority via the fetch() option
```

### Rules of thumb
1. **Preload only what the browser discovers late**: resources referenced by CSS (`@font-face`, `background-image`) or JS, not ones already in the HTML.
2. **Limit the count**: 1–3 preloads. Everything high priority is nothing high priority.
3. **Match the request**: correct `as`, `type`, `crossorigin` (fonts need `crossorigin`; preloads with mismatched attributes aren't reused and fetch twice).
4. **Use it or lose it**: preloaded resources not used within a few seconds log a console warning.
5. **Preconnect to few origins** (2–4): each idle connection is closed after a short time (~10 s) and costs.
6. **Prefetch** only with a reasonably high chance of use, and respect data-saver conditions (`navigator.connection.saveData`).

### 103 Early Hints
The server (or CDN) sends an interim `103` response with `Link: </app.css>; rel=preload; as=style, <https://cdn.example.com>; rel=preconnect` while the origin is still generating the HTML. The browser starts those fetches immediately, hiding server latency for dynamic pages. Supported in modern browsers for navigations; CDNs (Cloudflare, Fastly, CloudFront via functions) and servers can emit them. Only send hints that are valid for most responses of that URL.

### Speculation Rules (prefetch/prerender next pages)

```html
<script type="speculationrules">
{ "prerender": [{ "where": { "href_matches": "/products/*" }, "eagerness": "moderate" }] }
</script>
```

Chromium-based; prerendering executes the page in the background and can make navigations feel instant, at the cost of extra work and analytics considerations.

### Framework behaviour
- Next.js `<Link>` prefetches routes in the viewport (production only); `next/font` and `next/image` (`preload`/`priority`) emit the right hints; React 19 `preload()`, `preconnect()`, `preinit()` APIs.
- Vite/Rollup inject `modulepreload` for entry chunks.
- Don't also add manual preloads for assets the framework already preloads.

### Measuring
Network waterfall with priority column; Lighthouse "Preload key requests" and "Preconnect to required origins"; check for duplicate downloads; WebPageTest priority view. A/B test the effect on LCP.

## Follow-ups
- **Preload vs `fetchpriority`?** — Preload makes the browser discover the resource earlier; `fetchpriority` changes its priority relative to others. For an `<img>` in HTML, `fetchpriority="high"` is often enough without a preload.
- **Is `prefetch` the same as `prerender`?** — No: prefetch downloads, prerender also renders (and runs JS) in the background.

## Common Mistakes
- Preloading everything.
- Missing `crossorigin` on font preloads.
- Preloading resources that are already discoverable in the HTML.

## Tips
- Say "hints compete for bandwidth" and give the discovered-late rule.
