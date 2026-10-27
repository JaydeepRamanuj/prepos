---
title: "Why does a var loop with setTimeout print 3, 3, 3 — and how do you fix it?"
level: medium
type: output
tags: [closures, var, let, settimeout, loops]
related: [javascript/closure, javascript/var-let-const, javascript/iife-module-pattern, javascript/event-loop-basics]
---

## Question
What does this print? Give at least three ways to make it print `0 1 2`.

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
```

## Interview Answer
It prints `3`, `3`, `3`. There is a single `var i` for the whole function, and all three arrow functions close over that same variable. The loop finishes synchronously long before the timers fire, and by then `i` has been incremented to `3`, which is the value that broke the loop condition. The cleanest fix is `let i`, because a `let` in a `for` header creates a fresh binding for every iteration, so each callback closes over its own copy. Older fixes create a new scope per iteration with an IIFE, or pass `i` through `setTimeout`'s extra arguments, or use `forEach`, whose callback gets a fresh parameter each time.

## Explanation
### Why 3, 3, 3

```txt
time 0ms : i=0 → schedule cb   (cb reads variable i later)
           i=1 → schedule cb
           i=2 → schedule cb
           i=3 → loop ends
time 100ms: cb → i is 3   cb → 3   cb → 3
```

Two facts combine: closures capture the **variable**, not its value, and `setTimeout` callbacks run only after the current synchronous code (the whole loop) finishes.

### Fix 1 — `let` (preferred)

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100); // 0 1 2
}
```

The spec copies the loop variable into a new environment on each iteration, so each callback's closure points to a different `i`.

### Fix 2 — IIFE (the pre-ES2015 answer)

```js
for (var i = 0; i < 3; i++) {
  ((j) => {
    setTimeout(() => console.log(j), 100);
  })(i);
}
```

Calling a function creates a new scope; `j` is a parameter bound to the current value of `i`.

### Fix 3 — pass the value as an argument

```js
for (var i = 0; i < 3; i++) {
  setTimeout((j) => console.log(j), 100, i); // extra args are passed to the callback
}
```

### Fix 4 — `forEach` / a helper function

```js
[0, 1, 2].forEach((i) => setTimeout(() => console.log(i), 100));
```

### A variant that catches people

```js
const fns = [];
for (let i = 0; i < 3; i++) {
  fns.push(() => i);
  i++;
}
console.log(fns.map((f) => f())); // [1, 3]
```

Each iteration does get its own `i`, but the closure still sees *mutations to that iteration's binding*. The first iteration's `i` became `1` before the copy to the next iteration; the second iteration's `i` went from 2 to 3.

### And with different delays?

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), i * 1000);
```

Still `3 3 3` (one second apart). The delay is computed with the current `i` when scheduling, but the callback body reads `i` when it runs.

## Follow-ups
- **What would `const` in the `for` header do?** — `for (const i = 0; i < 3; i++)` throws a `TypeError` on `i++`. `const` works in `for...of` and `for...in` because they never reassign.
- **Does this happen with `await` inside a loop?** — The same capture rules apply to any deferred callback: promises, event listeners, `requestAnimationFrame`.
- **Why does `let` cost nothing extra?** — Engines only allocate per-iteration environments when a closure actually captures the variable.

## Common Mistakes
- Saying it prints `2 2 2` — the final value is `3`, the one that fails `i < 3`.
- Explaining it only as "setTimeout is async" without mentioning the shared variable; the closure is the real cause.
- Claiming the `let` fix works because `let` is "block-scoped" without mentioning the per-iteration binding.

## Tips
- Answer in this order: output → shared `var` + event loop → `let` fix → IIFE fix. Four sentences cover it.
- If asked "without `let`", reach for the IIFE first — that is what the interviewer is fishing for.
