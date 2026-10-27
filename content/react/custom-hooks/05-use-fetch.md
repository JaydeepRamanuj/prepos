---
title: "Write a useFetch hook that handles loading, errors and race conditions"
level: hard
type: implement
tags: [custom-hooks, fetch, abort, race-conditions, state-machine]
related: [react/fetch-in-effect-race, javascript/abort-controller-cancellation, react/you-might-not-need-an-effect]
---

## Question
Write `useFetch<T>(url)` returning `{ data, error, status, refetch }`. It must not show stale data from a previous URL, must cancel in-flight requests when the URL changes or the component unmounts, treat HTTP errors as errors, and expose a way to refetch.

```tsx
const { data, error, status, refetch } = useFetch<User>(`/api/users/${id}`);
```

## Clues
- Model status explicitly (`loading | success | error`) rather than separate booleans.
- `fetch` doesn't reject on HTTP 404/500; check `response.ok`.
- Use an `AbortController` per effect run and ignore `AbortError`.

## Interview Answer
I model the state as a discriminated union with `status`, `data` and `error`, keep it in `useState`, and run the request in an effect keyed on the URL and a `reloadKey` counter that `refetch` increments. Each effect run creates an `AbortController`, passes its signal to `fetch`, and returns `controller.abort()` as cleanup, so changing the URL or unmounting cancels the old request and a late response can't overwrite newer data. I check `res.ok` and throw for HTTP errors, ignore `AbortError`, and reset to `loading` when the URL changes. In production I would use TanStack Query or framework data loading instead, because they add caching, deduplication, retries and revalidation.

## Explanation
### Implementation

```tsx
import { useCallback, useEffect, useState } from "react";

type State<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "success"; data: T; error: undefined }
  | { status: "error"; data: undefined; error: Error };

export function useFetch<T>(url: string | null) {
  const [state, setState] = useState<State<T>>({ status: "loading", data: undefined, error: undefined });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (url === null) return;                       // conditional fetching
    const controller = new AbortController();
    setState({ status: "loading", data: undefined, error: undefined });

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        setState({ status: "success", data, error: undefined });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;      // expected on cleanup
        setState({ status: "error", data: undefined, error: e as Error });
      }
    })();

    return () => controller.abort();                // URL changed / unmounted
  }, [url, reloadKey]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, refetch };
}
```

### Why each part exists
- **Status union**: prevents impossible states (`loading` and `error` at once) and works with TypeScript narrowing.
- **AbortController**: solves out-of-order responses; the aborted request's `catch` runs but is ignored.
- **`res.ok` check**: `fetch` only rejects on network failure.
- **Reset on URL change**: avoids showing user A's data under user B's id.
- **`reloadKey`**: a standard trick to re-run an effect without changing inputs.
- StrictMode runs the effect twice in development; the abort/cleanup makes it safe (two requests are made, the first is cancelled).

### Without AbortController (flag version)

```tsx
let ignore = false;
fetch(url).then((r) => r.json()).then((d) => { if (!ignore) setData(d); });
return () => { ignore = true; };
```

Prevents stale updates but does not cancel the network request.

### Limits of a hand-rolled hook
No caching (every mount refetches), no deduplication between components, no retry, no background refresh, no pagination. That's why teams use TanStack Query/SWR on the client or fetch in Server Components. Writing it is still the classic interview exercise because it tests effects, cleanup and races.

### Extensions
Generic `options` (headers, method), JSON parsing errors, `AbortSignal.timeout`, `initialData`, and `select`.

## Follow-ups
- **How would you prevent duplicate requests across components?** — A shared cache/promise map keyed by URL, which is what query libraries do.
- **Why not make `fetch` itself in `useState` initialiser?** — It would run during render, which must be pure.

## Common Mistakes
- Ignoring `res.ok`.
- Not resetting state when the URL changes.
- Treating `AbortError` as a failure.

## Tips
- Mention that in a real app you'd use a query library; interviewers like pragmatism.
