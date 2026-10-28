---
title: "Compare Promise.all, allSettled, race and any. When do you use each?"
level: medium
type: concept
tags: [promises, promise-all, allSettled, race, any]
related: [javascript/promise-all-polyfill, javascript/sequential-vs-parallel-await, javascript/abort-controller-cancellation]
---

## Question
What do `Promise.all`, `Promise.allSettled`, `Promise.race` and `Promise.any` each do, how do they handle rejection, and when would you pick each?

## Interview Answer
`Promise.all` runs promises concurrently and fulfills with an array of results in input order, but rejects immediately with the first rejection — good when every result is required. `Promise.allSettled` never rejects; it waits for everything and returns `{status, value | reason}` objects — good when partial success is fine, like loading independent dashboard widgets. `Promise.race` settles as soon as the first promise settles, whether fulfilled or rejected, which suits timeouts. `Promise.any` fulfills with the first fulfillment and only rejects, with an `AggregateError`, if all reject — good for redundant sources, like mirrored endpoints. None of them cancels the losing promises.

## Explanation
### Summary

| Method | Fulfills when | Rejects when | Result |
|---|---|---|---|
| `all` | all fulfill | any rejects (first one) | array of values, input order |
| `allSettled` | all settle | never | array of `{status, value/reason}` |
| `race` | first settles with fulfill | first settles with reject | that single outcome |
| `any` | first fulfills | all reject → `AggregateError` | first value |

### Examples

```js
const [user, posts] = await Promise.all([getUser(), getPosts()]);

const results = await Promise.allSettled([a(), b(), c()]);
const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);

const withTimeout = (p, ms) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);

const fastest = await Promise.any([fetch(mirror1), fetch(mirror2)]);
```

### Details
- Inputs can be any iterable of values; non-promises are treated as already fulfilled.
- `all([])` fulfills with `[]`; `race([])` stays pending forever; `any([])` rejects.
- After `all` rejects, the other promises keep running and their later rejections are handled (no unhandled warning), but their work is not cancelled. Combine with `AbortController` to cancel.
- Order of `all` results matches input order, not completion order.

### Choosing
- Need everything or nothing → `all`.
- Need a report per item → `allSettled`.
- Need a timeout → `race`.
- Need the first success → `any`.

## Follow-ups
- **How would you limit concurrency?** — Run a pool of N workers pulling from a queue; `all` alone starts everything at once.
- **Is `race` with a timer a real timeout?** — The request continues unless you abort it.

## Common Mistakes
- Using `all` where one failure should not discard others.
- Confusing `race` (first to settle) with `any` (first to fulfill).

## Tips
- Remember the table; mention `AggregateError` and the empty-array behaviours for bonus depth.
