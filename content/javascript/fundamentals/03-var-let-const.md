---
title: "What are the differences between var, let and const?"
level: medium
type: concept
tags: [var, let, const, scope, hoisting]
related: [javascript/hoisting, javascript/temporal-dead-zone, javascript/closure-loop-settimeout]
---

## Question
Explain the differences between `var`, `let` and `const`. Cover scope, hoisting, redeclaration, the global object, and whether `const` makes a value immutable.

## Interview Answer
`var` is function-scoped, while `let` and `const` are block-scoped, so a `var` inside an `if` or `for` leaks out to the whole function. All three are hoisted, but `var` is initialised to `undefined` at the start of its scope, whereas `let` and `const` stay uninitialised in the temporal dead zone until their declaration runs — touching them earlier throws a `ReferenceError`. `var` can be redeclared in the same scope; `let` and `const` cannot. A top-level `var` in a classic script also becomes a property of `window`, which `let`/`const` do not. `const` only prevents *reassignment of the binding* — the object it points to can still be mutated. My default is `const`, `let` when I genuinely reassign, and never `var`.

## Explanation
### The comparison

| | `var` | `let` | `const` |
|---|---|---|---|
| Scope | function | block | block |
| Hoisted | yes, initialised to `undefined` | yes, uninitialised (TDZ) | yes, uninitialised (TDZ) |
| Redeclare in same scope | allowed | SyntaxError | SyntaxError |
| Reassign | yes | yes | TypeError |
| Must initialise | no | no | yes |
| Top-level → `window` property (scripts) | yes | no | no |
| New binding per loop iteration | no | yes | yes (`for...of`) |

### Block scope in action

```js
function demo() {
  if (true) {
    var a = 1;
    let b = 2;
  }
  console.log(a); // 1 — var ignores the block
  console.log(b); // ReferenceError: b is not defined
}
```

### `const` is not immutability

```js
const user = { name: "Asha" };
user.name = "Ravi";      // fine — mutating the object
user = {};               // TypeError: Assignment to constant variable.

const frozen = Object.freeze({ name: "Asha" });
frozen.name = "Ravi";    // silently ignored (throws in strict mode)
```

`const` protects the *variable*; `Object.freeze` protects the *object* (shallowly).

### The loop difference that matters
`let` in a `for` header creates a fresh binding for every iteration, so closures capture different values:

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i)); // 3 3 3
for (let j = 0; j < 3; j++) setTimeout(() => console.log(j)); // 0 1 2
```

### The global object
In a classic `<script>`, `var x = 1` creates `window.x`. That is how two scripts can accidentally overwrite each other's globals. Inside ES modules there is no such leak — every top-level declaration is module-scoped.

## Follow-ups
- **Why does `const` in a `for (let i...)` loop fail but work in `for...of`?** — The classic `for` increments the variable (`i++` reassigns it); `for...of` creates a brand-new binding per iteration and never reassigns it.
- **Is `let` slower than `var`?** — Not meaningfully in modern engines; TDZ checks are usually optimised away.
- **Why would you ever still see `var`?** — Legacy code and older transpiler output; there is no reason to choose it in new code.

## Common Mistakes
- Saying `let`/`const` are "not hoisted" — they are hoisted; they are just not initialised (that is the TDZ).
- Believing `const` objects are immutable.
- Forgetting that `var` in a block still pollutes the enclosing function.

## Tips
- Structure your answer on four axes: **scope, hoisting, redeclaration, reassignment** — then add the loop example as proof.
- Say your team rule out loud ("`const` by default, `let` when needed, no `var`") — it signals practical experience.
