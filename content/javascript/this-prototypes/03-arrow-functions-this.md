---
title: "How do arrow functions differ from regular functions regarding `this`?"
level: medium
type: concept
tags: [arrow-functions, this, lexical-this, arguments]
related: [javascript/this-binding-rules, javascript/function-declaration-vs-expression-vs-arrow, javascript/call-apply-bind]
---

## Question
What does it mean that arrow functions have lexical `this`? What other differences exist, and when should you avoid arrow functions?

## Interview Answer
An arrow function has no `this` of its own. It resolves `this` like any other variable, from the enclosing scope where it was created, and that cannot be changed by `call`, `apply`, `bind` or how it is invoked. That makes arrows ideal for callbacks inside methods, like `setTimeout` or `map`, where I want the method's `this`. They also have no `arguments`, no `prototype`, cannot be used with `new`, and cannot be generators. I avoid arrows for object methods that rely on `this`, for prototype methods, and for DOM handlers where I need the element via `this`.

## Explanation
### Lexical this

```js
const timer = {
  seconds: 0,
  start() {
    setInterval(() => {
      this.seconds++;          // `this` is timer, from start()
    }, 1000);
  },
};
```

With `function () {}` there, `this` would be undefined (strict) or `window`.

### Where it goes wrong

```js
const user = {
  name: "Asha",
  hi: () => this?.name,     // `this` here is the surrounding module/global scope
  hello() { return this.name; },
};
user.hi();    // undefined
user.hello(); // "Asha"
```

An object literal is not a scope, so an arrow property does not get the object as `this`.

### Class fields

```js
class Button {
  count = 0;
  onClick = () => { this.count++; };   // arrow in a field: this = instance, per-instance function
}
```

Convenient for passing handlers, but each instance gets its own function instead of sharing a prototype method.

### Comparison

| Feature | Regular function | Arrow |
|---|---|---|
| Own `this` | yes, call-site dependent | no, lexical |
| `arguments` | yes | no (use rest params) |
| `new` | yes | TypeError |
| `prototype` | yes | none |
| `call/apply/bind` change `this` | yes | no |

### Gotcha
Arrow in the global/module scope: `this` is `undefined` in modules, `window` in classic scripts.

## Follow-ups
- **Can you `bind` an arrow function?** — You can call it, but `this` stays lexical.
- **Why use class field arrows in React class components?** — To avoid binding in the constructor.

## Common Mistakes
- Using an arrow as an object method and expecting `this` to be the object.
- Expecting `arguments` inside an arrow to be its own (it comes from the outer function).

## Tips
- "Arrow functions don't bind `this`, they look it up" is the one-liner.
