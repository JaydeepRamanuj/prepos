---
title: "What is the difference between call, apply and bind?"
level: medium
type: concept
tags: [call, apply, bind, this, partial-application]
related: [javascript/this-binding-rules, javascript/function-bind-polyfill, javascript/arrow-functions-this]
---

## Question
How do `call`, `apply` and `bind` differ? When would you use each, and what happens when you call `bind` on an already-bound function?

## Interview Answer
All three set `this` explicitly. `call(thisArg, a, b)` invokes the function immediately with arguments listed out, `apply(thisArg, [a, b])` invokes it immediately with arguments in an array, and `bind(thisArg, a)` does not invoke — it returns a new function with `this` permanently fixed and optionally some leading arguments preset, which is partial application. Bound functions cannot be rebound: a second `bind` or `call` cannot change `this`. With spread syntax, `apply` is rarely needed today, but `call` is still common for borrowing methods, and `bind` for passing methods as callbacks.

## Explanation
### Side by side

```js
function greet(greeting, punct) {
  return `${greeting}, ${this.name}${punct}`;
}
const user = { name: "Asha" };

greet.call(user, "Hi", "!");      // "Hi, Asha!"
greet.apply(user, ["Hi", "!"]);   // "Hi, Asha!"
const hi = greet.bind(user, "Hi");
hi("?");                          // "Hi, Asha?"  (partial application)
```

Memory trick: **A**pply takes an **A**rray; **C**all takes **C**ommas.

### Use cases
- Borrowing methods: `Array.prototype.slice.call(arguments)` (modern: `Array.from` or rest params).
- Max of array: `Math.max.apply(null, arr)` → `Math.max(...arr)`.
- Fixing `this` for callbacks: `el.addEventListener("click", this.onClick.bind(this))`.
- Presetting arguments: `const add5 = add.bind(null, 5)`.

### Bound functions are final

```js
const b = greet.bind({ name: "A" }, "Hi");
b.call({ name: "B" }, "!");   // still "Hi, A!"
```

Exception: `new b()` ignores the bound `this` and creates a fresh object (the preset arguments still apply).

### Details
- A bound function has no `prototype`; `b.name` is `"bound greet"`; `b.length` is reduced by the preset args.
- Arrow functions ignore `thisArg` in `call/apply/bind`; only the arguments of `bind` still apply.
- Passing `null` or `undefined` as `thisArg` yields the global object in sloppy mode, `undefined` in strict mode.

## Follow-ups
- **Which creates a new function?** — Only `bind`.
- **How would you implement `bind`?** — Return a closure that calls `fn.apply(thisArg, [...preset, ...args])`, and handle `new` (see the bind polyfill question).

## Common Mistakes
- Expecting `bind` to call the function.
- Trying to re-bind an already bound function.

## Tips
- Mention that `bind` doubles as partial application and that arrow functions make most `bind(this)` uses unnecessary.
