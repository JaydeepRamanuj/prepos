---
title: "Closures in loops: what do var, let and setTimeout log here?"
level: medium
type: output
tags: [closures, loops, var, let, settimeout, output]
related: [javascript/closure, javascript/event-loop-order-output, javascript/tdz-shadowing-output]
---

## Question
What does this print, in order?

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var", i), 0);
}

for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let", j), 0);
}

for (var k = 0; k < 3; k++) {
  setTimeout(console.log, 0, "arg", k);
}

const fns = [];
for (let m = 0; m < 3; m++) {
  fns.push(() => m);
  m++;
}
console.log(fns.map((f) => f()));
```

## Interview Answer
It prints `[ 1, 3 ]` first, because that line is synchronous and every timer waits for the call stack to empty. Then come `var 3` three times, `let 0`, `let 1`, `let 2`, and finally `arg 0`, `arg 1`, `arg 2`. With `var` there is one function-scoped `i` that all three closures share, and by the time the timers run the loop has left it at 3. With `let`, every iteration gets a fresh binding, so each closure captures its own value. The `k` loop works despite `var` because `setTimeout`'s extra arguments are evaluated when the timer is *scheduled*. The `m` loop is the trap: the closure captures the iteration's binding, not a snapshot, so the `m++` inside the body changes what that closure later sees.

## Explanation
### Exact output

```txt
[ 1, 3 ]
var 3
var 3
var 3
let 0
let 1
let 2
arg 0
arg 1
arg 2
```

(Node prints the array as `[ 1, 3 ]`, and browsers show `[1, 3]`.)

### Step 1: synchronous code runs first
All three loops only *schedule* timers. The `fns` loop and the final `console.log` are synchronous, so the array prints before any timer callback. The timers then fire in the order they were scheduled, because they all have the same 0 ms delay.

### Step 2: the `var` loop
`var i` is hoisted to the enclosing function (or global) scope, so there is **one** `i`:

```txt
closure#1 ─┐
closure#2 ─┼──▶  i  (single binding, ends at 3)
closure#3 ─┘
```

The loop stops when `i < 3` fails, which is when `i === 3`. Each callback reads `i` when it runs, not when it was created, so they all see `3`.

### Step 3: the `let` loop
For `let` in a `for` header, the spec creates a **new binding per iteration** and copies the previous value into it before the increment runs. Each arrow closes over a different `j`, holding 0, 1 and 2.

### Step 4: `setTimeout(fn, delay, ...args)`
Arguments after the delay are passed to the callback. They are evaluated immediately, so `k` is read as 0, 1 and 2 at scheduling time. That is why this `var` loop "works".

### Step 5: the `m` loop, where closures capture bindings, not values
- Iteration 1: binding `m = 0`. Push a closure over it. `m++` makes **this binding** 1.
- The loop copies 1 into a new binding, then runs `m++` from the header, giving 2. `2 < 3`, so the body runs.
- Iteration 2: binding `m = 2`. Push a closure. `m++` makes it 3.
- Copy 3 into a new binding, increment to 4, `4 < 3` fails, and the loop ends.

The closures read their own bindings, which now hold 1 and 3, so the result is `[1, 3]`.

### The pre-ES6 fix
Before `let`, people created a scope per iteration with an IIFE:

```js
for (var i = 0; i < 3; i++) {
  ((i) => setTimeout(() => console.log(i), 0))(i);
}
```

## Follow-ups
- **What if the timers had different delays, like `i * 100`?** — The delay is computed at scheduling time (0, 100, 200), but the logged value is still read at run time, so `var` still prints 3 three times, just spread out.
- **Does `for...of` with `const` also create a fresh binding?** — Yes. `for (const x of arr)` creates a new binding each iteration, so closures capture each element.
- **Where does this bite in React?** — Handlers created in loops or effects that read a variable later than you expect. That is the same root cause as stale closures.

## Common Mistakes
- Saying `let` "copies the value into the closure". It creates a new binding per iteration, and the closure still sees later mutations of *that* binding, as the `m` loop shows.
- Expecting `var 0 1 2` because the delay is 0. A delay of 0 still means "after the current script finishes".
- Forgetting that synchronous logs come before every timer.

## Tips
- Draw the "one box vs three boxes" picture. It explains both the `var` and `let` behaviour in five seconds.
- Mention the `setTimeout` extra-arguments trick. Few candidates know it, and it shows you understand *when* expressions are evaluated.
