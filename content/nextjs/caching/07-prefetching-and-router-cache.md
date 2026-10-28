---
title: "How do prefetching and the client router cache work, and why might I see stale pages?"
level: hard
type: concept
tags: [prefetch, router-cache, client-cache, staleTimes, link, router-refresh]
related: [nextjs/caching-layers-overview, nextjs/app-shell-partial-prerendering, nextjs/stale-data-after-mutation, nextjs/layout-vs-template]
---

## Question
Explain what `<Link>` prefetches, how the client-side router cache stores results, how long entries live, and how to refresh or opt out when users see outdated pages after navigating.

## Clues
- Prefetching depends on whether a route is static or dynamic, and on whether `loading.tsx` exists (without Cache Components).
- The client stores RSC payloads in memory keyed by route segments.
- Mutations through Server Actions can invalidate it.

## Interview Answer
In production, `<Link>` prefetches the route when it enters the viewport (and prioritises hover or touch intent), and `router.prefetch()` does it manually. Without Cache Components, a static route is prefetched in full, while a dynamic route is only prefetched up to the nearest `loading.tsx` boundary. The RSC payloads are kept in an in-memory client cache keyed by segments, so layouts are reused and only the changing leaf is fetched on navigation. Static entries live for about 5 minutes by default; dynamic page entries live 0 seconds since Next.js 15 (configurable with experimental `staleTimes`), and with Cache Components the `stale` value of `cacheLife` drives it, with a 30-second minimum for cached content. The cache is cleared on a full reload. It's invalidated by `router.refresh()`, by `revalidatePath`/`revalidateTag`/`updateTag`/`refresh` called from a Server Action, and by `cookies.set/delete` in actions. With partial prefetching enabled, `<Link>` prefetches a per-route app shell by default.

## Explanation
### What gets prefetched

| Setup | Static route | Dynamic route |
|---|---|---|
| Without Cache Components | full route payload | only up to the `loading.js` boundary (nothing if none) |
| Cache Components + partial prefetching | the route's app shell (shared across links) | the app shell; remaining data streams after navigation |

Prefetching runs only in production and only for `<Link>`s (or manual calls); dev doesn't show it.

### Controlling it

```tsx
<Link href="/pricing" prefetch={false}>Pricing</Link>      // opt out (large lists of links)
<Link href="/dashboard" prefetch>Dashboard</Link>          // prefetch fully / resolve URL data

const router = useRouter();
router.prefetch("/checkout");                              // programmatic warm-up
router.refresh();                                          // refetch the current route's RSC payload
```

### Client cache lifetimes
- Static / `prefetch={true}`: `staleTimes.static`, default 5 minutes.
- Dynamic pages: `staleTimes.dynamic`, default 0 (since v15; it was 30 s in 14).
- With Cache Components: `cacheLife.stale` (min 30 s client-side).
- Shared layouts are not refetched on every navigation: only the changed segments are requested.
- Back/forward navigation restores from the cache to preserve scroll and avoid layout shift.

```ts
// next.config.ts (experimental)
experimental: { staleTimes: { dynamic: 30, static: 180 } }
```

### Why users see stale data
1. A mutation outside a Server Action (e.g. a client `fetch` to an API route) doesn't invalidate the client cache. Fix: use Server Actions, or call `router.refresh()` after the request.
2. The page used a long `stale` value or was prefetched earlier; navigating back within that window shows old content.
3. A Server Action mutated data but you revalidated the wrong path/tag.
4. Another tab or user changed data; the cache only learns on navigation after expiry.

### Invalidation from actions

```ts
"use server";
export async function save() {
  await db.save();
  revalidatePath("/items");        // also clears the matching client cache entries
}
```

### Tuning guidelines
- Keep default prefetching for primary navigation (instant feel).
- Disable prefetch for huge link lists, rarely visited pages or pages with expensive renders.
- Use `loading.tsx` or Suspense below shared layouts so dynamic routes prefetch something useful and show fallbacks instantly.
- Don't set long `stale` on frequently changing personalised data.
- For Cache Components, give each `cacheLife` a deliberate `stale`.

## Follow-ups
- **Does prefetching run Server Actions or mutations?** — No; only GET-like route payload fetching.
- **Why is hovering faster than viewport?** — Hover signals intent and re-prioritises; the scheduler handles viewport links lower.

## Common Mistakes
- Testing prefetch behaviour in dev.
- Mutating via client `fetch` and expecting pages to refresh.
- Giving personalised pages a long stale time.

## Tips
- Know the defaults (5 min static, 0 dynamic) and the invalidation triggers.
