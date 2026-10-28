---
title: "Predict the output: shared prototype properties, shadowing and delete"
level: hard
type: output
tags: [prototype, shadowing, delete, output, references]
related: [javascript/prototype-chain, javascript/classes-vs-prototypes, javascript/object-reference-output]
---

## Question
What does this log?

```js
function Counter() {}
Counter.prototype.count = 0;
Counter.prototype.items = [];

const a = new Counter();
const b = new Counter();

a.count++;
a.items.push("x");

console.log(a.count, b.count);
console.log(a.items.length, b.items.length);
console.log(a.hasOwnProperty("count"), a.hasOwnProperty("items"));

delete a.count;
console.log(a.count);

Counter.prototype = { count: 99 };
const c = new Counter();
console.log(c.count, a instanceof Counter, c instanceof Counter);
```

## Clues
- `a.count++` reads the inherited value and then writes. Where does the write go?
- Primitives and arrays on a prototype behave differently when "modified".
- `instanceof` compares against `Counter.prototype` as it is at the time of the check.

## Interview Answer
It logs `1 0`, then `1 1`, then `true false`, then `0`, and finally `99 false true`. `a.count++` reads `0` from the prototype and writes `1` as a new own property on `a`, shadowing the prototype, so `b.count` is still 0. `a.items.push` mutates the single array shared through the prototype, so both instances see length 1, and `items` is not an own property. After `delete a.count` the own property is gone and the lookup falls back to the prototype value 0. Reassigning `Counter.prototype` does not affect existing instances, which still point at the old object, so `a instanceof Counter` becomes false while `c instanceof Counter` is true.

## Explanation
### Line by line

| Code | Output | Reason |
|---|---|---|
| `a.count++` | — | read proto 0, create own `a.count = 1` |
| `a.items.push("x")` | — | mutates shared array on prototype |
| log counts | `1 0` | `a` has own; `b` reads prototype |
| log items | `1 1` | same array |
| `hasOwnProperty` | `true false` | only `count` was written |
| `delete a.count`; log | `0` | falls back to prototype |
| `Counter.prototype = {...}` | — | new object for future instances |
| `c.count` | `99` | from new prototype |
| `a instanceof Counter` | `false` | `a`'s chain has the old prototype object |
| `c instanceof Counter` | `true` | |

```txt
1 0
1 1
true false
0
99 false true
```

### Lessons
- Writes create own properties; they never modify the prototype's primitive.
- Mutating a shared reference (arrays, objects) on a prototype leaks state between all instances. Put per-instance data in the constructor: `this.items = []`.
- `instanceof` is dynamic; reassigning `prototype` breaks it for old instances. Mutate the prototype (add methods) rather than replacing it, or reassign before creating instances.

## Follow-ups
- **How does a class avoid the shared array bug?** — Class fields (`items = []`) are initialised per instance.
- **Would `Object.freeze(Counter.prototype)` change anything?** — In strict mode, `a.count++` would throw because an inherited non-writable property blocks creating an own property.

## Common Mistakes
- Thinking `a.count++` increments the prototype's value.
- Missing that the array is shared.

## Tips
- State the rule "reads walk the chain, writes land on the object itself" before walking through.
