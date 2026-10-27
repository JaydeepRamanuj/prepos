---
title: "Predict the output: function vs var hoisting and redeclaration"
level: medium
type: output
tags: [hoisting, var, function-declarations, output]
related: [javascript/hoisting, javascript/var-let-const, javascript/tdz-shadowing-output]
---

## Question
This runs as a classic script (not a module). What does each `console.log` print?

```js
console.log(typeof foo);
console.log(typeof bar);
console.log(a);

var a = 1;
function foo() { return "foo"; }
var bar = function () { return "bar"; };

function test() {
  console.log(a);
  var a = 2;
  function a() {}
  console.log(a);
}
test();
```

## Interview Answer
The output is `function`, `undefined`, `undefined`, then inside `test` it prints `function a() {}` and then `2`. Function declarations are hoisted with their body, so `foo` is a function before its line. `var` declarations are hoisted and initialised to `undefined`, so `bar` and the outer `a` are `undefined`, because assignments stay in place. Inside `test`, the local `var a` and the function declaration `a` share one binding; the function wins at hoisting time, so the first log shows the function, and then `a = 2` replaces it.

## Explanation
### Mental model
Before running a scope, the engine creates bindings: function declarations are created and assigned their function; `var` names are created as `undefined` (unless the name already exists from a function declaration). Then code runs top to bottom.

### Top-level

| Line | Result | Why |
|---|---|---|
| `typeof foo` | `"function"` | declaration hoisted with value |
| `typeof bar` | `"undefined"` | `var` hoisted, assignment not yet run (it is not a TypeError because we only use `typeof`) |
| `a` | `undefined` | hoisted `var`, not assigned yet |

### Inside `test`
Bindings after hoisting: `a` = the function `a` (the `var a` does not reset it to `undefined`).

```js
function test() {
  // hoisted: a -> function a() {}
  console.log(a);   // [Function: a]
  a = 2;            // `var a = 2` assignment executes here
  console.log(a);   // 2
}
```

### Printed output
```txt
function
undefined
undefined
[Function: a]    (Node prints [Function: a]; browsers show function a() {})
2
```

### Related traps
- Calling `bar()` before its assignment throws `TypeError: bar is not a function`, not ReferenceError.
- `let`/`const`/`class` are hoisted but in the TDZ, so using them early throws ReferenceError.
- Function declarations inside blocks have quirky legacy behaviour in sloppy mode; avoid them.

## Follow-ups
- **What if `foo` were declared twice?** — The last declaration wins.
- **Would this behave the same in a module?** — Mostly yes for hoisting, but top-level `this` and variable scope differ.

## Common Mistakes
- Saying "hoisting moves code to the top".
- Expecting `var a` inside the function to reset the function binding to `undefined`.

## Tips
- Say "declarations are processed first, assignments stay where they are".
