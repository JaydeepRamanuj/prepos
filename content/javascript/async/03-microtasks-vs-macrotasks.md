---
title: "What is the difference between microtasks and macrotasks?"
level: medium
type: concept
tags: [microtasks, macrotasks, promises, queueMicrotask, event-loop]
related: [javascript/event-loop-basics, javascript/async-output-order, javascript/microtask-starvation]
---

## Question
What counts as a microtask and what counts as a macrotask (task)? In what order does the event loop run them, and why does it matter?

## Interview Answer
Macrotasks, usually just called tasks, are things like the main script, `setTimeout`/`setInterval` callbacks, DOM events and message events. Microtasks are promise reaction callbacks (`.then`, `.catch`, `.finally`, and code after `await`), `queueMicrotask` and `MutationObserver` callbacks. The loop runs one task, then drains the entire microtask queue — including any microtasks queued while draining — and only then may render or take the next task. So microtasks always beat a pending `setTimeout(0)`, and they run before the browser paints. It matters for ordering bugs, and because a runaway chain of microtasks can starve rendering and timers.

## Explanation
### Who goes where

| Microtask queue | Task (macrotask) queue |
|---|---|
| `promise.then/catch/finally` | main script |
| continuation after `await` | `setTimeout`, `setInterval` |
| `queueMicrotask(fn)` | UI events (click, input), `postMessage` |
| `MutationObserver` | network/IO completion callbacks |

### Order of execution

```js
setTimeout(() => console.log("timeout"), 0);
Promise.resolve().then(() => console.log("promise"));
queueMicrotask(() => console.log("microtask"));
console.log("sync");
// sync, promise, microtask, timeout
```

The script is itself a task. When it ends, the microtask queue is drained in FIFO order (`promise`, then `microtask`), then the next task (`timeout`) runs.

### Microtasks queued by microtasks run in the same drain

```js
Promise.resolve().then(() => {
  console.log("a");
  Promise.resolve().then(() => console.log("b"));
});
setTimeout(() => console.log("t"), 0);
// a, b, t
```

### Why it is designed this way
Microtasks let you run follow-up work as soon as the current operation finishes, before anything else observes intermediate state — for example, batching DOM reads or making promise callbacks fire consistently.

### Practical uses
- `queueMicrotask` to defer work until the current synchronous code ends, without waiting for a timer.
- `setTimeout`/`scheduler.postTask` when you want to let the browser render in between.

## Follow-ups
- **Does rendering happen between microtasks?** — No. Rendering happens after the microtask queue is empty.
- **What about `requestAnimationFrame`?** — It runs in the rendering step, after microtasks and before paint. It is neither a normal task nor a microtask.

## Common Mistakes
- Calling promise callbacks "macrotasks".
- Thinking microtasks only drain once after the script; they drain after every task.

## Tips
- State the rule in one sentence: "one task, then all microtasks, then maybe render".
