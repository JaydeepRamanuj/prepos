---
title: "Predict `this` at every call site: methods, detached calls, arrows, bind, new"
level: hard
type: output
tags: [this, arrow-functions, bind, call, strict-mode, output]
related: [javascript/this-binding-rules, javascript/function-bind-polyfill, javascript/function-declaration-vs-expression-vs-arrow]
---

## Question
This file runs as an ES module, so it is in strict mode. What does each line log?

```js
const user = {
  name: "Asha",
  regular() {
    return this?.name;
  },
  arrow: () => typeof this,
  nested() {
    const inner = () => this.name;
    return inner();
  },
  callback() {
    return [1].map(function () {
      return this?.name;
    })[0];
  },
};

const { regular } = user;
console.log(user.regular());
console.log(regular());
console.log(user.arrow());
console.log(user.nested());
console.log(user.callback());
console.log(regular.call({ name: "Ravi" }));

const bound = user.regular.bind({ name: "Meera" });
console.log(bound.call({ name: "Ravi" }));
console.log(new (function () { this.name = "Dev"; })().name);

const admin = { name: "Kiran", regular: user.regular };
console.log(admin.regular());
```

## Clues
- For a regular function, ignore where it was defined and look only at how it is *called*: `obj.fn()`, `fn()`, `fn.call(x)`, `new fn()`.
- An arrow function has no `this` of its own. Find the nearest enclosing regular function, or the module top level.
- `bind` creates a function whose `this` cannot be changed later by `call` or `apply`, but `new` can still override it.

## Interview Answer
The output is `Asha`, `undefined`, `undefined`, `Asha`, `undefined`, `Ravi`, `Meera`, `Dev`, `Kiran`. For regular functions, `this` is decided at the call site. `user.regular()` is a method call, so `this` is `user`. Destructuring `regular` out and calling it bare leaves `this` as `undefined` in strict mode. The arrow property has no own `this` and the object literal is not a scope, so it uses the module's top-level `this`, which is `undefined`. `nested`'s inner arrow inherits `nested`'s `this`, which is `user`. The `map` callback is a plain function called with no `thisArg`, so it gets `undefined`. `call` sets `this` explicitly, `bind` beats a later `call`, `new` creates a fresh object, and borrowing the method onto `admin` makes `admin` the receiver.

## Explanation
### Exact output

```txt
Asha
undefined
undefined
Asha
undefined
Ravi
Meera
Dev
Kiran
```

### The rules, in priority order

| Call form | `this` |
|---|---|
| `new fn()` | the newly created object |
| `bound()` (made by `bind`) | the bound value, which `call`/`apply` cannot change |
| `fn.call(x)` / `fn.apply(x)` | `x` |
| `obj.fn()` | `obj`, the object left of the dot at call time |
| `fn()` | `undefined` in strict mode, `globalThis` in sloppy mode |
| arrow function | `this` of the enclosing scope, ignoring all of the above |

### Line by line
1. **`user.regular()`** gives `Asha`, an implicit binding through the method call.
2. **`regular()`** gives `undefined`. Destructuring copies the function reference, and the call has no receiver. In strict mode `this` is `undefined`, and `this?.name` is `undefined` instead of throwing. Without `?.` it would be a `TypeError`.
3. **`user.arrow()`** gives `"undefined"`. The arrow captured `this` where the object literal was evaluated, which is module top level, where `this` is `undefined`. In a classic browser script it would be `window` (`"object"`). In a CommonJS file it is `module.exports` (`"object"`).
4. **`user.nested()`** gives `Asha`. `nested` is called as a method, and the inner arrow inherits that `this`.
5. **`user.callback()`** gives `undefined`. `map` calls the callback as a plain function unless you pass a second `thisArg`. This is the classic "lost `this` in a callback" bug, and the fix is an arrow function.
6. **`regular.call({ name: "Ravi" })`** gives `Ravi`, an explicit binding.
7. **`bound.call(...)`** gives `Meera`. A bound function ignores the `this` passed to `call`. Only the arguments get through.
8. **`new (function () {...})()`** gives `Dev`. `new` creates an object, binds `this` to it, runs the body, and returns the object.
9. **`admin.regular()`** gives `Kiran`. The function is shared, and the receiver at call time decides `this`.

### The mental model

```txt
regular function:  this = "who called me?"   (decided at call time)
arrow function:    this = "where was I born?" (decided at definition time)
```

## Follow-ups
- **How do you fix the `map` callback?** — Use an arrow (`[1].map(() => this.name)`), pass a `thisArg` (`map(fn, this)`), or `bind`.
- **What happens with `setTimeout(user.regular, 0)`?** — The function is passed detached and called without a receiver, so `this` is `undefined` in strict code. In a browser, timers call the callback with `window` as `this` when the function is sloppy-mode.
- **Can `new` override a bound `this`?** — Yes. `new boundFn()` ignores the bound `this` and creates a new object, which is why a correct `bind` polyfill checks `new.target`.

## Common Mistakes
- Thinking the object literal gives the arrow its `this`. Only functions (and modules/scripts) create a `this` context.
- Saying a detached call gets `window`. That is only true in sloppy mode. Modules, classes and `"use strict"` give `undefined`.
- Assuming `call` can rebind a bound function.

## Tips
- Answer each line with the rule's name: implicit, default, explicit, hard (`bind`), `new`, or lexical. Naming the rules shows you are applying a system, not guessing.
