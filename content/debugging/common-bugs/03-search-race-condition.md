---
title: "Search results show the wrong query's data — find the race condition"
level: medium
type: debugging
tags: [race-condition, abortcontroller, useeffect, fetch]
related: [debugging/stale-closure-interval, scenarios/search-autocomplete-million-products, debugging/memory-leak-uncleared-subscription]
---

## Question
Users type "iphone" quickly and sometimes see results for "iph". Find the bug and fix it.

```tsx
function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    if (!query) return;
    fetch(`/api/search?q=${query}`)
      .then((res) => res.json())
      .then((data) => setResults(data.items));
  }, [query]);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ResultList items={results} />
    </>
  );
}
```

## Interview Answer
Each keystroke fires a request, and responses can arrive in any order. If the request for "iph" is slower than the one for "iphone", it resolves last and overwrites the correct results — the last response wins, not the last request. The fix is to make each effect run cancel or ignore its own request when the query changes: I create an `AbortController` in the effect, pass its `signal` to `fetch`, and call `abort()` in the cleanup, ignoring the resulting `AbortError`. I'd also debounce the input to cut the number of requests, and encode the query with `encodeURIComponent`. In a real app a data library like TanStack Query handles this by keying the cache on the query.

## Explanation
### The timeline

```txt
type "iph"    → request A ─────────────────────────▶ (slow, 900ms) setResults(A) ✗
type "iphone" → request B ───────▶ setResults(B) ✓
                                  ^ correct first, then overwritten by A
```

Debouncing alone does **not** fix this; it makes it rarer. Two requests 300 ms apart can still return out of order.

### Fix with AbortController

```tsx
useEffect(() => {
  if (!query) {
    setResults([]);
    return;
  }

  const controller = new AbortController();

  fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
    .then((res) => {
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      return res.json();
    })
    .then((data) => setResults(data.items))
    .catch((err) => {
      if (err.name === "AbortError") return; // expected: a newer query replaced this one
      setError(err);
    });

  return () => controller.abort(); // runs before the next effect and on unmount
}, [query]);
```

React runs the previous effect's cleanup before the next effect, so the moment `query` changes, the old request is aborted. Aborting also frees the network connection.

### Alternative: an "ignore" flag
If the async work cannot be aborted (an SDK call), ignore stale results:

```tsx
useEffect(() => {
  let ignore = false;
  searchSdk(query).then((items) => {
    if (!ignore) setResults(items);
  });
  return () => {
    ignore = true;
  };
}, [query]);
```

### Production version
Add a debounce so you don't fire a request per keystroke, and let a cache handle ordering:

```tsx
const debouncedQuery = useDebounce(query, 250);

const { data } = useQuery({
  queryKey: ["search", debouncedQuery],
  queryFn: ({ signal }) =>
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, { signal }).then((r) => r.json()),
  enabled: debouncedQuery.length > 0,
});
```

Because the result is stored per query key, a late response for "iph" lands in the "iph" cache entry and never shows while the key is "iphone". TanStack Query passes an `AbortSignal` into `queryFn` so the request can be cancelled too.

### How to reproduce it
In DevTools, throttle to Slow 4G, or make the API delay short queries longer. Races hide on fast local networks — that is why it "works on my machine".

## Follow-ups
- **Where else does this race appear?** — Any effect fetching by a changing key: route params, tabs, pagination, a selected user.
- **How do you handle it with Server Components?** — Navigation-driven data is fetched per route segment by the framework; for client search you still need cancellation or a keyed cache.
- **Should the server help?** — It can echo the query in the response so the client can discard mismatches, but client-side cancellation is still the main fix.

## Common Mistakes
- Thinking debounce fixes the race.
- Treating `AbortError` as a real failure and showing an error toast.
- Forgetting to clear results when the query is emptied.
- Building the URL without `encodeURIComponent`, which breaks on `&` or `#`.

## Tips
- Say "last response wins, not last request" — it names the bug precisely.
- Mention both fixes (abort and ignore flag) and when each applies.
