---
title: "Caching without Cache Components: fetch options, unstable_cache and route segment config"
level: hard
type: concept
tags: [fetch-cache, unstable_cache, route-segment-config, force-dynamic, previous-model]
related: [nextjs/caching-across-versions, nextjs/use-cache-and-cache-life, nextjs/time-vs-on-demand-revalidation, nextjs/ssr-ssg-isr-csr]
---

## Question
Your app hasn't enabled `cacheComponents`. How do you cache a `fetch`, a database query and a whole route, how do `dynamic`, `revalidate` and `fetchCache` behave, and what makes a route static or dynamic in this model?

## Clues
- In current versions `fetch` is uncached by default; caching is opt-in.
- Route-level configs can force static or dynamic behaviour.
- Using a request-time API changes how a route is rendered.

## Interview Answer
Without Cache Components, I opt in per request: `fetch(url, { cache: 'force-cache' })` caches it, and `next: { revalidate: n, tags: [...] }` adds time-based revalidation and tags. For non-`fetch` work such as a database query I wrap the function in `unstable_cache(fn, keyParts, { revalidate, tags })`. At the route level, `export const dynamic` can be `'auto'`, `'force-dynamic'`, `'force-static'` or `'error'`, `export const revalidate` sets the default time, and `fetchCache` overrides fetch defaults. A route is prerendered unless it uses request-time APIs (`cookies()`, `headers()`, `searchParams`) or uncached data after them, in which case it renders per request; this is all-or-nothing per route, which is what Cache Components later made granular. Invalidation uses `revalidateTag(tag, profile)` or `revalidatePath` from actions and route handlers.

## Explanation
### Per-request options

```ts
// cached forever (until revalidated)
await fetch(url, { cache: "force-cache" });

// time-based + tags
await fetch(url, { next: { revalidate: 3600, tags: ["posts"] } });

// explicitly uncached
await fetch(url, { cache: "no-store" });
```

### Non-fetch data

```ts
import { unstable_cache } from "next/cache";

export const getCachedUser = unstable_cache(
  async (id: string) => db.user.findUnique({ where: { id } }),
  ["user"],                                   // key prefix; arguments are also part of the key
  { tags: ["user"], revalidate: 3600 }
);
```

### Route segment config

| Export | Values | Effect |
|---|---|---|
| `dynamic` | `auto` (default), `force-dynamic`, `force-static`, `error` | force dynamic rendering; force static (cookies/headers return empty); throw if anything is dynamic |
| `revalidate` | `false` (default), `0`, number | default revalidate seconds; must be a literal (`600`, not `60 * 10`) |
| `fetchCache` | `auto`, `default-cache`, `force-no-store`, … | override fetch caching defaults (advanced) |

The lowest `revalidate` across layouts and pages of a route sets the route's frequency.

### What makes a route dynamic
- Using `cookies()`, `headers()`, `searchParams`, `connection()` or uncached data discovered after them.
- `export const dynamic = 'force-dynamic'` or `revalidate = 0`.
- A `fetch` before any request-time API with no cache option is fetched once at build and the route is prerendered; after a request-time API it runs on every request.

### On-demand invalidation

```ts
revalidateTag("posts", "max");     // Server Action or Route Handler
revalidatePath("/blog");
```

### Limitations that Cache Components fixes
1. Granularity: a single `cookies()` read makes the entire route dynamic.
2. Fragmentation: three mechanisms (fetch options, `unstable_cache`, segment config).
3. Surprise: static-vs-dynamic is inferred, so mistakes appear as stale or slow pages.

### Migrating
Enable `cacheComponents`, delete `dynamic`/`revalidate`/`fetchCache` configs (they conflict), replace `unstable_cache` with `"use cache"` + `cacheLife` + `cacheTag`, and wrap runtime access in Suspense.

## Follow-ups
- **Is `force-static` safe for pages that read cookies?** — It makes `cookies()` return empty values; use only when you really want static output.
- **Does `unstable_cache` work with `cookies()` inside?** — No; pass values as arguments.

## Common Mistakes
- Writing `revalidate = 60 * 10`.
- Combining `force-dynamic` with expectations of caching.
- Forgetting `tags` when planning on-demand revalidation.

## Tips
- Name the three mechanisms and their shortcomings; it sets up the Cache Components story.
