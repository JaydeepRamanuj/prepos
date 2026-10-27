---
title: "Request memoization: fetch deduping, React.cache and avoiding duplicate queries"
level: medium
type: concept
tags: [memoization, react-cache, fetch, data-access-layer, deduplication]
related: [nextjs/caching-layers-overview, nextjs/avoid-data-waterfalls, nextjs/data-access-layer, nextjs/fetching-in-server-components]
---

## Question
Several Server Components (layout, page, `generateMetadata`) need the same user record. How do you avoid duplicate database queries within one render, and how is that different from `use cache`?

## Interview Answer
Within a single server render, identical `fetch` GET requests (same URL and options) are memoised automatically, so layout, page and `generateMetadata` can each call `fetch` for the same resource without making three requests. For non-`fetch` work such as database queries, I wrap the function in React's `cache()`; calls with the same arguments during that request run once and share the result. Request memoization lasts only for the render of one request, so it dedupes but doesn't persist, unlike `use cache`, which stores results across requests. This lets me colocate data access in the components that need it, instead of fetching high up and prop-drilling, while keeping queries single-flight. Arguments are compared by identity, so pass primitives like ids, not fresh objects.

## Explanation
### `fetch` memoisation

```tsx
// both calls in one request hit the network once
await fetch("https://api.example.com/user/1");
await fetch("https://api.example.com/user/1");
```

It applies to `GET`/`HEAD`, same URL and options, during a React render pass (layouts, pages, `generateMetadata`, Server Components). It doesn't apply to POST or in Route Handlers or Server Actions.

### `React.cache` for databases

```ts
// lib/data.ts
import "server-only";
import { cache } from "react";

export const getUser = cache(async (id: string) => {
  console.log("DB query for", id);
  return db.user.findUnique({ where: { id } });
});
```

```tsx
// layout.tsx
const user = await getUser(id);       // runs the query
// page.tsx
const user = await getUser(id);       // reuses the same promise: no second query
// generateMetadata
const user = await getUser(id);       // reuses again
```

### Gotchas
- **Arguments compare by `Object.is`**: `getUser({ id })` with a new object each time never hits the memo; use primitives.
- **Per-request scope**: the memo is dropped after the request. Two users never share memoised results.
- **No cross-request caching**: for that use `use cache` (or `unstable_cache` in the previous model).
- **Isolation**: inside a `"use cache"` function, `React.cache` is a separate scope; memo values from outside aren't visible.
- **Server only**: `cache()` is for Server Components; on the client it does nothing useful.
- Cached promises that reject share the rejection for the request.

### Combining with `use cache`

```ts
export const getUser = cache(async (id: string) => getUserCached(id));

async function getUserCached(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user-${id}`);
  return db.user.findUnique({ where: { id } });
}
```

`cache()` dedupes within a render; `use cache` stores across requests.

### Why this matters
It enables colocated data fetching without waterfalls or duplicate work: each component asks for what it needs. Pair with parallel fetches (`Promise.all`) or start promises early to avoid sequential awaits.

### Data access layer
Centralising `cache`-wrapped functions in a `server-only` module is also the natural place for authorisation checks.

```ts
export const getCurrentUser = cache(async () => {
  const session = await verifySession();     // reads cookies; once per request
  return session ? db.user.findUnique({ where: { id: session.userId } }) : null;
});
```

## Follow-ups
- **Does memoisation work across the layout and page boundary?** — Yes, they render in the same request.
- **Why not use a module-level variable?** — It would be shared across requests and users: a data leak.

## Common Mistakes
- Passing object arguments.
- Expecting `cache()` to persist across requests.
- Using a module-level cache variable on the server.

## Tips
- Contrast the lifetimes: render, request-spanning, and client cache.
