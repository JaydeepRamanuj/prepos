---
title: "What are the caching layers in Next.js, and which one is biting you?"
level: medium
type: concept
tags: [caching, request-memoization, data-cache, router-cache, cdn, layers]
related: [nextjs/caching-across-versions, nextjs/use-cache-and-cache-life, nextjs/request-memoization-react-cache, nextjs/prefetching-and-router-cache]
---

## Question
Next.js caches at several levels. Name them, say where each lives and how long it lasts, and describe a way to find out which layer is serving stale data.

## Interview Answer
Think of it as layers from the request outward. Request memoization dedupes identical `fetch` calls (and `React.cache` functions) during a single server render. The data cache stores results across requests: `use cache` entries with Cache Components, or `fetch` with `force-cache`/`next.revalidate` and `unstable_cache` in the older model. The rendered output, the static shell or full-route HTML plus RSC payload, is produced at build time or on revalidation and can be served from a CDN. On the client, the router keeps RSC payloads in an in-memory client cache for prefetched and visited routes. Beyond Next.js there is also the browser HTTP cache and CDN caching via `Cache-Control`. When data is stale, I bisect: test with a hard refresh, check response headers on the CDN, check whether the server render re-ran, and then check whether the client router cache served an old payload.

## Explanation
### Layers

| Layer | Where | Scope / lifetime | Invalidate with |
|---|---|---|---|
| Request memoization | server, per render | one request; dedupes `fetch` GET with same URL/options and `React.cache` calls | automatic (end of request) |
| Data cache (`use cache`, `fetch` cache, `unstable_cache`) | server (in-memory by default, or custom handler) | across requests until `revalidate`/`expire` | `cacheLife`, `revalidateTag`, `updateTag`, `revalidatePath` |
| Prerendered output (static shell / full route cache) | build output, CDN | until redeploy or revalidation | revalidation, new deploy |
| Client router cache | browser memory | `stale` time (5 min static default; 30 s minimum for `use cache` content); cleared on refresh | `router.refresh()`, revalidation APIs from actions, navigation after expiry |
| Browser HTTP cache | browser | per `Cache-Control` headers | hashed filenames, headers |
| CDN cache | edge | per `Cache-Control`, surrogate keys | purge, TTL |

### A request through the layers

```txt
Click link
  -> client router cache hit? (prefetched RSC payload, stale time not expired) -> instant
  -> else request to CDN/server
        -> CDN has the static shell? serve it, stream dynamic holes
        -> server renders:
             -> use cache / data cache entry fresh? reuse
             -> else run function (memoised within this render) and store
```

### Debugging stale data: bisect

1. **Browser**: open in a private window or hard refresh. If fixed, it's the client router cache or HTTP cache.
2. **Network tab**: check the document/RSC response headers (`x-nextjs-cache` on some setups, `Cache-Control`, `Age`, CDN status headers).
3. **Server logs**: set `logging.fetches.fullUrl` in dev (`next.config`) to see fetch cache hits/misses.
4. **Data layer**: call the data function directly; is the source stale?
5. **Revalidation**: was `revalidateTag`/`updateTag` actually called with the same tag the data was tagged with? Called from a Server Action or Route Handler? After the mutation completed?
6. **Deployment**: a new build invalidates `use cache` entries (build id in the key); in multi-instance deployments in-memory caches differ per instance.

### In development
Pages render on demand and are not cached like production; always test caching behaviour with `next build && next start`.

### Principle
Cache close to the data for shared results, close to the user for navigations, and never cache per-user data in shared layers.

## Follow-ups
- **Which layers are shared between users?** — Data cache, prerendered output, CDN. Client router cache and HTTP private caches are per user.
- **How do you disable one layer?** — `no-store`/dynamic rendering for server layers; `prefetch={false}`, `router.refresh()` or shorter `stale` for the client router.

## Common Mistakes
- Debugging the server cache when the client router cache is serving the payload.
- Testing in dev and expecting production caching.
- Tagging data with one tag and revalidating another.

## Tips
- Present the bisect order; it shows you can debug caching, not just define it.
