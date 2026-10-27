---
title: "What does structuredClone do and what can't it clone?"
level: medium
type: concept
tags: [structuredClone, deep-copy, serialization, postMessage]
related: [javascript/shallow-vs-deep-copy, javascript/deep-clone, javascript/object-reference-output]
---

## Question
How does `structuredClone` work, which values does it support, and what throws or gets lost? When would you still write a custom deep clone?

## Interview Answer
`structuredClone(value)` is the built-in deep copy, using the same structured clone algorithm as `postMessage` and IndexedDB. It copies plain objects and arrays, primitives, `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, typed arrays, `Error` types, and it preserves shared references and cycles. It throws a `DataCloneError` for functions and DOM nodes, ignores symbols keys, drops getters/setters by reading their values, and does not preserve prototypes, so class instances come back as plain objects. It is available in modern browsers and Node 17+. I write a custom clone only when I need to preserve class instances, handle functions, or customise special types.

## Explanation
### Basics

```js
const a = { when: new Date(), tags: new Set(["x"]), nested: { n: 1 } };
a.self = a;                      // cycle

const b = structuredClone(a);
b.when instanceof Date;          // true
b.tags instanceof Set;           // true
b.self === b;                    // true: cycle preserved
b.nested === a.nested;           // false
```

### What it cannot handle

```js
structuredClone({ fn() {} });          // DataCloneError
structuredClone(document.body);        // DataCloneError

class User { constructor() { this.name = "A"; } hi() {} }
const u = structuredClone(new User());
u instanceof User;                     // false (plain object)
u.hi;                                  // undefined
```

### Comparison with JSON

| | JSON trick | structuredClone |
|---|---|---|
| `Date` | string | `Date` |
| `Map`/`Set` | `{}` | preserved |
| `undefined` values | dropped | preserved |
| cycles | throws | works |
| functions | dropped | throws |
| `NaN`/`Infinity` | `null` | preserved |

### Transfer
Second argument moves ownership of transferable objects instead of copying:

```js
const buf = new ArrayBuffer(1024);
const copy = structuredClone(buf, { transfer: [buf] });
buf.byteLength; // 0, detached
```

### Where else it appears
`postMessage` to workers, `history.pushState` state, IndexedDB values. That is why those APIs reject functions.

### Custom clone cases
- Class instances needing prototypes: `Object.create(Object.getPrototypeOf(o))` plus recursion.
- Domain-specific rules (skip a field, redact secrets).

## Follow-ups
- **Does it clone getters?** — It calls them and copies the resulting value as a data property.
- **Is it fast?** — Usually faster than JSON for rich data, but still O(n) with allocation costs.

## Common Mistakes
- Expecting methods or prototypes to survive.
- Passing objects containing functions (event handlers, callbacks, React elements with refs).

## Tips
- Mention that the same algorithm powers `postMessage`, which explains its limits.
