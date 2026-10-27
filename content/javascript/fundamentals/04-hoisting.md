---
title: "What does this hoisting snippet log?"
level: medium
type: output
tags: [hoisting, var, function-declarations, execution-context]
related: [javascript/var-let-const, javascript/temporal-dead-zone, javascript/lexical-scope]
---

## Question
What does this code print, and why?

```js
console.log(typeof foo);
console.log(bar);

var bar = 1;
function foo() { return "fn"; }
var foo = "var";

console.log(typeof foo);

try {
  baz();
} catch (e) {
  console.log(e.constructor.name, e.message);
}
var baz = function () {};

function outer() {
  console.log(x);
  if (false) { var x = 10; }
  return x;
}
console.log(outer());
```

## Interview Answer
It logs `function`, `undefined`, `string`, `TypeError baz is not a function`, `undefined`, and `undefined`. Before any code runs, the engine creates bindings for every declaration in the scope: function declarations are created *with their body*, and `var`s are created with the value `undefined`. A `var` with the same name as a function declaration does not overwrite it during that setup phase, so `foo` starts as the function; only when the line `foo = "var"` executes does it become a string. `baz` is a `var` holding `undefined` until its assignment line, so calling it throws a `TypeError`, not a `ReferenceError`. Inside `outer`, the `var x` is hoisted to the function even though its block never runs, so `x` exists and is `undefined`.

## Explanation
### Two phases
Every time a scope is entered (the script, or a function call), the engine does:

1. **Creation phase** — scan for declarations.
   - `function name() {}` → binding created and initialised with the function.
   - `var name` → binding created and initialised with `undefined` (if not already present).
   - `let`/`const`/`class` → binding created but **uninitialised** (TDZ).
2. **Execution phase** — run the code top to bottom; assignments happen where they are written.

So the snippet effectively runs as:

```js
function foo() { return "fn"; } // hoisted with body
var bar;                        // undefined
var baz;                        // undefined
// var foo; → ignored, foo already exists

console.log(typeof foo);  // "function"
console.log(bar);         // undefined
bar = 1;
foo = "var";              // the assignment is what changes foo
console.log(typeof foo);  // "string"
baz();                    // TypeError: baz is not a function
baz = function () {};
```

### Step by step

```txt
function                          ← foo is the hoisted function
undefined                         ← bar exists but is unassigned
string                            ← foo reassigned on line 5
TypeError baz is not a function   ← baz is undefined, calling undefined
undefined                         ← console.log(x) inside outer
undefined                         ← outer() returns x, still undefined
```

### Function declarations vs function expressions
Only *declarations* are hoisted with their body. `var baz = function () {}` and `const baz = () => {}` are expressions assigned to variables — they follow the variable's hoisting rules. With `const` you would get `ReferenceError: Cannot access 'baz' before initialization`.

### `var` ignores blocks
`if (false) { var x = 10; }` still declares `x` for the whole function. The assignment never runs, but the declaration is processed in the creation phase.

## Follow-ups
- **What if you swap `var foo` for `let foo`?** — SyntaxError at parse time: `foo` is already declared by the function declaration in the same scope.
- **Are function declarations inside blocks hoisted?** — In strict mode and modules they are block-scoped; in sloppy mode browsers apply legacy "Annex B" rules that also create a `var`-like binding in the function. Avoid relying on it.
- **Why does hoisting exist at all?** — It lets mutually recursive functions call each other regardless of order, and it falls out of how the engine sets up scopes before running code.

## Common Mistakes
- Saying the declarations are "moved to the top" literally — nothing moves; bindings are created before execution.
- Expecting `baz()` to throw a `ReferenceError`.
- Thinking the later `var foo` overrides the function at hoisting time.

## Tips
- Explain with the **two-phase model** (creation, then execution) instead of "moved to the top" — it lets you predict any snippet.
- Remember the error types: calling a hoisted `var` → `TypeError`; touching a `let` early → `ReferenceError`.
