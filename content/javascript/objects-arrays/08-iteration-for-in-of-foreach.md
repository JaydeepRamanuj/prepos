---
title: "for...in vs for...of vs forEach vs Object.keys/entries: which to use?"
level: medium
type: concept
tags: [iteration, for-in, for-of, forEach, iterables, object-entries]
related: [javascript/map-filter-reduce, javascript/sequential-vs-parallel-await, javascript/map-set-weakmap-weakset]
---

## Question
Compare `for...in`, `for...of`, `forEach` and `Object.keys/values/entries`. How do they differ for arrays, objects and strings, and how do `break`, `await` and inherited properties behave?

## Interview Answer
`for...in` iterates enumerable string keys of an object, including inherited ones, so it suits plain objects only when I also filter, and it is a poor fit for arrays because the keys are strings and order is not guaranteed for non-index keys. `for...of` iterates the values of any iterable — arrays, strings, Maps, Sets, NodeLists, generators — and supports `break`, `continue`, `return` and `await`. `forEach` is an array method that cannot be stopped early and does not wait for async callbacks. For objects I use `Object.entries(obj)` with `for...of`, which gives own enumerable keys and values without inherited surprises.

## Explanation
### Overview

```js
const arr = ["a", "b"];
arr.extra = "x";

for (const i in arr) console.log(i);        // "0", "1", "extra"  (keys, strings)
for (const v of arr) console.log(v);        // "a", "b"           (values)
arr.forEach((v, i) => console.log(v, i));   // "a" 0, "b" 1

const obj = { x: 1, y: 2 };
for (const [k, v] of Object.entries(obj)) console.log(k, v);
```

### Comparison

| | Works on | Yields | Inherited props | `break` | `await` works |
|---|---|---|---|---|---|
| `for...in` | any object | keys | yes (enumerable) | yes | yes |
| `for...of` | iterables | values | n/a | yes | yes |
| `forEach` | arrays (and Map/Set own versions) | value, index | n/a | no | no, not awaited |
| `Object.keys/values/entries` | objects | own enumerable | no | via loop | via loop |

### Inherited keys

```js
function P() { this.own = 1; }
P.prototype.inherited = 2;
for (const k in new P()) console.log(k);    // "own", "inherited"
```

Guard with `Object.hasOwn(obj, k)` or avoid `for...in`.

### Iterating other things

```js
for (const ch of "héllo👍") {}               // iterates by code point
for (const [k, v] of new Map([["a", 1]])) {}
for (const x of new Set([1, 2])) {}
for (const el of document.querySelectorAll("li")) {}
for await (const chunk of stream) {}         // async iterables
```

A plain object is not iterable: `for (const x of {})` throws.

### Early exit
`for...of` calls the iterator's `return()` on `break`, closing generators and streams. `forEach` cannot break; use `some`/`every`/`find` or a loop.

### Async

```js
for (const id of ids) await save(id);       // sequential
await Promise.all(ids.map(save));           // concurrent
ids.forEach(async (id) => await save(id));  // fire and forget: wrong
```

### Performance
Differences between loops are negligible for typical UI code; prefer readability.

## Follow-ups
- **Order of `Object.keys`?** — Integer-like keys ascending, then string keys in insertion order.
- **How do you make an object iterable?** — Implement `[Symbol.iterator]()`, often as a generator.

## Common Mistakes
- Using `for...in` on arrays.
- Expecting `forEach` to wait or break.

## Tips
- Remember "in = keys, of = values" and recommend `Object.entries` for objects.
