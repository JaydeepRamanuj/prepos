---
title: "Object.freeze, seal and const: how do you make something immutable?"
level: medium
type: concept
tags: [immutability, freeze, seal, const, defineProperty]
related: [javascript/shallow-vs-deep-copy, javascript/var-let-const, react/props-vs-state]
---

## Question
What is the difference between `const`, `Object.freeze`, `Object.seal` and `Object.preventExtensions`? Is `freeze` deep? Why does immutability matter in React and Redux-style code?

## Interview Answer
`const` prevents reassigning the binding; it says nothing about mutating the object. `Object.freeze` makes an object's own properties non-writable and non-configurable and prevents adding or deleting, but it is shallow: nested objects stay mutable unless frozen recursively. `Object.seal` blocks adding and deleting but allows changing existing values, and `preventExtensions` only blocks adding. In strict mode, violations throw a TypeError; in sloppy mode they silently fail. Immutability matters because React, Redux and memoization compare by reference: if you mutate in place, the reference does not change and updates are missed. So I produce new objects along the changed path instead.

## Explanation
### Comparison

| | add prop | delete prop | change value | reconfigure |
|---|---|---|---|---|
| `preventExtensions` | no | yes | yes | yes |
| `seal` | no | no | yes | no |
| `freeze` | no | no | no | no |

```js
"use strict";
const o = Object.freeze({ a: 1, nested: { b: 2 } });
o.a = 2;            // TypeError
o.nested.b = 3;     // allowed: freeze is shallow
Object.isFrozen(o); // true
```

### Deep freeze

```js
function deepFreeze(obj) {
  Object.values(obj).forEach((v) => {
    if (typeof v === "object" && v !== null && !Object.isFrozen(v)) deepFreeze(v);
  });
  return Object.freeze(obj);
}
```

### `const` vs freeze

```js
const arr = [1];
arr.push(2);        // fine
arr = [];           // TypeError
```

Frozen arrays throw on `push`.

### Why immutable updates

```js
// Mutation: same reference, React.memo / useState bail out
state.items.push(x);
setState(state);

// New references along the path
setState({ ...state, items: [...state.items, x] });
```

Benefits: cheap change detection, predictable history (undo, time travel), and no accidental shared mutation.

### Practical notes
- `Object.freeze` has a tiny cost and is commonly used on constants and config.
- TypeScript offers `readonly`, `as const` and `Readonly<T>` for compile-time immutability without runtime cost.
- Libraries like Immer let you write mutating code that produces immutable results.
- Frozen objects can't be extended or have their prototype changed.

## Follow-ups
- **Does freezing an array freeze its elements?** — No, only the array's own slots.
- **How do you prevent deep mutation at compile time?** — `DeepReadonly` types or `as const`.

## Common Mistakes
- Treating `const` as immutability.
- Assuming `Object.freeze` is deep.

## Tips
- Connect the answer to reference equality in React to show practical relevance.
