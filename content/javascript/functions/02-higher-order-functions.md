---
title: "What is a higher-order function? Give examples you use daily"
level: easy
type: concept
tags: [functions, higher-order-functions, callbacks, closures]
related: [javascript/closure, javascript/currying, javascript/compose-pipe]
---

## Question
What is a higher-order function? Give examples from the language and from your own code, and explain why they are useful.

## Interview Answer
A higher-order function is one that takes a function as an argument, returns a function, or both. That works because functions in JavaScript are first-class values that you can store, pass and return like any other value. `map`, `filter`, `reduce`, `setTimeout` and `addEventListener` take functions, and `debounce`, `memoize` and `bind` return them. I use them to separate *what varies* from *what stays the same*. The HOF owns the repeated mechanics, such as looping, timing or caching, and the caller passes only the specific behaviour. Returning functions also lets me create configured functions through closures, like `withLogging(fn)` or `createValidator(rules)`.

## Explanation
### Two shapes

```js
// 1. Takes a function
const prices = [100, 250, 40];
const withTax = prices.map((p) => p * 1.18);

// 2. Returns a function (a "function factory")
function multiplier(factor) {
  return (n) => n * factor; // closes over `factor`
}
const double = multiplier(2);
double(21); // 42
```

### Why they matter: abstracting the repeated part
Without a HOF, every loop repeats the same mechanics:

```js
const active = [];
for (let i = 0; i < users.length; i++) {
  if (users[i].active) active.push(users[i]);
}
```

With `filter`, the looping is written once in the language, and you supply only the decision:

```js
const active = users.filter((u) => u.active);
```

### Wrapping behaviour: a decorator-style HOF

```js
function withTiming(fn, label = fn.name) {
  return function (...args) {
    const start = performance.now();
    try {
      return fn.apply(this, args); // keep the caller's this and args
    } finally {
      console.log(`${label} took ${(performance.now() - start).toFixed(1)}ms`);
    }
  };
}

const slowSort = withTiming((arr) => [...arr].sort((a, b) => a - b), "sort");
slowSort([3, 1, 2]);
```

`debounce`, `throttle`, `memoize`, `once` and retry helpers all follow this pattern. They return a new function that adds behaviour around the original.

### Where you see them in React
- `array.map` to render lists.
- Event handler factories: `onClick={() => select(id)}`.
- Higher-order components (`withAuth(Component)`) are the same idea applied to components. Hooks have mostly replaced them, but you still meet them in older code and libraries.

## Follow-ups
- **What is a callback?** — A function passed into another function to be called later. Every callback is an argument to some HOF.
- **What is the relationship between HOFs and closures?** — Any HOF that returns a function usually depends on a closure to remember its configuration (the `factor`, the timer id, the cache).
- **Are HOFs slower?** — The extra call overhead is negligible in almost all UI code. Readability wins. Optimise hot loops only after profiling.

## Common Mistakes
- Defining a HOF as "a function that calls another function". Calling is not enough. The function has to take one as a value or return one.
- Writing `arr.map(parseInt)` and getting `[1, NaN, NaN]` for `["1","2","3"]`, because `map` passes `(value, index)` and `parseInt` reads the index as the radix.
- Losing `this` in wrapper HOFs by returning an arrow function or calling `fn(...args)` instead of `fn.apply(this, args)`.

## Tips
- Give one built-in example (`map`), one returning example (`debounce`) and one example from your own codebase. A concrete production example sounds far stronger than a definition.
