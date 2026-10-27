---
title: "What is the Temporal Dead Zone, and why does it exist?"
level: hard
type: concept
tags: [tdz, let, const, hoisting, scope]
related: [javascript/var-let-const, javascript/hoisting, javascript/lexical-scope]
---

## Question
What is the Temporal Dead Zone (TDZ)? Predict each result:

```js
let a = 1;
{
  a = a + 1;   // (1)
  let a = 5;
}

function check() { return v; }
{
  // check() here?   (2)
}

let q = q + 1; // (3)

function g(x = y, y = 2) { return x; }
g();           // (4)
```

Why did the language designers make `let`/`const` behave this way instead of copying `var`?

## Clues
- `let` and `const` are hoisted to the top of their block — the binding exists, but it has no value yet.
- "Temporal" means *time*, not position in the file: what matters is whether the declaration line has *executed* when the access happens.
- Default parameters are evaluated left to right in their own scope.

## Interview Answer
The TDZ is the period between entering a scope and executing a `let`, `const` or `class` declaration. The binding is hoisted — the engine knows the name belongs to that block — but it is uninitialised, and any read or write during that window throws `ReferenceError: Cannot access 'x' before initialization`. So in the block, `a = a + 1` throws: the inner `let a` shadows the outer one for the *whole* block, even lines above it. `let q = q + 1` throws because the right side runs before `q` is initialised, and `g()` throws because `x`'s default reads `y` before `y`'s parameter is set. It is "temporal" because what matters is execution time, not text order — a function declared above a `let` can read it fine as long as it is *called* after the declaration runs. It exists to catch use-before-initialisation bugs early and to give `const` a sane meaning: a `const` that could be observed as `undefined` and then as its real value would not really be constant.

## Explanation
### Hoisted, but not initialised
For `var` the engine creates the binding and sets it to `undefined` immediately. For `let`/`const`/`class` it creates the binding and leaves it in an *uninitialised* state until the declaration statement runs.

```txt
{                         ← block entered: binding `a` created, uninitialised
  a = a + 1;              ← TDZ: ReferenceError
  let a = 5;              ← initialised here, TDZ ends
}
```

The inner `a` shadows the outer `a` from the very first line of the block — that is why the outer `a = 1` does not help.

### Temporal, not spatial

```js
{
  function check() { return v; } // refers to v below — allowed to *write* this
  // check();                    // ReferenceError — called during TDZ
  let v = 1;
  check();                       // 1 — called after initialisation
}
```

Closures that reference a later `let` are fine; only the *timing of the access* matters. This is why module code with circular imports can still throw TDZ errors: one module may run before the other's `export const` line has executed.

### All four results

| Case | Result | Reason |
|---|---|---|
| (1) `a = a + 1` in block | ReferenceError | inner `a` in TDZ, shadows outer |
| (2) `check()` before `let v` | ReferenceError | access happens during TDZ |
| (3) `let q = q + 1` | ReferenceError | initialiser reads `q` before init finishes |
| (4) `g()` | ReferenceError | default `x = y` reads `y` before its param is set |

### `typeof` is not safe either

```js
typeof undeclared; // "undefined" — never declared anywhere
{
  typeof t;        // ReferenceError — t is declared below, in TDZ
  let t;
}
```

### Why it was designed this way
- **`const` correctness** — with `var`-style hoisting, a `const` would be `undefined` first and its real value later, i.e. it would change.
- **Fail fast** — using a variable before it is set is almost always a bug; an error is better than a silent `undefined`.
- **Consistency with classes** — `class` declarations also have a TDZ so that `new Foo()` before the class body is defined fails loudly instead of using a half-built constructor.

### TDZ in `switch`

```js
switch (n) {
  case 0: let s = 1; break;
  case 1: s = 2;   // ReferenceError — same block, declaration skipped
}
```

All `case`s share one block. Wrap each case body in `{}` to give it its own scope.

## Follow-ups
- **Does the TDZ have a runtime cost?** — Engines insert checks only when they cannot prove initialisation statically; in practice it is negligible.
- **Do function parameters have a TDZ?** — Yes, each parameter is in TDZ until its own default is evaluated, which is why `(a = b, b = 1)` fails but `(a = 1, b = a)` works.
- **How does TDZ show up in React code?** — A component defined with `const` and used in a module-level object above its definition, or circular imports between modules, both produce "Cannot access before initialization" errors.

## Common Mistakes
- Saying `let`/`const` are not hoisted. If they were not, `a = a + 1` would happily use the outer `a`.
- Assuming `typeof` always protects you from ReferenceErrors.
- Thinking a function that *mentions* a later `let` is an error — only calling it too early is.

## Tips
- Define it in one sentence: "the time between entering a scope and the line that initialises a `let`/`const`, during which access throws."
- The shadowing example (outer `a`, inner `let a`) is the proof that hoisting happens — lead with it.
