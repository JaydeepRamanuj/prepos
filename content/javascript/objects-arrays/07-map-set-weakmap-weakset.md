---
title: "Map vs Object, Set vs Array, and what are WeakMap and WeakSet for?"
level: hard
type: concept
tags: [map, set, weakmap, weakset, garbage-collection, collections]
related: [javascript/closure, javascript/iteration-for-in-of-foreach, javascript/shallow-vs-deep-copy]
---

## Question
When would you use a `Map` instead of a plain object, and a `Set` instead of an array? What do `WeakMap` and `WeakSet` do differently, and what are real use cases?

## Clues
- Think about what types of keys an object allows, and about insertion order and size.
- Weak collections interact with garbage collection.
- Why can't you iterate a `WeakMap` or read its size?

## Interview Answer
A `Map` holds key-value pairs where keys can be any value, including objects, keeps insertion order, has a `size`, and is optimised for frequent adds and removals; a plain object only has string and symbol keys and inherits prototype properties like `toString`. A `Set` stores unique values with O(1) `has`, ideal for deduplication and membership checks. `WeakMap` and `WeakSet` hold their keys weakly: keys must be objects (or non-registered symbols), and if nothing else references a key it can be garbage collected along with its entry. Because entries can vanish at any time, they are not iterable and have no `size`. I use `WeakMap` for private data or caches attached to objects without causing memory leaks.

## Explanation
### Map vs Object

| | Map | Object |
|---|---|---|
| Key types | any | string / symbol |
| Order | insertion | integer keys first, then insertion |
| Size | `map.size` | `Object.keys(o).length` |
| Iteration | directly iterable | `Object.entries` |
| Prototype keys | none | `"toString"`, `"__proto__"` risks |
| Performance | better for frequent add/delete | better for fixed shape, JSON |
| JSON | not serialisable directly | yes |

```js
const m = new Map();
const keyObj = {};
m.set(keyObj, "meta").set("a", 1);
m.get(keyObj);            // "meta"
[...m].length;            // 2
```

### Set

```js
const unique = [...new Set([1, 2, 2, 3])];     // [1, 2, 3]
const seen = new Set();
const hasDup = (arr) => arr.some((x) => seen.size === seen.add(x).size);
```

Newer Set methods (`union`, `intersection`, `difference`, `isSubsetOf`) are in modern runtimes (ES2025).

### WeakMap and WeakSet

```js
const meta = new WeakMap();

function track(el) {
  meta.set(el, { clicks: 0 });         // no extra property on el
}

// When `el` is removed from the DOM and unreferenced,
// its entry is garbage collected automatically.
```

Use cases:
- Caching computed data per object (memoization keyed by object).
- Private data (before `#private`).
- Tracking visited objects in graph traversal or deep clone without leaks.
- Marking DOM nodes processed.

A normal `Map` would keep keys alive forever, leaking memory.

### Why not iterable
GC timing is nondeterministic, so exposing size or iteration would expose it. `WeakRef` and `FinalizationRegistry` exist for rarer needs.

### Equality
`Map` and `Set` use SameValueZero: `NaN` equals `NaN`, `+0` equals `-0`. Objects compare by reference, so `set.has({})` is false for a new literal.

## Follow-ups
- **Can WeakMap keys be strings?** — No, only objects and non-registered symbols.
- **Map vs object for a counter dictionary?** — Map is safer with arbitrary keys; object is fine for fixed known keys.

## Common Mistakes
- Using an object as a dictionary with user-provided keys (prototype pollution, `__proto__`).
- Expecting WeakMap entries to be inspectable.

## Tips
- Frame WeakMap as "metadata that lives exactly as long as the object".
