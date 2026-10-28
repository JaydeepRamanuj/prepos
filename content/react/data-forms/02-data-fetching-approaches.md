---
title: "Data fetching in React: useEffect, query libraries, or Server Components?"
level: medium
type: design
tags: [data-fetching, tanstack-query, server-components, use-effect, caching]
related: [react/fetch-in-effect-race, react/use-hook, state/server-vs-client-state, nextjs/fetching-in-server-components]
---

## Question
Compare fetching data in `useEffect`, with a client-side library like TanStack Query, and in Server Components. Which would you choose for a dashboard, and why?

## Interview Answer
Fetching in `useEffect` is the lowest level: it runs only after render in the browser, so it creates request waterfalls, has no caching or deduplication, and you have to hand-write loading, error, cancellation and race handling. A query library such as TanStack Query keeps server state in a cache keyed by query key, giving deduplication, stale-while-revalidate, retries, background refetch, pagination and mutation invalidation, and it's the right tool for highly interactive client data. Server Components fetch on the server before sending HTML, avoiding client waterfalls, keeping secrets and heavy dependencies off the client, and shrinking bundles, but they're not meant for data that changes with client interactions in real time. For a dashboard I'd fetch initial data in Server Components, stream slow sections with Suspense, and use TanStack Query in interactive client parts such as filters, polling and mutations, optionally hydrating the cache from the server.

## Explanation
### Comparison

| | `useEffect` + state | TanStack Query (client) | Server Components |
|---|---|---|---|
| Runs | browser, after render | browser | server, during render |
| Caching / dedupe | none | built in | request memoisation + framework cache |
| Race conditions | manual | handled | not applicable |
| Loading UI | manual flags | `isPending`, `isFetching` | Suspense / `loading.tsx` |
| Refetch / polling | manual | built in | refresh/revalidate |
| Mutations | manual | `useMutation` + invalidation | Server Actions + revalidation |
| First paint with data | after JS + fetch | after JS + fetch (or hydrated) | in initial HTML |
| Bundle impact | small | +library | none |
| Secrets / DB access | no | no | yes |
| SEO | poor unless SSR | poor unless SSR | good |

### Network waterfalls

```txt
useEffect:  HTML -> JS -> render -> fetch user -> render -> fetch posts (child) -> render
RSC:        request -> server fetches user & posts in parallel -> HTML streamed
```

Parent-child fetches in client components serialise because the child doesn't mount until the parent finishes. On the server you can start independent fetches together with `Promise.all`.

### A hybrid dashboard

```tsx
// Server Component: first load
export default async function Dashboard() {
  const [summary, orders] = await Promise.all([getSummary(), getOrders()]);
  return (
    <>
      <Summary data={summary} />
      <Suspense fallback={<ChartSkeleton />}><RevenueChart /></Suspense>
      <OrdersTable initialData={orders} />      {/* client component with TanStack Query */}
    </>
  );
}
```

```tsx
"use client";
function OrdersTable({ initialData }: { initialData: Order[] }) {
  const [status, setStatus] = useState("all");
  const { data } = useQuery({
    queryKey: ["orders", status],
    queryFn: ({ signal }) => fetchOrders(status, signal),
    initialData: status === "all" ? initialData : undefined,
    refetchInterval: 30_000,
  });
  // …
}
```

### Rules of thumb
- Server state belongs in a cache layer, never in plain `useState` copies.
- Fetch as high as possible in the tree, in parallel, and as early as possible.
- Use the URL for filters so they survive reloads and work with server rendering.
- Reach for `useEffect` fetching only for one-off, simple cases or learning.
- Use `use()` + Suspense to stream a promise started on the server into a client component.

### Choosing quickly
- Mostly static or per-request data, SEO needed → Server Components.
- Interactive, frequently changing, user-driven data → TanStack Query.
- Simple prototype → effect, with abort handling.

## Follow-ups
- **What about SWR or Apollo?** — Same category as TanStack Query (client caches); choose by API style (REST vs GraphQL) and team preference.
- **How do you share server-fetched data with the client cache?** — Hydrate the QueryClient (`HydrationBoundary`) or pass `initialData`.

## Common Mistakes
- Copying query results into `useState`.
- Fetching in child components in series.
- Using client fetching for data that could be rendered on the server.

## Tips
- Use the word "waterfall" and propose a hybrid; it's the senior answer.
