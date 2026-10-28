---
title: "Build an infinite scroll feed with IntersectionObserver"
level: hard
type: implement
tags: [infinite-scroll, intersection-observer, pagination, loading-states, virtualization]
related: [machine-coding/autocomplete-typeahead, machine-coding/data-table, performance/list-virtualization]
---

## Question
Build a feed that loads the next page of items automatically as the user scrolls near the bottom.

**Must-haves**
- Load page 1 on mount, then the next page when a sentinel at the bottom becomes visible.
- Never fire two requests for the same page at once.
- Stop when there are no more pages; show loading, error-with-retry and end states.
- Clean up the observer on unmount.

**Stretch goals**
- Prefetch before the user reaches the bottom (`rootMargin`).
- Keep memory bounded with windowing for very long lists.
- Restore scroll position when coming back.

```tsx
<InfiniteList fetchPage={(cursor) => api.posts(cursor)} renderItem={(p) => <Post {...p} />} />
```

## Clues
- Do not listen to `scroll` events and compute offsets; observe a sentinel element instead.
- Guard against duplicate loads with a ref, because state updates are asynchronous.
- Use a cursor (or page number) returned by the API as the source of the next request.

## Interview Answer
I render the items followed by a sentinel `div`, and observe it with an `IntersectionObserver` whose `rootMargin` is about 300px so loading starts before the user hits the bottom. When the sentinel intersects and nothing is loading and `hasMore` is true, I fetch the next page using the stored cursor and append the results. A `loadingRef` guard prevents duplicate calls, since the observer can fire several times before state settles. Errors stop auto-loading and show a retry button, otherwise a failing request would loop forever. The observer is created in an effect and disconnected in cleanup. For huge lists I would add virtualization (TanStack Virtual) so the DOM stays small, and in a real app I would use `useInfiniteQuery`, which provides page state, cursors, dedupe and retries.

## Explanation
### Why IntersectionObserver
Scroll handlers fire constantly and force layout reads (`scrollHeight`, `getBoundingClientRect`). `IntersectionObserver` runs off the main thread's hot path and tells you only when visibility changes.

### Code

```tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Page<T> = { items: T[]; nextCursor: string | null };
type Props<T> = {
  fetchPage: (cursor: string | null) => Promise<Page<T>>;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
};

export function InfiniteList<T>({ fetchPage, renderItem, getKey }: Props<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const loadingRef = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const page = await fetchPage(cursor);
      setItems((prev) => {
        const seen = new Set(prev.map(getKey));
        return [...prev, ...page.items.filter((i) => !seen.has(getKey(i)))];  // dedupe
      });
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, hasMore, fetchPage, getKey]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || error) return;                          // an error pauses auto-loading
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, error]);

  return (
    <div>
      {items.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}
      {loading && <p role="status">Loading…</p>}
      {error && <button onClick={loadMore}>Couldn't load more. Retry</button>}
      {!hasMore && <p>You're all caught up.</p>}
      <div ref={sentinel} aria-hidden />
    </div>
  );
}
```

Because the effect depends on `loadMore`, the observer is recreated after each page and fires immediately if the sentinel is still visible (a short first page on a tall screen keeps loading until the viewport is filled).

### Cursor vs page number
Cursors survive inserts and deletes at the top of the feed (no duplicate or skipped rows); offset/page numbers drift. Dedupe by id anyway.

### Scaling up
- **Virtualization:** render only visible rows (TanStack Virtual / react-window) so thousands of items do not bloat the DOM.
- **Scroll restoration:** keep pages in a cache (TanStack Query) and restore `scrollTop` or use `history.scrollRestoration` with the cached data.
- **Accessibility:** infinite scroll hurts keyboard users who cannot reach the footer. Offer a "Load more" button as fallback and announce loading via `role="status"`.
- **Reset on filter change:** reset items, cursor and `hasMore`, and ignore responses from the previous filter (abort or compare a request id).

## Follow-ups
- **Infinite scroll or pagination?** — Infinite suits browsing feeds; pagination suits goal-oriented tasks, shareable positions and footers.
- **How would you load content above (chat history)?** — Observe a top sentinel, prepend, and preserve scroll position by adjusting `scrollTop` by the added height.

## Common Mistakes
- Using a state flag for the guard, which lags behind.
- No error stop, causing infinite retry loops.
- Appending without deduping, producing duplicate keys.

## Tips
- Mention `rootMargin`, the loading ref guard and virtualization unprompted.
