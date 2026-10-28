---
title: "Predict the output: async functions inside loops and forEach"
level: hard
type: output
tags: [async-await, loops, forEach, closures, output]
related: [javascript/sequential-vs-parallel-await, javascript/closure-loop-settimeout, javascript/async-output-order]
---

## Question
What does this log, and in what order?

```js
const sleep = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

async function run() {
  console.log("start");

  for (const ms of [30, 10]) {
    console.log("for", await sleep(ms, ms));
  }

  [30, 10].forEach(async (ms) => {
    console.log("forEach", await sleep(ms, ms));
  });

  console.log("end");
}

run();
console.log("after run");
```

## Clues
- What runs synchronously before the first `await` inside `run`?
- Does `await` inside `for...of` pause the loop? Does it inside a `forEach` callback?
- When do the `forEach` timers start relative to each other?

## Interview Answer
The output is `start`, `after run`, `for 30`, `for 10`, `end`, `forEach 10`, `forEach 30`. `run` logs `start` synchronously and then suspends at the first `await`, so `after run` is printed next. The `for...of` loop waits for each sleep in turn: 30 ms then 10 ms. Then the `forEach` starts two async callbacks without waiting for them, so `end` is logged immediately, and the two timers run concurrently, so the shorter 10 ms one prints before the 30 ms one.

## Explanation
### Timeline

```txt
t=0     start                 (sync)
t=0     after run             (run is suspended at its first await)
t=30    for 30
t=40    for 10
t=40    end                   (forEach callbacks started; run finishes)
t=50    forEach 10
t=70    forEach 30
```

The numbers are approximate, but the order is deterministic.

### Why
1. `run()` executes synchronously up to `await sleep(30, 30)`, so `start` logs, then control returns to the caller, which logs `after run`.
2. `for...of` awaits each promise, so the iterations are sequential.
3. `forEach` calls each async callback; each callback runs until its own `await`, then returns a promise that `forEach` ignores. Both timers start at the same moment, so they overlap. `end` follows immediately after the loop.
4. The 10 ms timer fires first, then the 30 ms one.

### Fix if you want the `forEach` work awaited

```js
await Promise.all([30, 10].map(async (ms) => {
  console.log("map", await sleep(ms, ms));
}));
console.log("end");   // now truly after both
```

(Order of the logs would be `map 10`, `map 30` since they are concurrent.)

## Follow-ups
- **How would you make the second loop sequential?** — Use `for...of` with `await`.
- **What if `run` were called with `await run()`?** — `after run` would only print after `run` finishes, i.e. later.

## Common Mistakes
- Believing `await` inside `forEach` pauses the loop.
- Forgetting `after run` prints before any `for` line.

## Tips
- Draw a small timeline with timestamps; it makes order obvious.
