---
title: "TanStack Query with Next.js App Router: prefetching, HydrationBoundary and Suspense queries"
level: advanced
type: design
tags: [tanstack-query, nextjs, ssr, hydration, prefetchQuery, dehydrate, useSuspenseQuery]
related: [state/why-tanstack-query, react/data-fetching-approaches, nextjs/client-side-data-fetching]
---

## Question
Design the integration of TanStack Query with the Next.js App Router: how do you create the QueryClient, prefetch on the server, pass the cache to the client, avoid refetching on mount, and avoid sharing a client across requests?

## Clues
- A QueryClient must not be shared between requests on the server.
- `dehydrate` serialises the cache; `HydrationBoundary` restores it.
- Set a non-zero `staleTime` so hydrated data isn't immediately refetched.

## Interview Answer
I create a `QueryClient` per request on the server and one singleton on the client via a `getQueryClient()` helper, with `staleTime` greater than zero so server-prefetched data isn't refetched immediately on the client. A Server Component prefetches with `await queryClient.prefetchQuery(options)` and renders `<HydrationBoundary state={dehydrate(queryClient)}>` around the Client Component that calls `useQuery` with the same options (`queryOptions` shared in a module), so the client renders with data immediately and then takes over caching, background refetching and mutations. A `Providers` Client Component holds the client for the tree. For streaming, I can prefetch without awaiting and let pending queries dehydrate (`shouldDehydrateQuery` including pending) while Client Components use `useSuspenseQuery`. I only reach for this when client-side cache features matter; otherwise Server Components alone fetch and render.

## Explanation
### Client creation

```ts
// lib/query-client.ts
import { QueryClient, defaultShouldDehydrateQuery, isServer } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000 },                              // avoid immediate refetch after hydration
      dehydrate: {
        shouldDehydrateQuery: (q) => defaultShouldDehydrateQuery(q) || q.state.status === "pending",   // stream pending queries
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) return makeQueryClient();                          // new client per request/render
  return (browserQueryClient ??= makeQueryClient());               // singleton in the browser
}
```

```tsx
// app/providers.tsx
"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();                            // don't use useState with a possibly suspended component
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### Prefetch in a Server Component

```ts
// lib/queries.ts: shared by server and client
export const postsQuery = () =>
  queryOptions({
    queryKey: ["posts"],
    queryFn: async () => (await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`)).json() as Promise<Post[]>,
  });
```

```tsx
// app/posts/page.tsx (Server Component)
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";

export default async function PostsPage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(postsQuery());                    // errors are swallowed by prefetch; the client can retry

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Posts />
    </HydrationBoundary>
  );
}
```

```tsx
// app/posts/posts.tsx
"use client";
export function Posts() {
  const { data } = useQuery(postsQuery());                          // hydrated: data available on first render
  return <ul>{data?.map((p) => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

### Streaming variant (React 19 + Suspense)

```tsx
export default function PostsPage() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(postsQuery());                     // don't await: stream
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<PostsSkeleton />}>
        <PostsSuspense />                                          {/* uses useSuspenseQuery(postsQuery()) */}
      </Suspense>
    </HydrationBoundary>
  );
}
```

Pending promises are dehydrated and streamed, and Client Components resolve them as they arrive (needs `shouldDehydrateQuery` to include pending queries, and a React version supporting `use`).

### Rules and pitfalls
1. **New client per server request**, never a module singleton on the server (data leak between users; stale caches).
2. **`staleTime > 0`** or hydrated data refetches immediately on mount.
3. **Same `queryKey` and `queryFn` shape** on server and client; share via `queryOptions`.
4. **Serialisable data only**: `Date` objects become strings; use JSON-safe types or custom serialisers.
5. **Auth in `queryFn` on the server**: forward cookies/headers (use a server fetch with `cookies()`/`headers()`), or call your DAL directly; the client fetch uses browser cookies.
6. **Don't use `useState(() => new QueryClient())` in layouts that can suspend** (the state may be thrown away on suspend before hydration), prefer the `getQueryClient` pattern above.
7. **Nested boundaries**: multiple `HydrationBoundary`s can add more prefetched queries on navigation.
8. **Mutations on the client** invalidate the client cache; if Server Components also render the same data, also revalidate the server side (`router.refresh()` or Server Action + `updateTag`).

### When not to use it
- If data is only rendered, never refetched or mutated on the client, Server Components with `fetch`/`"use cache"` are simpler and ship less JavaScript.
- If you need only initial data, `initialData` props from a Server Component work (`useQuery({ …, initialData })`), at the cost of less flexibility (timestamps with `initialDataUpdatedAt`).

### Testing
Create a fresh QueryClient per test with `retry: false`; test hydration by wrapping with `HydrationBoundary` and a dehydrated state fixture.

## Follow-ups
- **Why not prefetch in a Client Component?** — Prefetching during a client render creates waterfalls; do it in the Server Component or route-level loader.
- **What about Route Handlers vs direct DB calls in `queryFn`?** — On the server, call the DAL directly; the same `queryFn` for the client typically fetches an API route, so make the `queryFn` environment-aware or use separate server/client fetchers behind the same key.

## Common Mistakes
- Forgetting `staleTime` and seeing a duplicate request after hydration.
- Sharing a QueryClient across requests.
- Mismatched keys between server prefetch and client `useQuery`.

## Tips
- Name the three parts: per-request client, prefetch + dehydrate, HydrationBoundary + shared queryOptions.
