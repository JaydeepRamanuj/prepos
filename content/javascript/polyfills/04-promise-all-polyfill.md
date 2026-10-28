---
title: "Implement Promise.all, allSettled, race and any"
level: hard
type: implement
tags: [promise, promise-all, allSettled, race, any, polyfill]
related: [javascript/promise-combinators, javascript/promise-states-basics, javascript/sequential-vs-parallel-await]
---

## Question
Implement `promiseAll(iterable)` with the same semantics as `Promise.all`: results in input order, rejection on the first failure, non-promise values allowed, empty input resolves to `[]`. Then show how to adapt it for `allSettled`, `race` and `any`.

```js
promiseAll([1, Promise.resolve(2), delay(10, 3)]).then(console.log); // [1, 2, 3]
```

## Clues
- Wrap each item with `Promise.resolve` so plain values and thenables work.
- Store each result at its original index, not by completion order.
- Count completions to know when everything is done.

## Interview Answer
I return a new promise. I convert the input to an array, handle the empty case, then for each item call `Promise.resolve(item).then(...)` and store the value at its index while incrementing a counter; when the counter equals the length I resolve with the results array. Any rejection calls `reject` immediately, and further calls are harmless because a promise settles once. For `allSettled` I record `{ status, value | reason }` for both outcomes and never reject; `race` resolves or rejects with the first to settle; `any` resolves with the first fulfilment and rejects with an `AggregateError` only when all have rejected.

## Explanation
### `promiseAll`

```js
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let remaining = items.length;

    if (remaining === 0) return resolve(results);

    items.forEach((item, i) => {
      Promise.resolve(item).then(
        (value) => {
          results[i] = value;                  // keep input order
          if (--remaining === 0) resolve(results);
        },
        reject                                  // first rejection wins
      );
    });
  });
}
```

Using `results.push` would give completion order, a classic bug. Throwing inside the executor (for example, a non-iterable) rejects the promise automatically.

### `promiseAllSettled`

```js
function promiseAllSettled(iterable) {
  return new Promise((resolve) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve(results);

    items.forEach((item, i) => {
      const done = (r) => {
        results[i] = r;
        if (--remaining === 0) resolve(results);
      };
      Promise.resolve(item).then(
        (value) => done({ status: "fulfilled", value }),
        (reason) => done({ status: "rejected", reason })
      );
    });
  });
}
```

### `promiseRace`

```js
function promiseRace(iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) {
      Promise.resolve(item).then(resolve, reject);   // first settle wins
    }
  });
}
```

An empty iterable stays pending forever, matching the spec.

### `promiseAny`

```js
function promiseAny(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const errors = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return reject(new AggregateError([], "All promises were rejected"));

    items.forEach((item, i) => {
      Promise.resolve(item).then(resolve, (err) => {
        errors[i] = err;
        if (--remaining === 0) {
          reject(new AggregateError(errors, "All promises were rejected"));
        }
      });
    });
  });
}
```

### Edge cases
- Values and thenables: `Promise.resolve` normalises them.
- Sparse results: `new Array(n)` plus index assignment preserves order.
- Unhandled rejections: every input has a handler attached, so late rejections after `all` has already rejected do not become unhandled.
- No cancellation of other promises.

### Complexity
O(n) time and space.

## Follow-ups
- **How do you limit concurrency?** — Start N workers pulling items from an index, resolving a final promise when the queue is empty.
- **How would you add a timeout?** — Race against a rejecting timer and abort the work with `AbortController`.

## Common Mistakes
- Pushing results in completion order.
- Forgetting the empty-array case (the promise would hang).
- Not wrapping values in `Promise.resolve`.

## Tips
- Say "index, counter, first reject" and write the function top-down from that sentence.
