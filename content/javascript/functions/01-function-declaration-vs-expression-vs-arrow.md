---
title: "Function declarations vs function expressions vs arrow functions — what actually differs?"
level: easy
type: concept
tags: [functions, arrow-functions, hoisting, this]
related: [javascript/this-binding-rules, javascript/hoisting-function-var-output, javascript/higher-order-functions]
---

## Question
What is the difference between a function declaration, a function expression and an arrow function? When would you pick each one?

```js
function add(a, b) { return a + b; }          // declaration
const sub = function (a, b) { return a - b; }; // expression
const mul = (a, b) => a * b;                   // arrow
```

## Interview Answer
The three differ in hoisting and in what they bind. A function declaration is hoisted with its body, so I can call it before the line it appears on. A function expression is a value assigned to a variable, so only the variable is hoisted (`var` gives `undefined`, `let`/`const` give a TDZ error). Arrow functions are always expressions, and they have no own `this`, `arguments`, `super` or `new.target`. They take those from the enclosing scope, and they cannot be used with `new`. I use declarations for top-level named utilities, arrows for callbacks and anything inside a method that needs the outer `this`, and regular `function` for object methods, constructors, or wrappers like `debounce` where the caller's `this` must be kept.

## Explanation
### Side-by-side

| | Declaration | Expression | Arrow |
|---|---|---|---|
| Hoisted | name **and** body | only the variable binding | only the variable binding |
| Own `this` | yes (set by the call site) | yes (set by the call site) | no, it is lexical |
| `arguments` object | yes | yes | no (use `...rest`) |
| Callable with `new` | yes | yes | no (`TypeError`) |
| Has `prototype` | yes | yes | no |
| Implicit return | no | no | yes, for a single expression |

### Hoisting in practice

```js
console.log(square(3)); // 9: the declaration is hoisted with its body
function square(n) { return n * n; }

console.log(cube(3));   // ReferenceError: cube is in the TDZ
const cube = (n) => n ** 3;
```

### The `this` difference is the important one

```js
const counter = {
  count: 0,
  start() {
    // Arrow: `this` comes from start(), which is counter
    setInterval(() => { this.count++; }, 1000);
  },
  broken() {
    // Regular function: `this` is set by whoever calls it (the timer), so it is undefined in strict mode or globalThis in sloppy mode
    setInterval(function () { this.count++; }, 1000);
  },
};
```

The rule of thumb is that arrow functions **inherit** `this`, while regular functions **receive** `this` from the call site. That makes an arrow a bad choice for an object method:

```js
const user = {
  name: "Asha",
  greet: () => `Hi ${this.name}`, // `this` is the module/global scope, not user
};
```

### Named function expressions
`const fact = function inner(n) { return n <= 1 ? 1 : n * inner(n - 1); };` The name `inner` is visible only inside the function. It makes recursion safe even if `fact` is reassigned, and it shows up in stack traces.

### Returning an object from an arrow
Wrap it in parentheses. Otherwise the braces are read as a function body:

```js
const toUser = (name) => ({ name }); // returns an object
const oops = (name) => { name };      // returns undefined
```

## Follow-ups
- **Can you use an arrow function as a class method?** — Yes, as a class field (`handleClick = () => {}`). It binds `this` to the instance, but every instance gets its own copy instead of sharing one on the prototype.
- **Does `bind` change an arrow function's `this`?** — No. `call`, `apply` and `bind` cannot override the lexical `this` of an arrow. Only the arguments are passed through.
- **Why did React class components need `this.handleClick = this.handleClick.bind(this)`?** — Passing `this.handleClick` as `onClick` detaches it from the instance, so `this` became undefined. Arrow class fields or `bind` fixed that.

## Common Mistakes
- Saying arrow functions "bind `this` to the object they are defined in". They capture `this` from the surrounding **function scope**, and an object literal is not a scope.
- Assuming function expressions are hoisted like declarations.
- Using `arguments` inside an arrow and getting the outer function's arguments (or a ReferenceError at module top level).

## Tips
- Lead with the `this` difference, because that is what the interviewer wants to hear. Hoisting and `new` are the supporting points.
- Mnemonic: **arrows borrow, functions receive**. Arrows borrow `this` from outside, while regular functions receive it from the call.
