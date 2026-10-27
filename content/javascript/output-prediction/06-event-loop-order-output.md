---
title: "Predict the output: nested promises, timers and a rejected chain"
level: hard
type: output
tags: [event-loop, promises, setTimeout, microtasks, output]
related: [javascript/microtasks-vs-macrotasks, javascript/async-output-order, javascript/promise-chaining-error-handling]
---

## Question
What does this log, and in what order?

```js
setTimeout(() => console.log("timeout 1"), 0);

Promise.resolve()
  .then(() => {
    console.log("then 1");
    setTimeout(() => console.log("timeout 2"), 0);
    return Promise.resolve("value");
  })
  .then((v) => console.log("then 2", v));

Promise.reject(new Error("x"))
  .catch(() => console.log("catch"))
  .finally(() => console.log("finally"));

console.log("sync");
```

## Clues
- Start with everything that logs synchronously, then queue microtasks in the order they are registered.
- Returning a promise from a `.then` callback delays the next `.then` by extra microtask ticks.
- Timers are tasks; new timers created inside microtasks go to the back of the line.

## Interview Answer
The order is `sync`, `then 1`, `catch`, `finally`, `then 2 value`, `timeout 1`, `timeout 2`. After the script, the microtask queue holds `then 1` and `catch`, in registration order. `then 1` runs, schedules `timeout 2` and returns a promise, which makes the next link wait extra ticks. `catch` runs and queues `finally`, which runs before `then 2` because returning a promise from a handler adds two extra microtask turns. After the microtasks are drained, the timers fire in the order they were created: `timeout 1`, then `timeout 2`.

## Explanation
### Walkthrough

| Step | Action | Queue after |
|---|---|---|
| script | schedule `timeout 1` (task) | tasks: [t1] |
| script | `.then` on resolved promise | micro: [then1] |
| script | `Promise.reject(...).catch` | micro: [then1, catch] |
| script | log `sync` | — |
| micro | `then1` logs, schedules `timeout 2`, returns promise | tasks: [t1, t2] |
| micro | `catch` logs → `finally` queued | micro: [finally, …adoption job] |
| micro | `finally` logs | — |
| micro | adoption of the returned promise finishes → `then 2` runs | logs `then 2 value` |
| tasks | `timeout 1`, `timeout 2` | in order |

```txt
sync
then 1
catch
finally
then 2 value
timeout 1
timeout 2
```

### Why `then 2` is late
Returning a promise from a `.then` callback does not resolve the outer promise directly; the engine schedules a job to call `then` on the returned promise (one tick) and then resolves the outer promise when that settles (another tick). So the following `.then` runs about two ticks later than if you had returned a plain value. If `then 1` returned `"value"` instead, the order would be `sync, then 1, catch, then 2 value, finally`.

### Takeaways
- Do not memorise tick counts; know that returning a promise costs extra turns, and that anything synchronous or already queued goes first.
- Timers always come after the microtask queue is empty.

## Follow-ups
- **What if `then 1` returned a plain value?** — `then 2` would run before `finally`.
- **What if `timeout 1` had a delay of 10?** — `timeout 2` (0 ms) would fire first.

## Common Mistakes
- Treating `.then` chains as running fully before another chain starts; they interleave by microtask.
- Assuming `finally` always follows the last `.then` of the other chain.

## Tips
- Build the microtask queue as a list and update it after every step; do not guess.
