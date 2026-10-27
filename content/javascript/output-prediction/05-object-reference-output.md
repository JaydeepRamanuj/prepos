---
title: "Object references and mutation: predict the output (pass-by-sharing, spread, freeze)"
level: medium
type: output
tags: [references, mutation, spread, object-freeze, output]
related: [javascript/deep-clone, javascript/pure-functions-side-effects, javascript/structured-clone]
---

## Question
This file runs as an ES module. What does it log?

```js
const a = { n: 1 };
const b = a;
b.n = 2;
console.log(a.n);

function update(obj) {
  obj.n = 3;
  obj = { n: 4 };
  obj.n = 5;
}
update(a);
console.log(a.n);

const list = [a, { n: 10 }];
const copy = [...list];
copy[0].n = 99;
copy[1] = { n: 20 };
console.log(list[0].n, list[1].n);

const frozen = Object.freeze({ inner: { n: 1 }, x: 0 });
frozen.inner.n = 2;
try {
  frozen.x = 1;
} catch (e) {
  console.log(e.name);
}
console.log(frozen.inner.n, frozen.x);

console.log({ n: 1 } === { n: 1 }, [a].includes(b));
```

## Interview Answer
The output is `2`, `3`, `99 10`, `TypeError`, `2 0`, `false true`. Variables hold *references* to objects, so `b = a` makes both names point at one object, and `b.n = 2` changes what `a` sees. JavaScript passes arguments by value, but for objects that value is a reference ("pass by sharing"). Inside `update`, mutating `obj.n` changes the caller's object, while reassigning `obj` only re-points the local parameter. Spread makes a shallow copy: `copy` is a new array, but its first element is the same object as `list[0]`, so mutating it shows through, while replacing `copy[1]` does not touch `list`. `Object.freeze` is shallow too, and writing to a frozen property throws in strict mode. Object equality compares identity, never structure.

## Explanation
### Exact output

```txt
2
3
99 10
TypeError
2 0
false true
```

### Step 1: two names, one object

```txt
a ──┐
    ├──▶ { n: 2 }
b ──┘
```

### Step 2: pass by sharing
`update(a)` copies the *reference* into `obj`:

```txt
obj.n = 3        obj ──▶ { n: 3 } ◀── a     (shared object mutated)
obj = { n: 4 }   obj ──▶ { n: 4 }           (local re-pointed; a unaffected)
obj.n = 5        obj ──▶ { n: 5 }           (a new object nobody else sees)
```

`a.n` is `3`. JavaScript has no pass-by-reference in the C++ sense, so you can never reassign the caller's variable from inside a function.

### Step 3: shallow copy with spread

```txt
list ──▶ [ ●, ● ]          copy ──▶ [ ●, ● ]
           │  └─▶ {n:10}             │  └─▶ {n:20}   (copy[1] replaced)
           └──────────────┬──────────┘
                          ▼
                       a {n:99}
```

`[...list]`, `Array.from`, `slice()`, `{ ...obj }` and `Object.assign` all copy only the top level.

### Step 4: `Object.freeze` is shallow and strict-mode loud
- `frozen.inner.n = 2` succeeds. `inner` is a separate, unfrozen object, and freeze only locks `frozen`'s own properties.
- `frozen.x = 1` fails. In strict mode (modules and classes are strict) it throws `TypeError`. In sloppy mode it fails **silently**, and `x` stays 0.

### Step 5: identity equality
`===` on objects asks whether this is the same object in memory. Two separate literals are never equal. `includes` uses SameValueZero, which is identity for objects, and `b` *is* `a`.

### Why this matters in React
```js
// wrong: same reference, React bails out, no re-render
setUser((u) => { u.name = "Ravi"; return u; });
// right: new top-level object
setUser((u) => ({ ...u, name: "Ravi" }));
// nested: copy every level you change
setUser((u) => ({ ...u, address: { ...u.address, city: "Pune" } }));
```

## Follow-ups
- **How do you deep-freeze?** — Recursively call `Object.freeze` on every object-valued property (and watch for cycles).
- **How do you get a real deep copy?** — `structuredClone(value)` handles nested objects, `Date`, `Map`, `Set` and cycles, but not functions or DOM nodes. Or write a recursive clone with a `WeakMap`.
- **Are strings affected by this?** — No. Primitives are immutable, so "changing" one always creates a new value.

## Common Mistakes
- Saying "objects are passed by reference". If that were true, `obj = { n: 4 }` would change `a`.
- Thinking spread or `Object.assign` deep-copies.
- Assuming `Object.freeze` makes nested objects immutable.

## Tips
- Draw arrows. "Variables are labels pointing at objects" solves every puzzle of this type, and drawing it on the whiteboard shows you are not guessing.
