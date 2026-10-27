---
title: "How do 'use cache' and cacheLife work? What forms the cache key?"
level: hard
type: concept
tags: [use-cache, cacheLife, cache-keys, serialization, cache-components]
related: [nextjs/caching-across-versions, nextjs/use-cache-pitfalls, nextjs/cache-tag-and-invalidation, nextjs/app-shell-partial-prerendering]
---

## Question
Explain the `"use cache"` directive. What can you apply it to, what goes into the cache key, what are `stale`, `revalidate` and `expire`, and what are the constraints on arguments and runtime APIs?

## Clues
- The cache key is derived from arguments and captured variables, not from the request.
- The three timing values apply to different parties: client, server background refresh, hard expiry.
- Cached functions run in an isolated context.

## Interview Answer
`"use cache"` marks an async function, component or whole file as cacheable. Next.js stores the return value, and a later call with the same inputs reuses it. The key is built from the build id, a hash of the function, and its serialisable arguments and any captured outer variables, so different arguments produce separate entries. Lifetime comes from `cacheLife`: a profile like `hours`, or custom `stale` (how long the client can reuse it without asking), `revalidate` (after this long, the next request serves the cached value and refreshes in the background) and `expire` (after this long without traffic, the next request waits for fresh data). Without `cacheLife` the `default` profile applies, which I avoid by always setting one explicitly. Cached code can't read `cookies()`, `headers()` or `searchParams` directly; I extract those values outside and pass them in as arguments. Arguments and return values must be serialisable, with pass-through allowed for `children` and actions.

## Explanation
### Levels

```tsx
// data-level
export async function getUser(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`user-${id}`);
  return db.user.findUnique({ where: { id } });
}

// UI-level
export async function ProductGrid({ category }: { category: string }) {
  "use cache";
  cacheLife("days");
  const items = await getProducts(category);
  return <Grid items={items} />;
}

// file-level: every exported function must be async and is cached
// 'use cache' at the top of the file
```

### Cache key

1. Build id (or `deploymentId`): a new deploy invalidates everything.
2. Function id: hash of its location and signature.
3. Serialisable arguments (props for components).
4. Captured variables from outer scopes.

```tsx
async function Page({ userId }: { userId: string }) {
  const getData = async (filter: string) => {
    "use cache";
    return fetchFor(userId, filter);       // key includes userId (captured) and filter (arg)
  };
  return <View data={await getData("active")} />;
}
```

### Lifetime

| Value | Audience | Meaning | Default profile |
|---|---|---|---|
| `stale` | client router | reuse without contacting the server | 5 min |
| `revalidate` | server | after this, serve stale and refresh in background | 15 min |
| `expire` | server | after this with no traffic, next request blocks for fresh | never |

Presets: `seconds`, `minutes`, `hours`, `days`, `weeks`, `max`. Define custom profiles in `next.config.ts` under `cacheLife`. `expire` must exceed `revalidate`.

### Inline form

```tsx
cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
```

Call it once per function invocation (conditional branches allowed, but only one runs).

### Constraints
- **Async only.**
- **Serialisable arguments/returns**: primitives, plain objects, arrays, Date, Map, Set, typed arrays; return values may include JSX. No class instances, functions (except pass-through) or symbols.
- **Pass-through**: `children`, Server Actions or other opaque values can flow through without being read.
- **No runtime APIs inside**: read `cookies()` or `headers()` outside and pass the value in; `"use cache: private"` is an escape hatch.
- **`React.cache` is isolated** inside a cached scope.
- **Draft Mode** bypasses caching.

### Runtime behaviour and hosting
- Default storage is in-memory (LRU): on a long-lived server it persists across requests; on serverless instances it often doesn't, though build-time/prerender caching still works.
- `"use cache: remote"` plus a custom cache handler (Redis/KV) shares entries across instances.
- Entries don't carry across deploys because the build id is in the key.

### Prerendering interaction
Cached output with a long enough `stale` (about 5 minutes or more) can be baked into the static shell; very short lifetimes are excluded and computed per request.

## Follow-ups
- **Can I cache a component that takes `children`?** — Yes, if you don't inspect them; they pass through.
- **How do I invalidate by event?** — Add `cacheTag` and call `revalidateTag` or `updateTag`.

## Common Mistakes
- Omitting `cacheLife` and relying on the default.
- Passing a class instance (for example a Prisma model with methods).
- Reading `cookies()` inside the cached function.

## Tips
- Say "key = arguments + captured values" and the three lifetime values with their audience.
