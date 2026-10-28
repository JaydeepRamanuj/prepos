---
title: "TanStack Query v5: query keys, staleTime vs gcTime, status vs fetchStatus"
level: medium
type: concept
tags: [tanstack-query, query-keys, staleTime, gcTime, isPending, fetchStatus, v5]
related: [state/why-tanstack-query, state/tanstack-query-mutations-invalidation, state/tanstack-query-optimistic-updates]
---

## Question
Explain query keys, the difference between `staleTime` and `gcTime`, and the difference between `status` and `fetchStatus` in TanStack Query v5. What changed from v4 (`cacheTime`, `isLoading`, callbacks)?

## Interview Answer
A query key uniquely identifies cached data: an array like `["todos", { status: "done", page: 2 }]`, hashed deterministically, so any variable the `queryFn` depends on must be in the key. `staleTime` is how long fetched data is considered fresh (default 0): fresh data is served from cache without a refetch; stale data is still shown immediately but refetched on triggers like mount, window focus or reconnect. `gcTime` (called `cacheTime` in v4; default 5 minutes) is how long an inactive query (with no observers) stays in the cache before garbage collection, so remounting within that time shows cached data instantly. `status` describes data availability (`pending`, `error`, `success`), while `fetchStatus` describes network activity (`fetching`, `paused`, `idle`), so a query can be `success` and `fetching` (background refresh) or `pending` and `paused` (offline). v5 renamed `isLoading` semantics (`isPending` means no data; `isLoading` is `isFetching && isPending`), removed `onSuccess/onError/onSettled` callbacks from `useQuery`, and requires the single object signature.

## Explanation
### Query keys

```ts
useQuery({ queryKey: ["todos"], queryFn: fetchTodos });
useQuery({ queryKey: ["todos", { status, page }], queryFn: () => fetchTodos({ status, page }) });
useQuery({ queryKey: ["todo", id], queryFn: () => fetchTodo(id) });
```

- Keys are hashed with sorted object keys: `["todos", { a: 1, b: 2 }]` equals `["todos", { b: 2, a: 1 }]`; array order matters.
- Hierarchical keys enable targeted invalidation: `invalidateQueries({ queryKey: ["todos"] })` matches all keys starting with `"todos"`.
- Use a key factory for consistency:

```ts
export const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filters: Filters) => [...todoKeys.lists(), filters] as const,
  detail: (id: string) => [...todoKeys.all, "detail", id] as const,
};
```

- Prefer `queryOptions()` helper to colocate key + fn with type inference:

```ts
export const todoQuery = (id: string) =>
  queryOptions({ queryKey: todoKeys.detail(id), queryFn: ({ signal }) => fetchTodo(id, signal), staleTime: 30_000 });

useQuery(todoQuery(id));
queryClient.prefetchQuery(todoQuery(id));
```

### staleTime vs gcTime

```txt
fetch ──► fresh (0 … staleTime) ──► stale ──► (no observers) inactive ──► gcTime elapses ──► removed
```

| | `staleTime` | `gcTime` |
|---|---|---|
| Question answered | "do I need to refetch?" | "how long to keep unused data?" |
| Default | 0 | 5 minutes |
| Effect | controls refetch triggers | controls memory/instant remount |
| Infinity | never stale (manual invalidation) | never garbage collected |

Typical settings: `staleTime: 60_000` for rarely changing data (avoid refetch storms on focus), `staleTime: Infinity` for static reference data with manual invalidation, `gcTime` larger to enable instant back-navigation.

Refetch triggers for stale data: new observer mount (`refetchOnMount`), window focus (`refetchOnWindowFocus`), reconnect, interval (`refetchInterval`), manual `refetch`/invalidation.

### status vs fetchStatus (v5)

| `status` | meaning |
|---|---|
| `pending` | no data yet |
| `error` | the last fetch failed (no data or with stale data) |
| `success` | has data |

| `fetchStatus` | meaning |
|---|---|
| `fetching` | request in flight |
| `paused` | wants to fetch but offline |
| `idle` | not fetching |

Derived flags: `isPending`, `isError`, `isSuccess`, `isFetching`, `isLoading` (= `isFetching && isPending`, first load only), `isRefetching`, `isPlaceholderData`.

```tsx
const { data, isPending, isFetching, error } = useQuery(todoQuery(id));
if (isPending) return <Skeleton />;              // no data yet
if (error) return <Retry onRetry={refetch} />;
return <Todo todo={data} dimmed={isFetching} />; // background refresh indicator
```

### v5 changes worth knowing
- Single object argument: `useQuery({ queryKey, queryFn, … })`.
- `cacheTime` → `gcTime`; `keepPreviousData` → `placeholderData: keepPreviousData`.
- `isLoading` → `isPending` for "no data yet"; `isInitialLoading` removed.
- No `onSuccess`/`onError`/`onSettled` on `useQuery` (use effects, or global `QueryCache` callbacks, or derive from state); mutations still have callbacks.
- `useErrorBoundary` → `throwOnError`.
- `Hydrate` → `HydrationBoundary`.
- `suspense: true` replaced by dedicated hooks `useSuspenseQuery`, `useSuspenseInfiniteQuery`.
- `infiniteQuery` requires `initialPageParam`.
- Requires React 18+; `error` typed as `Error` by default.

### queryFn rules
- Must return a promise that resolves to data or throws (fetch does not throw on 404/500; check `response.ok`).
- Receives `{ queryKey, signal, meta, pageParam }`; pass `signal` to `fetch` for automatic cancellation.
- Never resolve `undefined` (disallowed in v5).
- Include all dependencies in the key, not closed over from props without being in the key.

### Defaults to remember
`retry: 3` (client), `retryDelay` exponential, `refetchOnWindowFocus: true`, `staleTime: 0`, `gcTime: 5 min`, `networkMode: "online"`.

## Follow-ups
- **Why does my query refetch on every focus?** — `staleTime` is 0 by default; raise it or disable `refetchOnWindowFocus` for that query.
- **Difference between `invalidateQueries` and `refetchQueries`?** — Invalidate marks queries stale and refetches active ones; refetch forces a fetch regardless of staleness.

## Common Mistakes
- Leaving variables out of the query key.
- Confusing `isPending` and `isFetching`.
- Using v4 callbacks.

## Tips
- Draw the fresh → stale → inactive → gc timeline.
