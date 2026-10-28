---
title: "What are callbacks, and why did callback hell push JavaScript towards promises?"
level: easy
type: concept
tags: [callbacks, async, promises, inversion-of-control]
related: [javascript/promise-states-basics, javascript/promise-chaining-error-handling, javascript/higher-order-functions]
---

## Question
What is a callback in JavaScript? What is "callback hell", and what problems beyond ugly nesting did callbacks have that promises solved?

## Interview Answer
A callback is just a function passed to another function to be called later — either synchronously, like `arr.map(fn)`, or asynchronously when some work finishes, like `setTimeout` or a Node `fs.readFile`. Callback hell is what happens when several async steps depend on each other and you nest each one inside the previous, producing a pyramid that is hard to read and hard to error-handle. The deeper issues are inversion of control — you hand your continuation to code you do not control, which might call it twice, never, or too early — and error handling, because `try/catch` cannot catch an error thrown in a later tick. Promises fix this by returning a value you hold: it settles once, it is always async, and errors propagate down a chain to one `.catch`.

## Explanation
### Sync vs async callbacks

```js
[1, 2, 3].map((n) => n * 2);        // synchronous callback, runs immediately
setTimeout(() => console.log("later"), 100); // asynchronous callback
```

### The pyramid

```js
getUser(id, (err, user) => {
  if (err) return handle(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handle(err);
    getItems(orders[0].id, (err, items) => {
      if (err) return handle(err);
      render(items);
    });
  });
});
```

Each level repeats error handling, and sequencing, branching or looping over such steps gets worse quickly.

### The real problems

| Problem | Callback | Promise |
|---|---|---|
| Control | You pass your callback away and trust the callee | You receive an object and attach handlers yourself |
| Called twice / never | Possible bug in the callee | Settles exactly once |
| Sync vs async | Some APIs call back synchronously ("zalgo") | Handlers always run asynchronously |
| Errors | Manual `if (err)` at every level; `try/catch` cannot cross ticks | Rejections flow to the next `.catch` |
| Composition | Hand-rolled counters for "wait for all" | `Promise.all`, chaining |

### The Node convention
Node uses error-first callbacks: `(err, result) => {}`. `util.promisify` converts them:

```js
import { promisify } from "node:util";
import { readFile } from "node:fs";
const readFileAsync = promisify(readFile);
```

### Flattening without promises
Naming the functions and returning early reduces nesting, but does not fix inversion of control.

## Follow-ups
- **Are callbacks bad?** — No. Event handlers and array methods are callbacks. The problem is using them for sequential async flow.
- **Why can't try/catch catch an async callback's error?** — By the time the callback runs, the original call stack (and its `try` block) has already exited.

## Common Mistakes
- Saying callbacks are always asynchronous — `forEach`'s callback is synchronous.
- Reducing callback hell to "indentation" and missing inversion of control.

## Tips
- Name "inversion of control" and "zalgo" (inconsistent sync/async) — most candidates only mention nesting.
