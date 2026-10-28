---
title: "Implement curry for fixed arity, placeholders and infinite sum"
level: hard
type: implement
tags: [currying, closures, function-length, partial-application]
related: [javascript/currying, javascript/function-bind-polyfill, javascript/compose-pipe]
---

## Question
Implement `curry(fn)` so `curry(add)(1)(2)(3)`, `curry(add)(1, 2)(3)` and `curry(add)(1)(2, 3)` all work for `add(a, b, c)`. Then implement an `sum(1)(2)(3)()` style function where the call without arguments returns the total.

```js
const add3 = (a, b, c) => a + b + c;
curry(add3)(1)(2)(3);     // 6
curry(add3)(1, 2)(3);     // 6
sum(1)(2)(3)();           // 6
```

## Clues
- A function's `length` property tells you how many parameters it declares.
- Collect arguments across calls until you have enough.
- For the infinite version there is no arity to rely on: what signals "done"?

## Interview Answer
For fixed arity I use `fn.length`. The curried function collects arguments in a closure; when it has at least `fn.length`, it calls `fn` with them, otherwise it returns a new function that accumulates more. Because each step returns a fresh function with its own captured arguments, partial applications are reusable. `fn.length` ignores default and rest parameters, so for variadic functions I need an explicit arity. For `sum(1)(2)(3)()`, there is no arity, so an empty call (or `valueOf`/`toString` coercion) is the terminator.

## Explanation
### Fixed arity

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function (...next) {
      return curried.apply(this, [...args, ...next]);   // new closure each step
    };
  };
}

const add3 = (a, b, c) => a + b + c;
const c = curry(add3);
const plus1 = c(1);
plus1(2)(3);     // 6
plus1(5, 5);     // 11   plus1 is reusable
```

### Explicit arity (for rest or default params)

```js
const curryN = (fn, n = fn.length) =>
  function curried(...args) {
    return args.length >= n
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  };

const sumAll = (...nums) => nums.reduce((a, b) => a + b, 0);
curryN(sumAll, 3)(1)(2)(3);   // 6
```

### Infinite currying with a terminator

```js
function sum(a) {
  return function next(b) {
    if (b === undefined) return a;     // empty call ends the chain
    return sum(a + b);
  };
}
sum(1)(2)(3)();   // 6
```

Alternative using coercion, so `+sum(1)(2)(3)` works:

```js
function sum2(a) {
  const f = (b) => sum2(a + b);
  f.valueOf = () => a;
  f.toString = () => String(a);
  return f;
}
+sum2(1)(2)(3);   // 6
```

### Placeholder support (lodash style)
Use a sentinel `curry.placeholder = Symbol()` and merge new arguments into the earlier holes before checking arity. It is a common follow-up; the structure is the same, with a merge step.

### Currying vs partial application

| | Currying | Partial application |
|---|---|---|
| Transforms | `f(a,b,c)` to `f(a)(b)(c)` | fixes some arguments of `f` |
| Result | chain of unary-ish functions | function with fewer params |
| Tool | `curry` | `fn.bind(null, a)` |

### Use cases
Reusable configured functions (`const fetchFrom = curry(fetchJson)(baseUrl)`), function composition pipelines, point-free style with `map`.

### Pitfalls
- `fn.length` is 0 for `(...args) => {}` and excludes parameters after the first default value.
- Extra arguments beyond arity are passed through to `fn`.
- Each partial call allocates a closure; fine for application code, avoid in hot loops.

## Follow-ups
- **Why does `curry(fn)` lose `this`?** — The arrow wrappers in `curryN` ignore it; the first version forwards `this` via `apply`.
- **Does Array.prototype.map(curriedFn) work?** — It passes `(el, i, arr)`, which can trigger early execution; wrap the call.

## Common Mistakes
- Using `arguments.length` of the wrong call instead of accumulated arguments.
- Mutating one shared `args` array so partials interfere.

## Tips
- Mention `fn.length` and its limits unprompted.
