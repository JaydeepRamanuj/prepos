---
title: "When is client-side fetching still the right choice in the App Router?"
level: medium
type: design
tags: [client-fetching, tanstack-query, swr, polling, server-components]
related: [react/data-fetching-approaches, nextjs/fetching-in-server-components, nextjs/avoid-data-waterfalls, state/tanstack-query-basics]
---

## Question
With Server Components available, when would you still fetch on the client in a Next.js App Router app? How do you combine server-fetched initial data with a client-side cache?

## Interview Answer
Client fetching is the right tool when data depends on user interaction after load, changes frequently while the page is open, or must update without a navigation. Examples are polling dashboards, infinite scroll, search-as-you-type, optimistic updates, and data scoped to client-only state like a map viewport. I'd still render the initial data on the server where possible, to get content in the first HTML and avoid a loading spinner, then hand it to a client cache such as TanStack Query or SWR as initial data or via hydration, which then takes over revalidation, polling and mutations. For pure display of mostly stable data, Server Components plus `use cache` and revalidation are simpler and faster. I avoid fetching in `useEffect` by hand because it has no caching, deduping or race handling.

## Explanation
### Decision guide

| Scenario | Preferred approach |
|---|---|
| Public content, SEO, mostly stable | Server Component + `use cache` |
| Per-user page loaded once | Server Component (runtime) with Suspense |
| Live data (prices, notifications), polling | client cache (TanStack Query/SWR) |
| Infinite scroll / pagination triggered by user | client cache, first page from server |
| Search-as-you-type | client fetch with debounce and abort, or URL state + server render |
| Mutations with optimistic UI | Server Action + `useOptimistic`, or Query mutations |
| Third-party widgets needing browser state | client |

### Server initial data + client cache

```tsx
// app/orders/page.tsx — Server Component
export default async function Page() {
  const orders = await getOrders();                 // fast, in first HTML
  return <OrdersList initialData={orders} />;
}
```

```tsx
// orders-list.tsx
"use client";
import { useQuery } from "@tanstack/react-query";

export function OrdersList({ initialData }: { initialData: Order[] }) {
  const { data } = useQuery({
    queryKey: ["orders"],
    queryFn: ({ signal }) => fetch("/api/orders", { signal }).then((r) => r.json()),
    initialData,
    refetchInterval: 15_000,                        // keeps it live
  });
  return <ul>{data.map((o) => <li key={o.id}>{o.id}</li>)}</ul>;
}
```

For bigger apps use `prefetchQuery` on the server and `HydrationBoundary` on the client so the cache starts populated without passing props through.

### URL as state
Filters, sorting and pagination stored in `searchParams` make results shareable and let the Server Component do the fetching:

```tsx
// Client: update URL
router.replace(`?${new URLSearchParams({ q }).toString()}`);
// Server: read searchParams, fetch, render
```

Wrap interactive controls reading `useSearchParams` in `Suspense`.

### Route Handlers for client fetching
A client query function typically calls a Route Handler (`app/api/orders/route.ts`) or a Server Action (not for reads, since actions run sequentially and aren't designed for queries). Keep authentication checks in the handler.

### Cache invalidation between worlds
After a Server Action mutation, call `revalidateTag`/`updateTag` for server-cached data and invalidate the matching query keys on the client (`queryClient.invalidateQueries`), or rely on `router.refresh()` plus initial data keyed to server props.

### Pitfalls
- Duplicate sources of truth: copying server props into `useState` and also into a query cache.
- Waterfalls: client components fetching after hydration and then triggering child fetches.
- Fetching public cacheable data on the client, losing CDN caching and SEO.
- Missing `Suspense` around components that call `useSearchParams` on statically prerendered routes.

## Follow-ups
- **SWR vs TanStack Query?** — Both fine; TanStack Query has richer mutation, devtools and SSR hydration features.
- **Can Server Actions fetch data for client components?** — Possible but discouraged for reads; use Route Handlers or Server Components.

## Common Mistakes
- Defaulting to client fetching because it's familiar.
- Mixing both without a clear owner for each piece of data.

## Tips
- Say "server for first paint, client cache for liveness" and give a concrete example.
