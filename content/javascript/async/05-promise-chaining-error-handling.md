---
title: "How does promise chaining work, and how do errors propagate through a chain?"
level: medium
type: concept
tags: [promises, chaining, catch, finally, error-handling]
related: [javascript/promise-states-basics, javascript/unhandled-rejections, javascript/async-await-under-the-hood]
---

## Question
Explain how `.then` chaining works. What happens to a value returned from a handler, to a returned promise, and to a thrown error? Where do `.catch` and `.finally` fit?

## Interview Answer
Every `.then` returns a new promise. Whatever the handler returns becomes the next promise's value; if it returns a promise, the chain waits for it and adopts its result; if it throws, the next promise rejects. A rejection skips `.then` handlers that have no rejection callback and travels down until a `.catch`. After `.catch` returns normally, the chain is back in the fulfilled state, so recovery is possible. `.finally` runs either way, receives no argument, and passes through the original value or error unless it throws or returns a rejected promise. The classic mistake is forgetting to `return` the inner promise, which breaks ordering and error flow.

## Explanation
### Values, promises and throws

```js
Promise.resolve(1)
  .then((n) => n + 1)                       // 2
  .then((n) => new Promise((r) => setTimeout(() => r(n * 10), 50))) // waits, 20
  .then((n) => { throw new Error("boom " + n); })
  .then(() => console.log("skipped"))
  .catch((e) => { console.log(e.message); return "recovered"; }) // boom 20
  .then((v) => console.log(v))               // recovered
  .finally(() => console.log("cleanup"));
```

### Rules
- Return a plain value → next promise fulfills with it.
- Return a promise/thenable → next promise follows it.
- Return nothing → next value is `undefined`.
- Throw → next promise rejects.
- `.catch` that returns → chain recovers. `.catch` that rethrows → still rejected.

### Broken chain: missing return

```js
// Bug: second fetch not returned, so the outer chain does not wait for it
fetchUser()
  .then((u) => { fetchOrders(u.id); })
  .then(() => render());   // runs too early; orders errors are unhandled
```

Fix: `return fetchOrders(u.id)`.

### Nesting vs flattening
Prefer a flat chain. Nest only when the inner step needs variables from an outer scope; with async/await this is simpler.

### `.finally`

```js
loadData()
  .finally(() => setLoading(false))  // value/error passes through untouched
  .then(show, showError);
```

### Branching
Calling `.then` twice on the same promise creates two independent branches, each with its own error handling.

## Follow-ups
- **Does `.catch` placement matter?** — Yes: a `.catch` in the middle handles only earlier errors; put one at the end to cover everything.
- **`.then(a).catch(b)` vs `.then(a, b)`?** — The first also catches errors from `a`.

## Common Mistakes
- Not returning promises inside `.then`.
- Assuming a `.catch` in the middle stops the chain; it continues as fulfilled.
- Using `.then(success, failure)` and expecting `failure` to catch errors from `success`.

## Tips
- Say "each `.then` returns a new promise" first; the rest follows.
