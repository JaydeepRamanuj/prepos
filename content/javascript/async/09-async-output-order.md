---
title: "Predict the output: sync code, timers, promises and async functions"
level: hard
type: output
tags: [event-loop, microtasks, async-await, output]
related: [javascript/microtasks-vs-macrotasks, javascript/async-await-under-the-hood, javascript/event-loop-basics]
---

## Question
What does this log, and in what order?

```js
console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve().then(() => console.log("3"));

(async () => {
  console.log("4");
  await null;
  console.log("5");
})();

queueMicrotask(() => console.log("7"));

console.log("6");
```

## Clues
- Which lines run synchronously during the main script?
- What does `await null` do to the rest of the async function?
- When do microtasks run compared to the timer?

## Interview Answer
The output is `1, 4, 6, 3, 5, 7, 2`. Synchronous code runs first: `1`, then the async function runs until its `await` and logs `4`, and then `6`. The `.then` callback, the continuation of the async function, and the `queueMicrotask` callback were queued as microtasks in that order, so after the script ends they run as `3`, `5`, `7`. Only then does the event loop take the next task, the `setTimeout` callback, and log `2`.

## Explanation
### Step by step
Main script (one task):

| Step | Action | Output / queue |
|---|---|---|
| 1 | `console.log("1")` | prints `1` |
| 2 | `setTimeout` | timer callback scheduled as a task |
| 3 | `.then(...)` on resolved promise | microtask queue: `[log 3]` |
| 4 | async IIFE runs synchronously | prints `4` |
| 5 | `await null` | continuation queued: `[log 3, log 5]` |
| 6 | `queueMicrotask` | `[log 3, log 5, log 7]` |
| 7 | `console.log("6")` | prints `6` |

Script ends → drain microtasks in FIFO order: prints `3`, `5`, `7`. Microtask queue empty → next task: timer prints `2`.

```txt
1
4
6
3
5
7
2
```

### Rules used
1. Everything synchronous first, including the async function body up to its first `await`.
2. Microtasks run in the order they were queued, after the current task.
3. Timers are tasks, so they run after all microtasks.

### Variation
If the `await` were on a promise that takes a timer to resolve, the continuation would be queued only when that promise settles, so it would come after earlier timers that finish first.

## Follow-ups
- **What if you replaced `await null` with `await somePromise` that is already resolved?** — Same position: the continuation is queued as a microtask.
- **What if the timer used `setTimeout(fn, 100)`?** — Still last; microtasks and sync code finish first anyway.

## Common Mistakes
- Putting `5` before `6` by thinking `await` blocks the rest of the script.
- Placing `2` early because the delay is `0`.

## Tips
- Write the microtask queue as a list as you read top to bottom; it removes guesswork.
