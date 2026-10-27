---
title: "What is currying, how is it different from partial application, and when is it actually useful?"
level: medium
type: concept
tags: [functions, currying, partial-application, closures]
related: [javascript/curry-variadic, javascript/closure, javascript/compose-pipe, javascript/function-bind-polyfill]
---

## Question
Explain currying with an example. How is it different from partial application? Where would you actually use it in a frontend codebase?

## Interview Answer
Currying turns a function that takes several arguments into a chain of functions that each take one, so `add(a, b, c)` becomes `add(a)(b)(c)`. Each call returns a new function that remembers the earlier arguments through a closure. Partial application is the broader idea: you fix *some* arguments now and get back a function that takes the rest. `fn.bind(null, x)` is partial application. In real code the value is that I can pre-configure a general function into specific ones, like `const log = createLogger("auth")` or `const onChange = (field) => (e) => setForm(...)`, and curried functions slot neatly into `map`, `filter` and `compose` pipelines because those want one-argument functions. I avoid deep manual currying in app code when it hurts readability.

## Explanation
### Currying vs partial application

```js
// Normal
const volume = (l, w, h) => l * w * h;

// Curried: one argument at a time
const volumeC = (l) => (w) => (h) => l * w * h;
volumeC(2)(3)(4); // 24

// Partial application: fix some arguments, take the rest together
const baseArea6 = volume.bind(null, 2, 3);
baseArea6(4); // 24
```

| | Currying | Partial application |
|---|---|---|
| Result | a chain of unary functions | one function taking the remaining arguments |
| Arguments per call | exactly one (strict) | any number |
| Typical tool | manual arrows, `curry()` helper | `bind`, a wrapper function |

A generic `curry(fn)` helper (see the implementation question) usually allows *either* style: `f(1)(2)(3)`, `f(1, 2)(3)` or `f(1, 2, 3)`. Technically that is "auto-currying".

### How it works: closures
Each returned function closes over the arguments collected so far:

```txt
volumeC(2)        → closure { l: 2 }       returns w => ...
          (3)     → closure { l: 2, w: 3 } returns h => ...
             (4)  → computes 2 * 3 * 4
```

### Where it is genuinely useful
**1. Event handler factories in React**

```tsx
const handleChange = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
  setForm((f) => ({ ...f, [field]: e.target.value }));

<input onChange={handleChange("email")} />
<input onChange={handleChange("name")} />
```

**2. Configuring once, using many times**

```js
const request = (baseUrl) => (path) => fetch(`${baseUrl}${path}`).then((r) => r.json());
const api = request("https://api.example.com");
api("/users");
api("/orders");
```

**3. Building blocks for `map`/`filter`/`pipe`**

```js
const hasRole = (role) => (user) => user.roles.includes(role);
const admins = users.filter(hasRole("admin"));
```

Without currying you would write `users.filter((u) => hasRole("admin", u))` every time.

### When not to use it
- Deep chains like `f(a)(b)(c)(d)` are harder to read and debug, and stack traces show anonymous functions.
- TypeScript inference for a generic `curry` helper is complicated. Hand-written curried arrows type cleanly.

## Follow-ups
- **What is the arity of a function, and how does a `curry` helper know when to stop?** — `fn.length` is the number of declared parameters before any default or rest parameter. The helper calls `fn` once it has collected that many arguments.
- **How would you make `sum(1)(2)(3)()` work for any number of calls?** — Return a function that accumulates until it is called with no arguments, then returns the total. This is the "infinite currying" variant.
- **Is currying the same as a closure?** — No. Currying is a technique that *uses* closures to remember earlier arguments.

## Common Mistakes
- Using "currying" and "partial application" as synonyms.
- Relying on `fn.length` for functions with default or rest parameters, where it returns a smaller number than you expect.
- Curry-ing everything "because it's functional" and making simple code harder to follow.

## Tips
- The `handleChange(field)` React example is the strongest one to give. Every interviewer has written that pattern, and it shows currying is practical, not academic.
