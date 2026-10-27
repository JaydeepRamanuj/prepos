---
title: "Implement compose and pipe (and an async pipe)"
level: hard
type: implement
tags: [functions, composition, pipe, reduce, async]
related: [javascript/array-reduce-polyfill, javascript/currying, javascript/higher-order-functions]
---

## Question
Implement `compose(...fns)` and `pipe(...fns)`.

- `pipe(f, g, h)(x)` should equal `h(g(f(x)))`, running left to right.
- `compose(f, g, h)(x)` should equal `f(g(h(x)))`, running right to left.
- The first function to run may take multiple arguments. Every later one receives the previous result.

Then write `pipeAsync` where any step may return a promise.

```js
const slugify = pipe(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/\s+/g, "-"),
);
slugify("  Hello World "); // "hello-world"
```

## Clues
- You are turning a list of functions into one value by threading a result through them. Which array method folds a list into a single value?
- `pipe` folds from the left, and `compose` is the same thing folding from the right.
- For the async version, make the accumulator a promise and chain `.then` at each step.

## Interview Answer
Composition builds one function out of several, where the output of each becomes the input of the next. `pipe` is a `reduce` over the functions. The accumulator starts as the result of calling the first function with all the arguments, and each later function is applied to the accumulator. `compose` is the same with `reduceRight`, so the last function runs first. I keep `this` and support multiple initial arguments by calling the first function with `apply`. For the async version I start with `Promise.resolve(...)` and chain `.then(fn)` for each step, so sync and async steps both work, and any rejection skips the remaining steps.

## Explanation
### `pipe`: left to right

```js
function pipe(...fns) {
  if (fns.length === 0) return (x) => x; // identity: nothing to do

  return function piped(...args) {
    const [first, ...rest] = fns;
    // the first function may take several arguments
    const initial = first.apply(this, args);
    // thread the result through the remaining functions
    return rest.reduce((acc, fn) => fn.call(this, acc), initial);
  };
}
```

### `compose`: right to left

```js
function compose(...fns) {
  return pipe(...fns.slice().reverse()); // reuse pipe on a reversed copy
}
```

Or written directly with `reduceRight`:

```js
const compose = (...fns) =>
  fns.reduceRight((f, g) => (...args) => g(f(...args)));
// note: this short version throws on zero functions (reduce of empty array)
```

### The order, visually

```txt
pipe(a, b, c)(x)     x ─▶ a ─▶ b ─▶ c ─▶ result     (reads like a pipeline)
compose(a, b, c)(x)  x ─▶ c ─▶ b ─▶ a ─▶ result     (reads like math: a(b(c(x))))
```

`pipe` is usually easier to read in application code because steps appear in execution order. `compose` matches mathematical notation and older functional libraries (Redux's `compose` for enhancers, for example).

### Async pipe

```js
function pipeAsync(...fns) {
  return function (...args) {
    const [first, ...rest] = fns;
    // Promise.resolve wraps sync values and adopts promises
    return rest.reduce(
      (promise, fn) => promise.then((value) => fn.call(this, value)),
      Promise.resolve().then(() => first.apply(this, args)), // sync throws become rejections
    );
  };
}

const loadUser = pipeAsync(
  (id) => fetch(`/api/users/${id}`),
  (res) => res.json(),
  (user) => ({ ...user, fullName: `${user.first} ${user.last}` }),
);
```

Starting the chain with `Promise.resolve().then(...)` means that even if the first function throws synchronously, the caller gets a rejected promise instead of a thrown error. That gives a single error channel.

Equivalent with `async/await`, which some interviewers find clearer:

```js
const pipeAsync = (...fns) => async (...args) => {
  let value = await fns[0](...args);
  for (const fn of fns.slice(1)) value = await fn(value);
  return value;
};
```

### Edge cases
- **Zero functions:** return identity (`pipe()` gives `x => x`).
- **One function:** `pipe(f)` should behave exactly like `f`, including multiple arguments.
- **Non-function inputs:** validate up front (`if (fns.some(f => typeof f !== "function")) throw new TypeError(...)`) so the error points at the setup, not the first call.

### Complexity
Building the composed function is O(1) apart from copying the array. Each call is O(n) in the number of functions.

## Follow-ups
- **Where have you seen composition in real code?** — Redux `compose` for store enhancers, Express/Koa middleware chains, and data transformations like `pipe(normalize, validate, toPayload)`.
- **How does this relate to method chaining?** — `arr.filter().map()` is composition with methods. `pipe` lets you compose standalone functions that don't live on a prototype.
- **Is there a native pipe operator?** — There is a TC39 proposal for `|>`, but it has not been finalized, so you can't rely on it in standard JavaScript.

## Common Mistakes
- Getting the direction backwards: `compose` runs **right to left**.
- Passing all the original arguments to every function instead of only the previous result.
- In the async version, mixing `reduce` with `await` inside a non-async callback. The reducer returns promises, so you have to chain `.then` on the accumulator.

## Tips
- Write `pipe` first with `reduce`, then say "compose is pipe reversed". It's two minutes of code and shows you see the symmetry.
- Mnemonic: **pipe = reading order, compose = math order**.
