---
title: "How do you choose between SPA, SSR, SSG and a hybrid for a new product?"
level: medium
type: design
tags: [rendering, spa, ssr, ssg, isr, ppr, nextjs, architecture]
related: [architecture/separation-of-concerns-react, architecture/micro-frontends-when-not, architecture/nextjs-app-router-structure]
---

## Question
You are asked to choose the rendering architecture for three products: (1) a marketing site with a blog, (2) an internal admin dashboard behind login, and (3) an e-commerce site with product pages and a personalized cart. Which rendering approach do you pick for each, and why?

## Interview Answer
I decide based on three questions. Does the content need SEO and a fast first paint? How often does it change? Is it personalized per user? A marketing site and blog changes rarely and needs SEO, so it should be static: SSG, revalidated when content changes. An internal dashboard behind login needs no SEO and is highly interactive, so a client-rendered SPA, or a Next.js app with mostly client components, is simple and cheap. E-commerce needs a hybrid. Product pages should be prerendered and cached for SEO and speed, while price, stock and the cart are dynamic per request or per user. In Next.js today the line between static and dynamic is drawn at the component level, so one page can have a static shell plus dynamic parts that stream in.

## Explanation
### The options

| Strategy | HTML produced | Strengths | Weaknesses |
|---|---|---|---|
| **SPA / CSR** | Empty shell; JS renders in the browser | Simple hosting (static files), rich interactivity, cheap | Slow first load on weak devices, poor SEO, loading spinners |
| **SSR** | Per request on the server | Fresh and personalized data, good SEO | Server cost, TTFB depends on the slowest data |
| **SSG** | At build time | Fastest (CDN), cheapest, very reliable | Stale until rebuild; does not fit per-user data |
| **ISR / revalidation** | Static, regenerated on a timer or on demand | SSG speed with fresh-enough data | Brief staleness; needs a cache-aware host |
| **Hybrid (static shell + streamed dynamic parts)** | Static parts prerendered, dynamic parts streamed per request | Instant shell *and* personalized data | More concepts; needs a streaming-capable host |

### Decision flow

```txt
Needs SEO / fast first paint for anonymous users?
├─ no  (behind login, app-like) → SPA or client-heavy app
└─ yes → Is content the same for everyone?
         ├─ yes → changes rarely?  → SSG (+ on-demand revalidation)
         │        changes often?   → ISR / cached data with tags
         └─ no (personalized)      → SSR, or a static shell + dynamic islands
```

### Applying it
1. **Marketing + blog:** SSG. When the CMS publishes, a webhook calls `revalidateTag("posts")` or `revalidatePath`. No rebuild is needed, and the pages are served from the CDN.
2. **Admin dashboard:** SPA-style. Next.js can still be used (routing, auth via proxy, Route Handlers), but most screens are Client Components with TanStack Query. SEO is irrelevant and data is user-specific.
3. **E-commerce:** Hybrid. The product description, images and reviews summary are cached. Price and stock are dynamic or short-lived. The cart badge and recommendations are per user and streamed behind a `<Suspense>` boundary.

### What changed recently
The older model chose static or dynamic **per route**: one `cookies()` call made the whole page dynamic. Next.js now treats static and dynamic as a spectrum at the **component** level. With Cache Components (`cacheComponents: true`), you mark cacheable functions or components with `"use cache"`, and anything dynamic inside a `<Suspense>` boundary streams after the static shell (Partial Prerendering). The infrastructure trade-off is that your host must support streaming and cache invalidation.

## Follow-ups
- **What metrics would you watch to validate the choice?** — LCP and TTFB for the server/static decision, INP for interactivity-heavy pages, and server cost per request for SSR.
- **When is a pure SPA the wrong choice even behind login?** — When users are on slow phones or networks (large JS bundles hurt), or when parts of the "app" are shareable public pages that need link previews.

## Common Mistakes
- Defaulting to SSR everywhere. It costs server time on every request even when the content is identical for all users.
- Treating the choice as all-or-nothing for the whole app. Mixing strategies per route or per component is the normal case.

## Tips
- Lead with the three questions (SEO, freshness, personalization), then map each product to them. A framework of criteria scores better than a list of acronyms.
