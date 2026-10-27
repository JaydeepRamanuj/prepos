---
title: "What is a Promise, and what are its states?"
level: easy
type: concept
tags: [promises, async, states, executor]
related: [javascript/callbacks-callback-hell, javascript/promise-chaining-error-handling, javascript/promise-combinators]
---

## Question
What is a Promise? Describe its states, how you create one, and what guarantees it gives you compared to plain callbacks.

## Interview Answer
A Promise is an object representing the eventual result of an asynchronous operation. It starts `pending` and settles exactly once, either `fulfilled` with a value or `rejected` with a reason; after that it never changes. You create one with `new Promise((resolve, reject) => {...})`, where the executor runs synchronously, and you consume it with `.then`, `.catch` and `.finally`. Handlers always run asynchronously as microtasks, even if the promise is already settled, and each `.then` returns a new promise, which is what enables chaining. Compared with callbacks, I get single settlement, consistent timing, and error propagation.

## Explanation
### States

```txt
            resolve(value)
pending ───────────────────────> fulfilled
   │
   └──── reject(reason) / throw ─> rejected
```

"Settled" means fulfilled or rejected. "Resolved" is a looser word: a promise can be resolved to another promise and still be pending.

### Creating and consuming

```js
const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

wait(100).then(() => console.log("done"));
```

The executor runs immediately and synchronously:

```js
console.log(1);
new Promise((resolve) => { console.log(2); resolve(); });
console.log(3);
// 1, 2, 3
```

### Guarantees
- Settles once; later `resolve`/`reject` calls are ignored.
- `.then` callbacks are never called synchronously.
- A throw inside the executor or a handler becomes a rejection.
- Handlers attached after settlement still run.

### Shortcuts

```js
Promise.resolve(42);
Promise.reject(new Error("nope"));
```

### `.then(onFulfilled, onRejected)` vs `.catch`
`.catch(fn)` is `.then(undefined, fn)`. The two-argument form does not catch errors thrown by its own `onFulfilled`; a following `.catch` does.

## Follow-ups
- **Can you cancel a promise?** — Not natively. Use `AbortController` to cancel the underlying work.
- **Does `new Promise` run its executor lazily?** — No, immediately.

## Common Mistakes
- Wrapping an existing promise in `new Promise` (the "explicit construction" anti-pattern).
- Forgetting to `return` a promise inside `.then`, breaking the chain.

## Tips
- Remember: executor sync, handlers async.
