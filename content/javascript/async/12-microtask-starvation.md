---
title: "Can promises freeze the page? Explain microtask starvation"
level: advanced
type: concept
tags: [microtasks, event-loop, starvation, performance, scheduler]
related: [javascript/microtasks-vs-macrotasks, javascript/event-loop-basics, javascript/async-output-order]
---

## Question
Both snippets below look asynchronous. One freezes the page completely and the other does not. Why? What does this tell you about the event loop, and how do you split long work correctly?

```js
// A
function loopA() { Promise.resolve().then(loopA); }
loopA();

// B
function loopB() { setTimeout(loopB, 0); }
loopB();
```

## Clues
- What must be empty before the event loop moves on to the next task or rendering?
- Does a microtask queued during a microtask drain wait for the next turn?
- Which API yields back to the browser so it can paint and handle input?

## Interview Answer
Snippet A freezes the tab because the event loop drains the microtask queue completely before it does anything else, and each microtask queues another one, so the queue never empties; the browser never gets to render, run timers or handle input. Snippet B is fine: each `setTimeout` is a separate task, and between tasks the browser can paint and process events, although it is a busy loop that wastes CPU. So microtasks are for short follow-up work; long or repeated work should be split into tasks, or yielded with `scheduler.yield()`, `setTimeout`, or `requestIdleCallback`, so rendering and input stay responsive. A long synchronous task has the same effect, even without promises.

## Explanation
### What happens in A

```txt
task: loopA() -> queue microtask M1
drain: M1 runs -> queues M2
drain: M2 runs -> queues M3
...                      (never empty)
```

Rendering and the next task wait forever. This is called starvation.

### What happens in B

```txt
task 1: loopB -> schedule timer
(browser can render, handle click)
task 2: loopB -> schedule timer
```

Nested timers are clamped to about 4 ms after several levels, so the CPU is not pegged the way A is.

### Chunking long work

```js
async function processAll(items) {
  const CHUNK = 500;
  for (let i = 0; i < items.length; i += CHUNK) {
    items.slice(i, i + CHUNK).forEach(handle);
    await yieldToMain();
  }
}

const yieldToMain = () =>
  globalThis.scheduler?.yield
    ? scheduler.yield()
    : new Promise((r) => setTimeout(r, 0));
```

`await Promise.resolve()` is not enough to yield: it only schedules a microtask, so the browser still cannot paint.

### Choosing a tool

| Need | Use |
|---|---|
| Run right after current sync code | `queueMicrotask` |
| Let the browser paint/handle input | `setTimeout`, `scheduler.yield()` |
| Run before next paint | `requestAnimationFrame` |
| Run when the browser is idle | `requestIdleCallback` |
| True parallelism | Web Worker |

### Relation to INP
Long tasks above about 50 ms delay interaction response and hurt Interaction to Next Paint, so breaking up work is a performance topic as well as a correctness one.

## Follow-ups
- **Does Node have the same issue?** — Yes; `process.nextTick` and promises can starve I/O callbacks.
- **Does `await` in a loop make it non-blocking?** — Only if what you await yields to a task; awaiting resolved promises stays in microtasks.

## Common Mistakes
- Believing anything "async" is non-blocking.
- Yielding with `await Promise.resolve()` and expecting the UI to update.

## Tips
- Remember: microtasks drain to empty; tasks give the browser a chance to render.
