---
title: "map, filter, reduce: when to use each, and common reduce patterns"
level: medium
type: concept
tags: [map, filter, reduce, arrays, functional]
related: [javascript/higher-order-functions, javascript/array-reduce-polyfill, javascript/iteration-for-in-of-foreach]
---

## Question
What do `map`, `filter` and `reduce` return? How would you use `reduce` to group items or count occurrences, and what are its pitfalls compared with a simple loop?

## Interview Answer
`map` transforms each element and returns a new array of the same length; `filter` returns a new array with the elements whose callback is truthy; `reduce` folds an array into one value of any type by threading an accumulator through a callback. None of them mutate the source. `reduce` is the most general, so it can build objects, such as grouping by key or counting, but it is also easy to overuse: if the result is simply an array, `map`/`filter` are clearer. Always pass an initial value; without one, `reduce` uses the first element and throws on an empty array.

## Explanation
### Basics

```js
const nums = [1, 2, 3, 4];
nums.map((n) => n * 2);               // [2, 4, 6, 8]
nums.filter((n) => n % 2 === 0);      // [2, 4]
nums.reduce((sum, n) => sum + n, 0);  // 10
```

Callback signature: `(element, index, array)`. For `reduce`: `(acc, element, index, array)`.

### Patterns

```js
// Count occurrences
const count = words.reduce((acc, w) => {
  acc[w] = (acc[w] ?? 0) + 1;
  return acc;
}, {});

// Group by
const byRole = users.reduce((acc, u) => {
  (acc[u.role] ??= []).push(u);
  return acc;
}, {});
// Modern alternative: Object.groupBy(users, (u) => u.role)  // ES2024

// Flatten one level / pipeline
const flat = [[1], [2, 3]].reduce((a, b) => a.concat(b), []); // or .flat()
```

### Pitfalls

```js
["1", "2", "3"].map(parseInt);   // [1, NaN, NaN] — parseInt gets (value, index) as radix
["1", "2", "3"].map(Number);     // [1, 2, 3]

[].reduce((a, b) => a + b);      // TypeError: no initial value
[].reduce((a, b) => a + b, 0);   // 0
```

- `map` for side effects is wrong: use `forEach` or a loop.
- Chaining `filter().map()` iterates twice; negligible for small arrays, and `reduce`/loop or `flatMap` can do it in one pass.
- `reduce` with spread in the accumulator (`{...acc, [k]: v}`) is O(n²).
- Holes in sparse arrays are skipped.

### Related methods
`some`, `every`, `find`, `findLast`, `flatMap`, `includes`, `Object.groupBy`/`Map.groupBy` (ES2024; Node 21+, modern browsers).

### Choosing

| Goal | Method |
|---|---|
| transform each | `map` |
| subset | `filter` |
| one value / object | `reduce` |
| any/all match | `some` / `every` |
| first match | `find` |

## Follow-ups
- **Can `reduce` replace `map`?** — Yes, but it is less readable.
- **Does `map` return a new array if the callback returns undefined?** — Yes, filled with `undefined`.

## Common Mistakes
- `map(parseInt)`.
- Omitting the initial value.
- Mutating the accumulator in ways that surprise when it is reused across calls.

## Tips
- Know the `parseInt` trap; interviewers love it.
