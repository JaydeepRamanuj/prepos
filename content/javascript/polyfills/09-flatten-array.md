---
title: "Implement Array.prototype.flat (with depth) and flatten an object"
level: medium
type: implement
tags: [flat, recursion, reduce, polyfill, iteration]
related: [javascript/array-reduce-polyfill, javascript/map-filter-reduce, javascript/deep-clone]
---

## Question
Implement `flatten(arr, depth = 1)` equivalent to `Array.prototype.flat`, supporting `Infinity` depth. Then write `flattenObject(obj)` that turns `{ a: { b: 1, c: [2, 3] } }` into `{ "a.b": 1, "a.c.0": 2, "a.c.1": 3 }`.

```js
flatten([1, [2, [3, [4]]]], 2);     // [1, 2, 3, [4]]
flatten([1, [2, [3, [4]]]], Infinity); // [1, 2, 3, 4]
```

## Clues
- Recursion with a decreasing depth counter.
- `Array.isArray` identifies nested arrays; holes are skipped by `flat`.
- For deep arrays an explicit stack avoids stack overflow.

## Interview Answer
The recursive version walks the array: if an element is an array and depth is greater than zero, I flatten it with depth minus one and spread the result into the output; otherwise I push the element. Holes are skipped to match the built-in. `Infinity` works naturally because `Infinity - 1` is still `Infinity`. For very deep nesting I use an iterative approach with a stack of iterators or pairs of element and depth. For the object variant I recurse with a path prefix and join keys with dots, treating arrays like objects keyed by index.

## Explanation
### Recursive `flatten`

```js
function flatten(arr, depth = 1) {
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (!(i in arr)) continue;                       // skip holes like Array.prototype.flat
    const item = arr[i];
    if (Array.isArray(item) && depth > 0) {
      result.push(...flatten(item, depth - 1));      // avoid spread for huge arrays; see below
    } else {
      result.push(item);
    }
  }
  return result;
}
```

`push(...bigArray)` can exceed the argument limit for huge arrays; use a loop for safety:

```js
for (const x of flatten(item, depth - 1)) result.push(x);
```

### `reduce` one-liner

```js
const flat = (arr, d = 1) =>
  d > 0
    ? arr.reduce((acc, x) => acc.concat(Array.isArray(x) ? flat(x, d - 1) : x), [])
    : arr.slice();
```

### Iterative (no recursion limit)

```js
function flattenIter(arr, depth = Infinity) {
  const out = [];
  const stack = arr.map((v) => [v, depth]).reverse();   // [value, remainingDepth]
  while (stack.length) {
    const [v, d] = stack.pop();
    if (Array.isArray(v) && d > 0) {
      for (let i = v.length - 1; i >= 0; i--) stack.push([v[i], d - 1]);
    } else {
      out.push(v);
    }
  }
  return out;
}
```

The reversed push keeps the original order.

### `flattenObject`

```js
function flattenObject(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const isContainer =
      value !== null && typeof value === "object" && !(value instanceof Date);
    if (isContainer && Object.keys(value).length > 0) {
      flattenObject(value, path, out);
    } else {
      out[path] = value;                              // primitives, Dates, empty objects/arrays
    }
  }
  return out;
}

flattenObject({ a: { b: 1, c: [2, 3] }, d: null });
// { "a.b": 1, "a.c.0": 2, "a.c.1": 3, d: null }
```

### Edge cases
- Cycles in the object version need a `WeakSet` of visited objects.
- Keys that already contain dots make the path ambiguous.
- Depth `0` returns a shallow copy.
- Native `flat` ignores non-array iterables, as does this.

### Complexity
O(total elements) time; recursion depth equals nesting depth.

## Follow-ups
- **Difference between `flat` and `flatMap`?** — `flatMap` maps then flattens one level.
- **How would you unflatten?** — Split keys on `.` and build nested objects, creating arrays for numeric segments.

## Common Mistakes
- Not decrementing `depth`.
- Using `concat` in a loop for large arrays, creating many temporary arrays.

## Tips
- Offer the recursive version first, then mention the iterative one for stack safety.
