---
title: "Write useDebounce and useDebouncedCallback"
level: medium
type: implement
tags: [custom-hooks, debounce, useEffect, useRef, search]
related: [javascript/debounce, react/use-deferred-value, react/stale-closures-in-effects]
---

## Question
Write two hooks: `useDebounce(value, delay)` that returns a value updated only after `delay` ms without changes, and `useDebouncedCallback(fn, delay)` that returns a debounced function with a stable identity that always calls the latest `fn`. Use them in a search box.

## Interview Answer
`useDebounce` keeps the debounced value in state and, in an effect keyed on `value` and `delay`, starts a timer to copy the value; the cleanup clears the timer, so each change within the delay cancels the previous one. `useDebouncedCallback` stores the latest `fn` in a ref, keeps the timer id in another ref, and returns a function created once with `useMemo` or `useCallback` that clears the timer and schedules a new call. The cleanup on unmount clears any pending timer so it never fires on an unmounted component. In a search box, I debounce the query value and use it as the key of a fetch or query, ideally cancelling in-flight requests.

## Explanation
### `useDebounce`

```tsx
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);          // new change cancels the previous timer
  }, [value, delay]);

  return debounced;
}
```

### `useDebouncedCallback`

```tsx
import { useCallback, useEffect, useRef } from "react";

export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay = 300
) {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { fnRef.current = fn; });          // latest fn without changing identity

  const debounced = useCallback((...args: A) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);

  useEffect(() => () => clearTimeout(timerRef.current), []);   // cancel on unmount

  return debounced;
}
```

### Use in a search box

```tsx
function Search() {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const [results, setResults] = useState<Item[]>([]);

  useEffect(() => {
    if (!debounced) return setResults([]);
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setResults)
      .catch((e) => e.name !== "AbortError" && console.error(e));
    return () => controller.abort();       // ignore stale responses
  }, [debounced]);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>{results.map((r) => <li key={r.id}>{r.name}</li>)}</ul>
    </>
  );
}
```

The input stays controlled by the undebounced `query`; only the fetch key is debounced.

### Which one to use?
- Debounce a *value* when other code reacts to it (effects, query keys).
- Debounce a *callback* when you handle an event directly (autosave on change, resize handler).

### Pitfalls
- Creating a debounced function inline in the component body gives a new timer closure each render, so debouncing never works. Keep timer state in a ref.
- Include `delay` in dependencies.
- Debounce delays the first response by `delay`; consider `leading` options or a loading indicator.
- For React rendering cost rather than network cost, `useDeferredValue` may fit better.

## Follow-ups
- **Debounce vs throttle?** — Debounce waits for quiet; throttle limits frequency during continuous activity.
- **How do you flush on blur or submit?** — Expose a `flush`/`cancel` method on the returned function.

## Common Mistakes
- Debouncing the controlled input's `onChange` itself, which makes typing lag.
- Not clearing timers on unmount.
- Recreating `debounce(fn)` every render.

## Tips
- Show the AbortController alongside it; debounce alone does not prevent out-of-order responses.
