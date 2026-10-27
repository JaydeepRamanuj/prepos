---
title: "What is memoization? Implement memoize with a custom cache key"
level: hard
type: implement
tags: [functions, memoization, caching, closures, map]
related: [javascript/pure-functions-side-effects, javascript/closure, react/use-memo-use-callback]
---

## Question
Explain memoization, then implement `memoize(fn, resolver?)`:

- It caches results by arguments, so repeated calls with the same arguments return the cached value without calling `fn`.
- By default the cache key is the first argument. An optional `resolver(...args)` returns a custom key.
- It exposes the cache (`memoized.cache`) so it can be cleared.
- It preserves `this`.

```js
const slowSquare = (n) => { console.log("computing"); return n * n; };
const fastSquare = memoize(slowSquare);
fastSquare(4); // logs "computing", returns 16
fastSquare(4); // returns 16, no log
```

## Clues
- The cache has to survive between calls but stay private. What keeps state alive per returned function?
- A `Map` can use any value as a key, including objects, but `[1, 2]` and `[1, 2]` are different keys. How do you turn several arguments into one key?
- Check `cache.has(key)`, not `cache.get(key)`, because a cached `undefined` or `0` must still count as a hit.

## Interview Answer
Memoization caches a function's results keyed by its inputs, so repeat calls skip the work. It is only safe for pure functions, because the cache assumes the same inputs always give the same output. I return a wrapper that closes over a `Map`. On each call I compute a key: the first argument by default, or whatever a `resolver` returns, such as `JSON.stringify(args)` or `args.join("|")` for primitive arguments. If the map has the key I return the stored value, and otherwise I call `fn.apply(this, args)`, store the result and return it. I expose the cache for clearing, and I'd mention the trade-off: memory grows without limit unless you add an LRU limit or use a `WeakMap` for object keys.

## Explanation
### Implementation

```js
function memoize(fn, resolver) {
  if (typeof fn !== "function") throw new TypeError("Expected a function");

  function memoized(...args) {
    // the key decides what counts as "the same call"
    const key = resolver ? resolver.apply(this, args) : args[0];
    const cache = memoized.cache;

    if (cache.has(key)) return cache.get(key); // has(), so undefined/0/false results count as hits

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  }

  memoized.cache = new Map(); // public so callers can call .clear() or .delete(key)
  return memoized;
}
```

Usage with multiple arguments:

```js
const area = memoize(
  (w, h) => w * h,
  (w, h) => `${w}x${h}`, // custom key built from both args
);
area(2, 3); // computed
area(2, 3); // cached
```

### Why the default key is only the first argument
That is what Lodash's `_.memoize` does. It is cheap and correct for single-argument functions. A common bug with this default is calling `memoize(add)` on `add(a, b)`: `add(1, 2)` and `add(1, 5)` share the key `1`, so the second call returns 3. Either pass a resolver, or build a key from all arguments.

### Choosing a key strategy

| Strategy | Works for | Pitfall |
|---|---|---|
| `args[0]` | single argument | ignores the other arguments |
| `args.join("|")` | primitives | `"1|2"` collides if values contain `|`, and objects become `[object Object]` |
| `JSON.stringify(args)` | plain data | slow for big objects, key order matters, drops functions/`undefined` |
| Nested `Map`/`WeakMap` per argument | object identity | more code, but exact and supports GC with `WeakMap` |

### Memoizing async functions
Cache the **promise**, not the resolved value. Concurrent callers then share one in-flight request. Delete the entry on rejection so failures are not cached forever:

```js
function memoizeAsync(fn, resolver = (...a) => JSON.stringify(a)) {
  const cache = new Map();
  return function (...args) {
    const key = resolver(...args);
    if (cache.has(key)) return cache.get(key);
    const promise = Promise.resolve(fn.apply(this, args)).catch((err) => {
      cache.delete(key); // allow a retry next time
      throw err;
    });
    cache.set(key, promise);
    return promise;
  };
}
```

### Recursive memoization (classic follow-up)

```js
const fib = memoize((n) => (n < 2 ? n : fib(n - 1) + fib(n - 2)));
fib(50); // fast: each n is computed once, O(n) instead of O(2^n)
```

This works because the recursive calls go through the memoized `fib` binding, not the raw inner function.

### Memory and complexity
Lookup is O(1) plus the cost of computing the key. The cache grows forever. For long-lived apps, bound it with an LRU cache (a `Map` keeps insertion order, so you can delete the oldest key via `cache.keys().next().value`) or a TTL.

## Follow-ups
- **How does this relate to `useMemo` and `React.memo`?** — `useMemo` caches only the *last* result per component instance, keyed by its dependency array compared with `Object.is`. It is a single-slot cache, not a map of all past inputs.
- **When is memoization a bad idea?** — For cheap functions (the key computation costs more than the work), impure functions, or inputs that are almost never repeated, where the cache only leaks memory.
- **How would you add an LRU limit?** — On a hit, delete and re-set the key to mark it most recent. On insert, if `cache.size > max`, delete `cache.keys().next().value`.

## Common Mistakes
- Using `if (cache.get(key))`, which recomputes when the cached result is falsy.
- Defaulting to `JSON.stringify` for everything, which is slow and breaks on circular structures.
- Memoizing impure functions (reading time or random values), which returns stale results.
- Caching rejected promises forever in an async memoize.

## Tips
- Say "memoization trades memory for time and only works for pure functions" in the first sentence, then write the 10-line version. Mention the `has` vs `get` detail without being asked. Interviewers notice it.
