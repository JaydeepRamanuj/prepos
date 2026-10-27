---
title: "TDZ and shadowing: predict the output (classes, default params, typeof)"
level: medium
type: output
tags: [tdz, hoisting, let, scope, classes, output]
related: [javascript/temporal-dead-zone, javascript/hoisting, javascript/closures-in-loops-output]
---

## Question
This file runs as an ES module. What does it log?

```js
let x = "outer";

function show() {
  console.log(x);
}

function test() {
  show();
  try {
    console.log(x);
  } catch (e) {
    console.log(e.name);
  }
  let x = "inner";
  console.log(x);
}
test();

try {
  const p = new Point();
} catch (e) {
  console.log(e.name);
}
class Point {}

function defaults(a = b, b = 2) {
  return [a, b];
}
try {
  console.log(defaults());
} catch (e) {
  console.log(e.name);
}
console.log(defaults(1));

console.log(typeof undeclared);
try {
  console.log(typeof later);
} catch (e) {
  console.log(e.name);
}
let later = 1;
```

## Clues
- `let`, `const` and `class` *are* hoisted. What exists between the start of the scope and the declaration line?
- Scope is decided by where a function is **written**, not where it is called from.
- Default parameters are evaluated left to right, each in a scope where later parameters are not initialised yet.

## Interview Answer
The output is `outer`, `ReferenceError`, `inner`, `ReferenceError`, `ReferenceError`, `[ 1, 2 ]`, `undefined`, `ReferenceError`. `show` is defined at module level, so lexical scoping makes it read the outer `x`, even though it is called from inside `test`. Inside `test`, the `let x` declaration is hoisted to the top of `test`'s scope, but the binding stays uninitialised until its line runs. That gap is the temporal dead zone, so reading `x` before then throws a `ReferenceError` instead of falling back to the outer `x`. Classes behave the same way, so `new Point()` before `class Point` throws. Default parameters have their own TDZ: `a = b` reads `b` before it is initialised. Finally, `typeof` is safe for undeclared names but not for TDZ names.

## Explanation
### Exact output

```txt
outer
ReferenceError
inner
ReferenceError
ReferenceError
[ 1, 2 ]
undefined
ReferenceError
```

### Step 1: `show()` logs `outer`
Function scope is **lexical**. `show` was written at module level, so its outer scope is the module, whatever its call site. The caller's local variables are invisible to it. (A language where it would see `test`'s `x` would use "dynamic scope", which JavaScript does not have.)

### Step 2: `console.log(x)` inside `test` throws
When `test` starts, its scope is created with a binding for `x` that is marked *uninitialised*:

```txt
test scope:  x = <uninitialised>   ← TDZ starts
             show(); console.log(x)  → ReferenceError
             let x = "inner";      ← TDZ ends, x initialised
```

Lookup finds `x` in `test`'s scope and stops. It does not continue to the outer `x`, and the binding is in the TDZ, so it throws. This is the key difference from `var`, which would print `undefined`.

### Step 3: `inner`
After the declaration runs, `x` is initialised.

### Step 4: `new Point()` throws
Class declarations are hoisted like `let`, which means they are in the TDZ until the `class` line. Function declarations are the only declarations that are usable before their line.

### Step 5: `defaults()` throws, `defaults(1)` returns `[1, 2]`
Parameters are initialised in order. Evaluating `a = b` happens while `b` is still in its TDZ. When you pass `1`, the default for `a` is never evaluated, `b` falls back to 2, and nothing throws.

### Step 6: `typeof undeclared` gives `"undefined"`, `typeof later` throws
`typeof` on a name that does not exist anywhere returns `"undefined"`. That was the classic feature-detection guard. A name in the TDZ does exist, it is just unreadable, so `typeof` throws.

### Why the TDZ exists
It catches use-before-initialisation bugs that `var` silently turned into `undefined`, and it gives `const` a sensible meaning, since a constant should never be observed with two different values.

## Follow-ups
- **Is the TDZ about position in the code or about time?** — Time. A function declared above `let y` that reads `y` works fine if it is *called* after `y` is initialised, which is why it is called "temporal".
- **What would change with `var x = "inner"`?** — `console.log(x)` inside `test` would print `undefined`, because `var` is initialised to `undefined` at hoisting time.
- **Does `const` have a TDZ too?** — Yes, `let`, `const` and `class` all do. `import` bindings are also hoisted and initialised before the module body runs.

## Common Mistakes
- Saying `let` is "not hoisted". If it weren't, `console.log(x)` inside `test` would print `outer`.
- Expecting `show()` to log `inner` or throw, which confuses lexical scope with the call stack.
- Treating `typeof` as universally safe.

## Tips
- Use the phrase "hoisted but uninitialised". It is the precise answer and immediately signals you know the spec model.
