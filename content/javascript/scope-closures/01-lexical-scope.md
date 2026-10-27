---
title: "What is lexical scope and how does the scope chain work?"
level: easy
type: concept
tags: [scope, lexical-scope, scope-chain, shadowing]
related: [javascript/closure, javascript/var-let-const, javascript/this-binding-rules]
---

## Question
What is lexical scope? Given this code, what is logged and why?

```js
let x = 1;

function show() {
  console.log(x);
}

function run() {
  let x = 2;
  show();
}

run();
```

## Interview Answer
It logs `1`. Lexical scope means a function's access to variables is decided by *where the function is written* in the source, not where it is called from. `show` was defined at the top level, so when it looks up `x` it searches its own scope, finds nothing, and moves outward to the module/global scope where `x` is `1`. The `x = 2` inside `run` is invisible to `show`, because `show` is not nested inside `run`. That outward search — current scope, then each enclosing scope until the global one — is the scope chain, and if nothing matches you get a `ReferenceError`. The one thing in JavaScript that *is* decided by the call site is `this`, which is why people mix the two up.

## Explanation
### Scope is decided at write time

```txt
Global scope        { x: 1, show, run }
├── show() scope    { }            ── parent: Global
└── run() scope     { x: 2 }       ── parent: Global
```

Each function remembers the scope it was created in (its *outer environment*). Calling `show()` from inside `run` does not change `show`'s parent. If JS used *dynamic* scope (like Bash), it would log `2`.

### Scope levels
- **Global / module scope** — top-level declarations. In ES modules each file has its own module scope.
- **Function scope** — parameters, `var`s and inner functions.
- **Block scope** — `let`, `const`, `class` inside `{ }`, `for`, `if`, `try`.

### Lookup and shadowing

```js
const theme = "light";
function Page() {
  const theme = "dark";        // shadows the outer theme
  function Button() {
    return theme;              // finds the nearest: "dark"
  }
  return Button();
}
Page(); // "dark"
```

Lookup stops at the first match, moving outward only. An inner scope can read outer variables; an outer scope can never read inner ones.

### Assignment to an undeclared name

```js
function oops() {
  total = 10; // no declaration anywhere
}
oops();
```

In sloppy-mode scripts this silently creates a global `total`. In strict mode and in ES modules (always strict) it throws `ReferenceError: total is not defined`.

### Why lexical scope matters
It is what makes closures possible: because a function keeps a link to the scope where it was defined, it can keep using those variables after the outer function has returned.

## Follow-ups
- **Is `this` lexically scoped?** — Not for regular functions; it depends on how they are called. Arrow functions are the exception — they take `this` from their lexical scope.
- **Can you change a function's scope at runtime?** — Not in strict code. Legacy `eval` and `with` could inject variables, which is one reason they are banned in strict mode.
- **What is the difference between scope and execution context?** — Scope is the static set of visible names; an execution context is the runtime record created per call, which includes the variable environment and `this`.

## Common Mistakes
- Answering `2` because `show` is "called inside" `run`.
- Thinking an inner `let x` modifies the outer `x` instead of shadowing it.
- Confusing scope (static) with `this` (dynamic).

## Tips
- The phrase to remember: "**where it is written, not where it is called**".
- Drawing the nested scope boxes, as above, is a great way to answer any scope question on a whiteboard.
