---
title: "Why TanStack Query? What problems does it solve over useEffect + useState?"
level: easy
type: concept
tags: [tanstack-query, server-state, caching, deduplication, stale-while-revalidate]
related: [state/server-vs-client-state, state/tanstack-query-basics, react/data-fetching-approaches]
---

## Question
What is TanStack Query (React Query) and what problems does it solve compared with fetching in `useEffect` and storing results in `useState`?

## Interview Answer
TanStack Query manages server state: data that lives on a server, is async, shared and can become stale. With `useEffect` + `useState` I have to hand-write loading and error states, race condition handling, caching, deduplication of identical requests, refetching on focus or reconnect, retries, pagination, and updating the UI after mutations. TanStack Query provides these through a cache keyed by query keys: `useQuery` returns data and status, shares one in-flight request between components, serves cached data instantly while revalidating in the background (stale-while-revalidate), retries failures with backoff, garbage-collects unused cache entries, and offers mutations with invalidation and optimistic updates. It separates server state from client state, so I keep UI state in `useState` or Zustand and server data in the query cache.

## Explanation
### Without it

```tsx
function Users() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const c = new AbortController();
    fetch("/api/users", { signal: c.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setUsers)
      .catch((e) => e.name !== "AbortError" && setError(e))
      .finally(() => setLoading(false));
    return () => c.abort();
  }, []);
  // …no caching, every mount refetches, no dedupe, no refetch on focus, no retry, no shared state
}
```

### With it

```tsx
import { useQuery } from "@tanstack/react-query";

function Users() {
  const { data, isPending, error } = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => fetch("/api/users", { signal }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<User[]>;
    }),
  });

  if (isPending) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserList users={data} />;
}
```

### What you get

| Concern | Hand-rolled | TanStack Query |
|---|---|---|
| Loading/error state | manual | `status`, `isPending`, `isFetching`, `error` |
| Caching | none | keyed cache, `staleTime`, `gcTime` |
| Dedupe | none | one request per key at a time |
| Background refresh | manual | refetch on mount, window focus, reconnect, interval |
| Race conditions | manual abort/ignore | handled; `signal` supplied to `queryFn` |
| Retry | manual | default 3 retries with exponential backoff |
| Pagination / infinite | manual | `placeholderData: keepPreviousData`, `useInfiniteQuery` |
| Mutations | manual | `useMutation`, invalidation, optimistic updates |
| Offline/pause | none | online manager, paused fetches |
| Devtools | none | React Query Devtools |
| SSR | custom | dehydrate/hydrate |

### Mental model
- **Query key** = identity of data; the same key is shared across components.
- **Stale vs fresh**: data is considered stale after `staleTime` (default 0), triggering refetch on certain events; cached data is shown immediately.
- **Inactive** queries (no observers) are garbage-collected after `gcTime` (default 5 minutes).
- The cache is the source of truth for server data; components subscribe.

### When you might not need it
- Server Components fetching data on the server for render-only content.
- Tiny apps with one or two requests.
- Data that's purely client-side.
- Alternatives: SWR (similar, simpler), RTK Query (Redux), Apollo (GraphQL), framework loaders (React Router, Remix).

### How it fits with Next.js
Fetch initial data in Server Components; use TanStack Query for interactive client data (filters, infinite scroll, polling, mutations) and hydrate the cache from the server when helpful.

## Follow-ups
- **Is TanStack Query a state manager?** — It manages server state; for client UI state use `useState`/Zustand.
- **What replaced `isLoading`?** — In v5, `isPending` means no data yet; `isLoading` is `isFetching && isPending`.

## Common Mistakes
- Copying query data into `useState`.
- Using it for purely client state.
- Fetching without a stable query key.

## Tips
- Name caching, dedupe, background revalidation and mutations as the four big wins.
