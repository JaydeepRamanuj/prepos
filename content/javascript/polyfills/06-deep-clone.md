---
title: "Implement a deep clone that handles cycles, Dates, Maps and Sets"
level: hard
type: implement
tags: [deep-clone, recursion, WeakMap, cycles, polyfill]
related: [javascript/structured-clone, javascript/shallow-vs-deep-copy, javascript/map-set-weakmap-weakset]
---

## Question
Write `deepClone(value)` without using `structuredClone` or JSON. It should copy nested plain objects and arrays, `Date`, `RegExp`, `Map` and `Set`, keep circular references working, and preserve shared references (two properties pointing at the same object should still point at the same cloned object).

```js
const a = { d: new Date(), tags: new Set(["x"]), list: [1, { n: 2 }] };
a.self = a;
const b = deepClone(a);
b.self === b;   // true
b.list[1] !== a.list[1]; // true
```

## Clues
- A recursion without memory loops forever on cycles. What can remember "original → clone" pairs?
- Register the clone in that memory *before* recursing into children.
- Primitives and functions can be returned as-is.

## Interview Answer
I write a recursive function with a `WeakMap` from original objects to clones. For primitives and functions I return the value. If the object is already in the map I return its clone, which handles cycles and preserves shared references. Otherwise I create an empty container of the right type, register it in the map first, and then recursively copy children: arrays by index, `Map` and `Set` by cloning entries, `Date` and `RegExp` by constructing new ones, and plain objects by iterating own keys, including symbol keys. I keep the prototype with `Object.create(Object.getPrototypeOf(obj))`. `structuredClone` is the built-in choice, but this shows the algorithm.

## Explanation
### Implementation

```js
function deepClone(value, seen = new WeakMap()) {
  // primitives, null, functions
  if (value === null || typeof value !== "object") return value;

  // cycles and shared references
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) {
    const re = new RegExp(value.source, value.flags);
    re.lastIndex = value.lastIndex;
    return re;
  }

  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);                          // register before recursing
    value.forEach((v, k) => copy.set(deepClone(k, seen), deepClone(v, seen)));
    return copy;
  }

  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    value.forEach((v) => copy.add(deepClone(v, seen)));
    return copy;
  }

  if (Array.isArray(value)) {
    const copy = new Array(value.length);
    seen.set(value, copy);
    value.forEach((v, i) => { copy[i] = deepClone(v, seen); });
    return copy;
  }

  // plain objects and class instances: keep the prototype
  const copy = Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {       // strings + symbols
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if ("value" in desc) desc.value = deepClone(desc.value, seen);
    Object.defineProperty(copy, key, desc);          // keeps getters/setters, enumerability
  }
  return copy;
}
```

### Why a WeakMap
- Keys are the original objects; entries disappear when the clone finishes and nothing references them, so no leak.
- It handles both cycles (`a.self = a`) and diamonds (`{ x: shared, y: shared }`), which JSON-based copies break or duplicate.

### What this does not cover
- DOM nodes, typed arrays, `ArrayBuffer`, `Error` objects, Promises, WeakMaps: add branches as needed (`ArrayBuffer.prototype.slice`, typed array constructors).
- Accessor properties are copied as accessors, still bound to the original closures.
- Functions are shared, not cloned.
- Deep recursion can overflow the stack on very deep trees; an iterative version with an explicit stack avoids it.

### Compared with the alternatives

| Approach | Cycles | Date/Map/Set | Prototype | Functions |
|---|---|---|---|---|
| `JSON.parse(JSON.stringify())` | throws | lost | lost | dropped |
| `structuredClone` | yes | yes | lost | throws |
| this `deepClone` | yes | yes | kept | shared |

### Complexity
O(n) time and space for n reachable values.

## Follow-ups
- **Why register the clone before recursing?** — Otherwise a cycle will recurse back into the same object before it is in the map.
- **How would you test it?** — Cycles, shared references, `Date` equality, mutation of the clone not affecting the original.

## Common Mistakes
- Not tracking visited objects, causing a stack overflow on cycles.
- Using `typeof value === "object"` and cloning `null`.
- Losing the prototype, so class methods vanish.

## Tips
- Start by saying "recursion + WeakMap for visited" before coding.
