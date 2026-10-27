---
title: "Implement once(fn) and a closure-based counter generator"
level: medium
type: implement
tags: [closures, once, higher-order-functions, memoization]
related: [javascript/closure, javascript/higher-order-functions, javascript/memoization]
---

## Question
Write `once(fn)`, which returns a function that calls `fn` only on its first invocation and returns that first result on every later call. It should preserve `this` and arguments.

```js
const init = once(() => { console.log("init"); return 42; });
init();   // logs "init", returns 42
init();   // returns 42, no log
```

Then write `makeIdGenerator(prefix)` that returns a function producing `prefix-1`, `prefix-2`, … independently per generator.

## Interview Answer
`once` is a higher-order function that closes over two variables: a `called` flag and the cached `result`. The returned wrapper checks the flag, calls the original with `apply` to keep `this` and arguments only the first time, stores the result, and then always returns the stored value. For the ID generator, the counter lives in the closure of the factory so each generator has its own independent sequence. Both show that closures give per-instance private state without classes.

## Explanation
### `once`

```js
function once(fn) {
  let called = false;
  let result;

  return function (...args) {
    if (!called) {
      called = true;                   // set before calling: guards against re-entrancy
      result = fn.apply(this, args);
    }
    return result;
  };
}
```

### Edge cases
- If `fn` throws, `called` is already true, so later calls return `undefined`. Decide whether you want retry-on-failure:

```js
function onceSuccess(fn) {
  let called = false, result;
  return function (...args) {
    if (called) return result;
    result = fn.apply(this, args);   // if this throws, called stays false
    called = true;
    return result;
  };
}
```

- Async functions: the first returned promise is cached, so later calls share it, which is usually the desired behaviour for lazy initialisation.
- The returned function ignores arguments after the first call; that is what separates `once` from `memoize`.

### ID generator

```js
function makeIdGenerator(prefix = "id") {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

const a = makeIdGenerator("user");
const b = makeIdGenerator("order");
a(); a();   // "user-1", "user-2"
b();        // "order-1"
```

### Where used
Lazy singletons, one-time initialisation (analytics SDK init), `addEventListener(..., { once: true })` (built-in alternative), and React effects guarded against double invocation in Strict Mode (prefer proper cleanup instead).

### Complexity
O(1) per call.

## Follow-ups
- **How does this differ from memoize?** — Memoize caches per argument set; `once` caches a single result.
- **Lodash equivalent?** — `_.once`.

## Common Mistakes
- Using a global flag instead of a closure, so two `once` functions interfere.
- Losing `this` by using an arrow function wrapper.

## Tips
- Mention the throw/retry decision; it shows you think about failure cases.
