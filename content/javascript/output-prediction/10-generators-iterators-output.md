---
title: "Predict the output: generator control flow with next(value) and return"
level: advanced
type: output
tags: [generators, iterators, yield, output, finally]
related: [javascript/iterators-generators, javascript/async-await-under-the-hood, javascript/symbols-well-known]
---

## Question
What does this log?

```js
function* gen() {
  try {
    const a = yield 1;
    console.log("a =", a);
    const b = yield a * 2;
    console.log("b =", b);
    return "done";
  } finally {
    console.log("cleanup");
  }
}

const g = gen();
console.log(g.next("ignored"));
console.log(g.next(10));
console.log(g.return("early"));
console.log(g.next());

for (const v of gen()) {
  console.log("loop", v);
  break;
}
```

## Clues
- Code does not run until the first `next()`; the argument of the first `next` has nowhere to go.
- `yield` is an expression whose value is the argument passed to the *next* `next()` call.
- `return()` triggers `finally` blocks, and `break` in `for...of` calls `return()` too.

## Interview Answer
The log is: `{ value: 1, done: false }`, then `a = 10` followed by `{ value: 20, done: false }`, then `cleanup` followed by `{ value: 'early', done: true }`, then `{ value: undefined, done: true }`, and finally `loop 1` then `cleanup`. The first `next` starts the generator and runs to `yield 1`; its argument is discarded. The second `next(10)` makes that `yield` evaluate to 10, so it logs `a = 10` and yields 20. `return("early")` forces completion at the paused `yield`, running `finally`. Calling `next()` on a finished generator returns `done: true` with `undefined`. In the loop, `break` calls `return()` on the iterator, so `cleanup` is logged.

## Explanation
### Step by step

| Call | What happens | Output |
|---|---|---|
| `g.next("ignored")` | start; run to `yield 1` | `{ value: 1, done: false }` |
| `g.next(10)` | `a = 10`; log; run to `yield a*2` | logs `a = 10`, then `{ value: 20, done: false }` |
| `g.return("early")` | generator is completed at the yield; `finally` runs | logs `cleanup`, then `{ value: "early", done: true }` |
| `g.next()` | already finished | `{ value: undefined, done: true }` |
| `for...of` + `break` | first value 1, then `return()` | logs `loop 1`, then `cleanup` |

The `"b ="` line never prints, because the generator is closed before the second `yield` resumes.

```txt
{ value: 1, done: false }
a = 10
{ value: 20, done: false }
cleanup
{ value: 'early', done: true }
{ value: undefined, done: true }
loop 1
cleanup
```

### Key rules
- The argument to the first `next()` is ignored.
- `yield` produces a value outward and evaluates to the next `next()` argument inward.
- `return(v)` finishes the generator, running `finally`; if `finally` itself yields, the generator can continue.
- `throw(e)` injects an exception at the paused `yield`.
- `for...of` closes iterators on early exit, which is how resources (files, streams) get released.

## Follow-ups
- **What does `yield*` do?** — Delegates to another iterable and evaluates to its return value.
- **What if the generator `return`s a value normally?** — It appears as `{ value, done: true }` and is skipped by `for...of`.

## Common Mistakes
- Expecting the first `next(value)` to pass the value in.
- Forgetting that `break` triggers `finally`.

## Tips
- Keep a table of state at each `next()` call; it prevents mixing up inward and outward values.
