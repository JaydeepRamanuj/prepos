---
title: "Shallow copy vs deep copy: what are the ways to copy an object?"
level: easy
type: concept
tags: [copy, spread, structuredClone, references, immutability]
related: [javascript/structured-clone, javascript/deep-clone, javascript/object-reference-output]
---

## Question
What is the difference between a shallow and a deep copy? Which techniques make each, and what are their limits?

## Interview Answer
A shallow copy duplicates only the top-level properties; nested objects are still shared by reference, so mutating `copy.address.city` also changes the original. A deep copy duplicates the whole tree so the two are independent. For shallow copies I use spread `{...obj}`, `[...arr]`, `Object.assign` or `Array.prototype.slice`. For deep copies I use `structuredClone`, which handles nested objects, arrays, `Date`, `Map`, `Set` and cycles but not functions or class instances' prototypes. `JSON.parse(JSON.stringify(x))` is the old trick, but it drops `undefined`, functions and symbols, turns `Date` into strings and throws on cycles. In React state updates I rarely need a deep copy: I copy only the path that changed.

## Explanation
### The shared-reference problem

```js
const user = { name: "Asha", address: { city: "Pune" } };
const copy = { ...user };
copy.name = "Ravi";            // independent (primitive)
copy.address.city = "Delhi";   // shared object!
user.address.city;             // "Delhi"
```

### Techniques

| Technique | Depth | Keeps | Loses / fails |
|---|---|---|---|
| `{...o}`, `[...a]`, `Object.assign` | shallow | own enumerable props | getters become values, prototype |
| `arr.slice()`, `Array.from` | shallow | elements | — |
| `JSON.parse(JSON.stringify(o))` | deep | plain data | `undefined`, functions, symbols, `Date`→string, `Map`/`Set`→`{}`, cycles throw, `NaN`→`null` |
| `structuredClone(o)` | deep | `Date`, `Map`, `Set`, `RegExp`, typed arrays, cycles | functions (throws), DOM nodes, prototypes/class methods |
| custom recursive clone | deep | whatever you handle | you must handle cycles and types |

### Updating nested state immutably
Instead of cloning everything, copy along the path:

```js
const next = {
  ...user,
  address: { ...user.address, city: "Delhi" },
};
```

Unchanged branches stay shared, which is exactly what makes React's reference checks cheap.

### `Object.assign` vs spread
Both copy own enumerable properties; `Object.assign` triggers setters on the target, spread defines new properties.

### Arrays of objects

```js
const todos = [{ id: 1, done: false }];
const copy = [...todos];
copy[0].done = true;  // original todo mutated too
```

## Follow-ups
- **Is `Object.freeze` a copy?** — No, it is shallow immutability on the same object.
- **Performance of deep copies?** — O(size of tree); avoid in hot paths.

## Common Mistakes
- Assuming spread is deep.
- Using the JSON trick on data with dates, undefined or Maps.

## Tips
- Say "`structuredClone` first, then know what it can't do" — it shows you are current.
