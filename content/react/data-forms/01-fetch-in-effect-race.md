---
title: "Fix the race condition in this fetch-in-useEffect search"
level: hard
type: debugging
tags: [race-conditions, useEffect, fetch, abort, data-fetching]
related: [javascript/abort-controller-cancellation, react/use-fetch, react/you-might-not-need-an-effect, react/use-effect-cleanup]
---

## Question
Users report that the results sometimes don't match what they typed. Explain why, and fix it in two ways.

```tsx
function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);

  useEffect(() => {
    fetch(`/api/search?q=${query}`)
      .then((r) => r.json())
      .then((data) => setResults(data));
  }, [query]);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <List items={results} />
    </>
  );
}
```

## Clues
- Network responses can arrive in a different order than requests were sent.
- Each effect run can return a cleanup that runs before the next one.
- There are two approaches: ignore stale results, or cancel the request.

## Interview Answer
It's a race condition: typing "re" then "rea" fires two requests, and if the first is slower, its response arrives last and overwrites the correct results, so the UI shows data for an old query. The effect needs to ignore or cancel responses from outdated runs. Fix one: use an `ignore` flag in the effect closure and set it to true in the cleanup, so a stale `.then` doesn't call `setResults`. Fix two: create an `AbortController`, pass its signal to `fetch`, and abort in the cleanup, which also frees the network, treating `AbortError` as expected. In real projects I'd use a data library (TanStack Query) or framework data fetching, which handle races, caching and loading states by design.

## Explanation
### Why it happens

```txt
type "re"  -> request A (slow, 800 ms)
type "rea" -> request B (fast, 200 ms)
B resolves -> results = B   (correct)
A resolves -> results = A   (stale, overwrites)
```

React doesn't care about request order; the last `setResults` call wins.

### Fix 1: ignore flag

```tsx
useEffect(() => {
  let ignore = false;
  fetch(`/api/search?q=${encodeURIComponent(query)}`)
    .then((r) => r.json())
    .then((data) => { if (!ignore) setResults(data); });
  return () => { ignore = true; };         // runs before the next effect and on unmount
}, [query]);
```

### Fix 2: AbortController

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setResults)
    .catch((err) => {
      if (err.name !== "AbortError") setError(err);
    });
  return () => controller.abort();
}, [query]);
```

The abort also stops downloading the body and, with HTTP/1.1, may free a connection slot.

### Other issues in the original
- No `encodeURIComponent` on the query.
- No `res.ok` check, so error responses are parsed as results.
- No loading or error state.
- Fires on every keystroke; add debounce or `useDeferredValue` on the query.
- Empty query shouldn't hit the API.

### Improved version

```tsx
const debounced = useDebounce(query, 300);
useEffect(() => {
  if (!debounced) { setResults([]); return; }
  const controller = new AbortController();
  setStatus("loading");
  fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((d) => { setResults(d); setStatus("idle"); })
    .catch((e) => { if (e.name !== "AbortError") setStatus("error"); });
  return () => controller.abort();
}, [debounced]);
```

### Better: don't fetch in an effect
- **TanStack Query:** `useQuery({ queryKey: ["search", debounced], queryFn: ({ signal }) => fetchJson(url, signal), enabled: !!debounced })` handles races, caching, retries and dedupes.
- **Server Components / `use`:** read the query from the URL and fetch on the server.
- React's own docs recommend this because effect-based fetching has no cache and always waterfalls.

### Strict Mode
In development the effect runs, cleans up, and runs again; with abort/ignore handling this is harmless, and it helps expose missing cleanup.

## Follow-ups
- **Does aborting guarantee the server stops working?** — No; the client just drops the request.
- **Is ordering guaranteed if requests are sent sequentially?** — Only if you wait for each response; usually unacceptable for search UX.

## Common Mistakes
- Fixing with `setTimeout` or a delay.
- Using a component-level `let`/`useRef` flag that isn't per effect run.
- Treating `AbortError` as a real error.

## Tips
- Show the sequence diagram, then both fixes, then say "or use a query library".
