---
title: "How do you cancel an in-flight request or async operation?"
level: hard
type: concept
tags: [abortcontroller, fetch, cancellation, race-conditions, timeout]
related: [javascript/promise-combinators, javascript/unhandled-rejections, react/use-effect-cleanup]
---

## Question
Promises cannot be cancelled. How do you cancel a `fetch`, add a timeout, or ignore stale responses (for example, a search box where an old response arrives after a newer one)?

## Clues
- The standard web API for this is an object with a `signal` property.
- A cancelled fetch rejects with a specific error type you can recognise.
- For things that cannot be aborted, think about ignoring results instead.

## Interview Answer
I use `AbortController`. I create a controller, pass `controller.signal` to `fetch`, and call `controller.abort()` to cancel; the fetch promise rejects with an `AbortError`, which I treat as expected rather than a real failure. For timeouts there is `AbortSignal.timeout(ms)`, and `AbortSignal.any([...])` combines signals. For a search box I abort the previous request before starting the next, so out-of-order responses cannot overwrite newer data; in React I do this in the effect cleanup. When an API has no cancellation, I guard with a request id or a flag and ignore stale results — the work still happens, but state is not updated.

## Explanation
### Cancelling fetch

```js
const controller = new AbortController();

fetch("/api/search?q=react", { signal: controller.signal })
  .then((r) => r.json())
  .then(render)
  .catch((e) => {
    if (e.name === "AbortError") return; // expected
    throw e;
  });

controller.abort(); // cancels the request
```

### Timeouts

```js
const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
// rejects with TimeoutError after 5s

const user = new AbortController();
const signal = AbortSignal.any([user.signal, AbortSignal.timeout(5000)]);
```

### Latest-wins search

```js
let controller;
async function search(q) {
  controller?.abort();
  controller = new AbortController();
  try {
    const res = await fetch(`/api?q=${q}`, { signal: controller.signal });
    show(await res.json());
  } catch (e) {
    if (e.name !== "AbortError") throw e;
  }
}
```

### In React

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(`/api/items/${id}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setItem)
    .catch((e) => e.name !== "AbortError" && setError(e));
  return () => controller.abort();
}, [id]);
```

### Making your own function abortable
Accept a `signal`, check `signal.aborted`, listen to `abort`, and call `signal.throwIfAborted()`.

```js
function sleep(ms, { signal } = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    }, { once: true });
  });
}
```

### When you cannot abort
Use a counter: `const id = ++latest; ... if (id !== latest) return;`.

## Follow-ups
- **Is aborting fetch a guarantee the server stops?** — No; the client drops the connection, the server may still process the request.
- **Why does `Promise.race` with a timer not cancel?** — It only stops waiting.

## Common Mistakes
- Treating `AbortError` as a failure and showing an error toast.
- Reusing one aborted controller for a new request.

## Tips
- Mention `AbortSignal.timeout`, `AbortSignal.any` and the React cleanup pattern.
