---
title: "How did caching in Next.js change from 13/14 to 15 to 16?"
level: hard
type: concept
tags: [caching, next-14, next-15, next-16, cache-components, history]
related: [nextjs/caching-layers-overview, nextjs/use-cache-and-cache-life, nextjs/fetch-cache-previous-model, nextjs/app-shell-partial-prerendering]
---

## Question
Many tutorials describe caching defaults that no longer apply. What were the defaults in Next.js 14, what changed in 15, and what is the model in 16 with Cache Components? Why did the team change course?

## Clues
- Think about `fetch` defaults, `GET` Route Handlers and the client router cache.
- Version 16 uses a directive rather than implicit behaviour.
- The unit of caching moved from the route/request to the function/component.

## Interview Answer
In Next.js 13 and 14 caching was implicit and aggressive: `fetch` defaulted to `force-cache`, `GET` Route Handlers were static by default, and the client Router Cache kept dynamic pages for 30 seconds. It was fast but surprising: people saw stale data and had to opt out with `no-store`, `revalidate = 0` or `force-dynamic`. Next.js 15 flipped the defaults to uncached: `fetch` requests, `GET` handlers and client page navigations were not cached unless you opted in, and `dynamic` staleTime became 0, with `cookies()`, `headers()`, `params` and `searchParams` becoming async. Next.js 16 replaces the implicit model with Cache Components: nothing is cached unless you add `"use cache"` to a function or component, with `cacheLife` and `cacheTag` for lifetime and invalidation, and the framework prerenders what it can into a static shell while the rest streams behind Suspense. That also made `unstable_cache`, the `dynamic`/`revalidate`/`fetchCache` segment configs and the experimental PPR flag unnecessary for projects that adopt it.

## Explanation
### Timeline

| Version | `fetch` default | `GET` Route Handler | Client router cache (pages) | Notes |
|---|---|---|---|---|
| 13 / 14 | cached (`force-cache`) | static by default | 30 s dynamic, 5 min static | implicit; opt out with `no-store`, `revalidate = 0`, `force-dynamic` |
| 15 | **not cached** by default (opt in via `cache: 'force-cache'` or `next.revalidate`) | **not cached** | `staleTimes.dynamic` = 0 | request APIs async; `revalidateTag` etc. unchanged; experimental `ppr` |
| 16 | still not cached | follows prerendering model with Cache Components | based on `cacheLife.stale` | Cache Components: `"use cache"`, `cacheLife`, `cacheTag`, `updateTag`, `refresh`; `revalidateTag(tag, profile)`; Turbopack default; `middleware` renamed `proxy` |

### Why it changed
1. **Surprise factor**: people didn't know what was cached; "why is my data stale?" was the top complaint.
2. **Route-level granularity was too coarse**: using `cookies()` anywhere made the whole route dynamic; you couldn't mix static and dynamic.
3. **Composability**: caching tied to `fetch` ignored database calls, so `unstable_cache` and multiple configs appeared.
4. **Performance**: partial prerendering lets the static parts load instantly.

### Same example across versions

```tsx
// Next 14: cached by default, must opt out
const res = await fetch(url);                         // cached
const fresh = await fetch(url, { cache: "no-store" });

// Next 15: uncached by default, must opt in
const cached = await fetch(url, { cache: "force-cache" });
const timed = await fetch(url, { next: { revalidate: 3600, tags: ["posts"] } });

// Next 16 with Cache Components: opt in per function or component
async function getPosts() {
  "use cache";
  cacheLife("hours");
  cacheTag("posts");
  return (await fetch(url)).json();                   // cached because of the directive
}
```

### What to do on a project today
- **Cache Components on** (new `create-next-app` defaults): use `use cache`, `cacheLife`, `cacheTag`, `updateTag`/`revalidateTag`; remove segment configs like `dynamic` and `revalidate`, which are incompatible.
- **Cache Components off** (an existing app staying on the previous model): keep using `fetch` options, `unstable_cache` and segment config; `revalidateTag` needs a second argument (profile) in 16.
- Migrating: adopt incrementally, following the dev overlay's blocking-route insights, then enable partial prefetching.

### Other relevant changes
- `revalidateTag(tag)` single-argument form is deprecated in favour of `revalidateTag(tag, profile)`.
- `updateTag` for read-your-writes in Server Actions; `refresh()` to re-render without touching caches.
- `experimental.staleTimes` / `cacheLife.stale` control the client cache.

## Follow-ups
- **Is `unstable_cache` removed?** — It still exists for the previous model but is superseded by `"use cache"`.
- **Does 16 cache `fetch` by default again?** — No; only functions/components with `"use cache"` (and fetches inside them) are cached.

## Common Mistakes
- Following a Next 13/14 tutorial and assuming `fetch` is cached.
- Mixing segment configs with Cache Components.
- Calling `revalidateTag(tag)` with one argument in 16.

## Tips
- Frame the history as "implicit and coarse → explicit and granular".
