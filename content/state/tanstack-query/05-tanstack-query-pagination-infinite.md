---
title: "Pagination and infinite scroll with TanStack Query: keepPreviousData and useInfiniteQuery"
level: medium
type: implement
tags: [tanstack-query, pagination, infinite-query, placeholderData, getNextPageParam, intersection-observer]
related: [state/tanstack-query-basics, performance/list-virtualization, react/debounced-search-component]
---

## Question
Implement (1) page-numbered pagination that doesn't flash a spinner between pages and (2) infinite scrolling that loads more when a sentinel enters the viewport, using TanStack Query v5.

## Interview Answer
For numbered pages I include the page in the query key and set `placeholderData: keepPreviousData`, so while the next page loads the previous page's data stays on screen with `isPlaceholderData` true, avoiding a loading flash; I can prefetch the next page for instant navigation. For infinite scroll I use `useInfiniteQuery` with `initialPageParam` (required in v5) and `getNextPageParam` returning the cursor or `undefined` when finished; the data arrives as `{ pages, pageParams }` that I flatten for rendering, and I trigger `fetchNextPage` when a sentinel element intersects the viewport using `IntersectionObserver` (guarding with `hasNextPage` and `isFetchingNextPage`). For large lists I combine it with virtualisation, and I keep cursor-based APIs where possible since offsets drift when data changes.

## Explanation
### 1. Numbered pagination

```tsx
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

function Projects() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isPending, isFetching, isPlaceholderData, error } = useQuery({
    queryKey: ["projects", { page }],
    queryFn: ({ signal }) => fetchProjects({ page, signal }),      // { items, hasMore }
    placeholderData: keepPreviousData,                              // show last page while loading the next
    staleTime: 30_000,
  });

  // Prefetch the next page for instant navigation
  useEffect(() => {
    if (!isPlaceholderData && data?.hasMore) {
      queryClient.prefetchQuery({
        queryKey: ["projects", { page: page + 1 }],
        queryFn: ({ signal }) => fetchProjects({ page: page + 1, signal }),
      });
    }
  }, [data, isPlaceholderData, page, queryClient]);

  if (isPending) return <Skeleton />;
  if (error) return <ErrorState />;

  return (
    <>
      <ul style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
        {data.items.map((p) => <li key={p.id}>{p.name}</li>)}
      </ul>
      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
      <button onClick={() => setPage((p) => p + 1)} disabled={isPlaceholderData || !data.hasMore}>Next</button>
      {isFetching && <span aria-live="polite">Updating…</span>}
    </>
  );
}
```

Put the page in the URL (`?page=2`) for shareable, back-button-friendly navigation, and read it with `useSearchParams`.

### 2. Infinite scroll

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

type Page = { items: Post[]; nextCursor: string | null };

function Feed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, error } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam, signal }) => fetchFeed({ cursor: pageParam, signal }) as Promise<Page>,
    initialPageParam: null as string | null,                         // required in v5
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined, // undefined → no more pages
  });

  const posts = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  // Sentinel observed with IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { rootMargin: "400px" }                                         // start before the user reaches the end
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) return <Skeleton />;
  if (error) return <ErrorState />;

  return (
    <>
      <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
      <div ref={sentinelRef} aria-hidden />
      {isFetchingNextPage && <p role="status">Loading more…</p>}
      {!hasNextPage && <p>You're all caught up</p>}
      <button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage}>Load more</button>   {/* accessible fallback */}
    </>
  );
}
```

### Bidirectional and refetch behaviour
- `getPreviousPageParam` + `fetchPreviousPage` for chat-like lists.
- `maxPages` limits memory by dropping old pages (requires both next and previous param functions).
- When an infinite query refetches (stale), it refetches pages sequentially from the first; large lists can generate many requests, so set a generous `staleTime` or use `refetchPage`-style logic carefully.
- Mutating items: update inside `data.pages` immutably, or invalidate the query.

### Design guidance
- Prefer **cursor** pagination (stable under inserts/deletes) over offset.
- Provide a "Load more" button and keyboard access; infinite scroll alone harms accessibility and footer reachability.
- Preserve scroll position when navigating back (query cache plus scroll restoration, or virtualised list state).
- Combine with virtualisation when the list grows to thousands of rows.
- Debounce filters and include them in the query key so each filter set has its own cache.
- For SEO-critical lists use pagination with real URLs.

### Pitfalls
- Forgetting `initialPageParam` (v5 type error).
- Returning `null` instead of `undefined` from `getNextPageParam` (would be treated as a valid cursor).
- Re-creating the `IntersectionObserver` on every render without cleanup.
- Not guarding `fetchNextPage` calls (duplicate requests).
- Putting transient UI state (page) in the cache key incorrectly (e.g. including `isOpen`).

## Follow-ups
- **`useQuery` + `keepPreviousData` vs `useInfiniteQuery`?** — The former replaces the visible page; the latter accumulates pages.
- **How do you reset to the first page when filters change?** — Include the filters in the key; infinite queries start from `initialPageParam` for a new key.

## Common Mistakes
- Using `isLoading` for page transitions (flash).
- Flattening pages on every render without memoisation.

## Tips
- Mention cursor-based APIs and accessibility.
