---
title: "revalidateTag works locally, but in production some users still see old content"
level: advanced
type: scenario
tags: [revalidation, multi-instance, cache-handler, serverless, self-hosting, debugging]
related: [nextjs/vercel-vs-self-hosting, nextjs/cache-tag-and-invalidation, nextjs/caching-layers-overview, nextjs/use-cache-and-cache-life]
---

## Question
You self-host a Next.js 16 app on four containers behind a load balancer. After an admin publishes content and the Server Action calls `revalidateTag("posts", "max")`, about three quarters of readers continue to see the old content for up to an hour, and sometimes the same user sees old and new versions on consecutive refreshes. Explain the cause and the fix.

## Clues
- Where are cache entries stored by default?
- Which instance handled the revalidation call?
- Think about consistency of HTML and RSC payloads across instances.

## Interview Answer
By default each Next.js instance keeps its own cache (in memory for `use cache`, on local disk for ISR and fetch caches), and `revalidateTag` only invalidates the cache of the instance that handled the request. With four instances, one is refreshed and the other three keep serving stale entries until their own `revalidate`/`expire` elapses, and because the load balancer routes requests randomly, the same user can see old and new versions alternately. The fix is to share the cache across instances with a custom cache handler backed by Redis or object storage (`cacheHandlers` for Cache Components and `incrementalCacheHandlerPath` for the previous model) and implement tag coordination through `refreshTags()` so invalidations propagate. I also ensure a stable `deploymentId` and server action encryption key, and consider a CDN with purge by surrogate key. As an interim measure I'd lower `cacheLife` for the content, but that merely limits the staleness window.

## Explanation
### Why it behaves this way

```txt
Admin → LB → Pod A: revalidateTag("posts")  → invalidates Pod A's in-memory/disk cache only
Reader → LB → Pod B: serves cached "posts"  → stale
Reader → LB → Pod A: fetches fresh          → new
```

Symptoms: inconsistent content across refreshes (sticky sessions would hide it), staleness equal to the `revalidate`/`expire` of each entry, and "works locally" because dev/single-instance has one cache.

### Fix: shared cache with tag coordination

```ts
// next.config.ts
const config = {
  cacheComponents: true,
  cacheHandlers: {
    default: require.resolve("./cache-handlers/redis.js"),
    remote: require.resolve("./cache-handlers/redis.js"),
  },
};
```

The handler implements the cache handler interface (`get(cacheKey, softTags)`, `set(cacheKey, pendingEntry)`, `refreshTags()`, `getExpiration(tags)` and `updateTags(...)`). Store entries and tag timestamps in Redis; before serving a cached entry, compare its creation time with the latest invalidation time of its tags (`refreshTags()` loads the shared state, `getExpiration()` reports it, `updateTags()` records an invalidation). Check the `cacheHandlers` reference for the exact signatures in your version, including how the entry's value stream must be consumed.

Previous model (fetch cache, ISR): configure `cacheHandler` (`incrementalCacheHandlerPath`) with a shared store (several community packages such as `@neshca/cache-handler` exist), and note the docs' multi-instance guidance.

### Also required for multi-instance correctness

| Setting | Why |
|---|---|
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` same everywhere | otherwise "Failed to find Server Action" on a different instance |
| `deploymentId` | detects version skew during rollouts, forcing a reload instead of broken payloads |
| Immutable static assets retained across deploys | avoids 404s for old chunks |
| Shared build output | all pods run the same build |
| HTML + RSC consistency | revalidation regenerates both; a shared cache keeps them in sync |

### CDN layering
If a CDN sits in front, ISR pages carry `s-maxage … stale-while-revalidate`; invalidation must also purge the CDN (surrogate keys / purge API) or you'll see CDN-level staleness separate from the app cache. Dynamic pages are `private, no-store` and bypass it.

### Verifying the fix
1. Publish content and request the page 20 times via the LB; all responses should show new content within seconds.
2. Check per-pod logs for cache hits/misses.
3. Run a chaos test: restart pods; ensure cache survives (Redis) and no stampede (use revalidation with stale-while-revalidate and locking).
4. Add monitoring for cache hit ratio and revalidation latency.

### Alternatives
- Run a single instance for caching-heavy workloads (limits scale).
- Use a platform that provides coordinated caching (Vercel).
- Avoid server caching for volatile content: fetch client-side or use short `cacheLife` with `use cache: remote`.
- Pin users with sticky sessions (hides but doesn't fix inconsistency).

### Serverless note
With the default in-memory handler on serverless platforms, instances are ephemeral; build-time prerendering works, but runtime `use cache` entries often don't survive between requests, so use a remote handler when hit rate matters.

## Follow-ups
- **Why does it affect ISR and `use cache` differently?** — ISR output is stored on disk/handler per instance; `use cache` entries are in memory per instance unless `cacheHandlers` are configured.
- **What is `refreshTags` for?** — To pull the latest tag invalidation state from shared storage before serving cached data.

## Common Mistakes
- Assuming `revalidateTag` is global.
- Using sticky sessions to hide inconsistency.
- Forgetting the CDN layer.

## Tips
- State "the cache is per instance by default" and then name the shared handler plus `refreshTags`.
