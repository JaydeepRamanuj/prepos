---
title: "Implement Array.prototype.map, filter and reduce"
level: medium
type: implement
tags: [map, filter, reduce, polyfill, arrays]
related: [javascript/map-filter-reduce, javascript/compose-pipe, javascript/higher-order-functions]
---

## Question
Implement `myMap`, `myFilter` and `myReduce` on `Array.prototype`. They must pass `(element, index, array)` to the callback, support `thisArg` for map/filter, skip holes in sparse arrays, and `reduce` must handle a missing initial value and throw on empty arrays without one.

```js
[1, 2, 3].myMap((x) => x * 2);          // [2, 4, 6]
[1, 2, 3, 4].myFilter((x) => x % 2);    // [1, 3]
[1, 2, 3].myReduce((a, b) => a + b);    // 6
```

## Interview Answer
Each method loops over indices of `this`, checks `i in this` to skip holes, calls the callback with the element, index and array, and builds a new result. `map` stores `callback.call(thisArg, ...)` at the same index; `filter` pushes the original element when the callback is truthy; `reduce` threads an accumulator, starting with the initial value or, if none is given, with the first existing element, and throws a `TypeError` if the array is empty. All of them validate that the callback is a function and none mutate the original array.

## Explanation
### `myMap`

```js
Array.prototype.myMap = function (callback, thisArg) {
  if (typeof callback !== "function") {
    throw new TypeError(`${callback} is not a function`);
  }
  const arr = this;
  const result = new Array(arr.length);       // preserves length (and holes)
  for (let i = 0; i < arr.length; i++) {
    if (i in arr) result[i] = callback.call(thisArg, arr[i], i, arr);
  }
  return result;
};
```

### `myFilter`

```js
Array.prototype.myFilter = function (callback, thisArg) {
  if (typeof callback !== "function") {
    throw new TypeError(`${callback} is not a function`);
  }
  const arr = this;
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    if (i in arr && callback.call(thisArg, arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }
  return result;
};
```

### `myReduce`

```js
Array.prototype.myReduce = function (callback, ...rest) {
  if (typeof callback !== "function") {
    throw new TypeError(`${callback} is not a function`);
  }
  const arr = this;
  let i = 0;
  let acc;

  if (rest.length > 0) {
    acc = rest[0];                               // initial value, even if undefined
  } else {
    while (i < arr.length && !(i in arr)) i++;   // first existing element
    if (i >= arr.length) {
      throw new TypeError("Reduce of empty array with no initial value");
    }
    acc = arr[i++];
  }

  for (; i < arr.length; i++) {
    if (i in arr) acc = callback(acc, arr[i], i, arr);
  }
  return acc;
};
```

Use `rest.length` (not `initial === undefined`) so an explicit `undefined` initial value is respected.

### Tests

```js
[1, , 3].myMap((x) => x * 2);                 // [2, <empty>, 6]
[].myReduce((a, b) => a + b, 0);              // 0
[].myReduce((a, b) => a + b);                 // TypeError
["a", "b"].myReduce((acc, c) => acc + c, ""); // "ab"
```

### Tricks to build on
- `reduce` can implement `map`, `filter`, `compose` and `pipe`.
- Adding enumerable properties to `Array.prototype` shows up in `for...in`; real polyfills use `Object.defineProperty` with `enumerable: false`.
- Do not modify built-ins in production code, only polyfill missing features.

### Complexity
O(n) time; `map` and `filter` use O(n) extra space, `reduce` O(1) beyond the accumulator.

## Follow-ups
- **Why `i in arr`?** — To skip holes like the native methods.
- **How would you implement `flatMap`?** — `map` then flatten one level.

## Common Mistakes
- Checking `initialValue === undefined` to detect "not provided".
- Forgetting `thisArg` and the index/array parameters.

## Tips
- Write `reduce` first and mention how the other two can be built from it.
