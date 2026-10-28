---
title: "How does the JavaScript event loop work?"
level: medium
type: concept
tags: [event-loop, call-stack, task-queue, concurrency]
related: [javascript/microtasks-vs-macrotasks, javascript/async-output-order, javascript/microtask-starvation]
---

## Question
JavaScript is single-threaded, yet it handles timers, network requests and user events without freezing. Explain how the event loop makes this work.

## Interview Answer
JavaScript runs your code on one thread with one call stack. Things like timers, network and DOM events are handled by the host environment — the browser or Node — outside that stack. When one finishes, it puts a callback into a queue. The event loop's job is simple: whenever the call stack is empty, take the next queued task and run it to completion. After each task it drains the microtask queue — promise callbacks — before the browser may render or pick the next task. So async code is not parallel JavaScript; it is JavaScript scheduled in turns. The consequence is that a long synchronous task blocks everything, including rendering and clicks.

## Explanation
### The pieces

```txt
 call stack        Web APIs / host            queues
┌──────────┐     ┌────────────────┐     ┌───────────────────┐
│ main()   │ --> │ timers, fetch, │ --> │ task (macrotask)  │
│ fn()     │     │ DOM events     │     │ queue(s)          │
└──────────┘     └────────────────┘     ├───────────────────┤
      ^                                  │ microtask queue   │
      └──────── event loop picks next ───┴───────────────────┘
```

### One turn of the loop
1. Run one task from the task queue (the initial script is the first task).
2. Run **all** microtasks until the queue is empty (including ones added while draining).
3. If it is a browser and time to paint, run rendering steps (`requestAnimationFrame`, style, layout, paint).
4. Repeat.

### Example

```js
console.log("A");
setTimeout(() => console.log("B"), 0);
console.log("C");
// A, C, B
```

`setTimeout(fn, 0)` does not mean "now". It asks the host to queue `fn` as a task after at least 0 ms; the current script must finish first. Browsers also clamp nested timers to a minimum of about 4 ms.

### Consequences
- A 500 ms synchronous loop freezes the UI: no clicks, no paint.
- Timers are a minimum delay, not a guarantee.
- Async means "later on the same thread". True parallelism needs Web Workers or `worker_threads`.

### Node differences
Node's loop has phases (timers, poll, check for `setImmediate`, and so on), and `process.nextTick` runs before promise microtasks. The mental model of "task, then microtasks" still holds.

## Follow-ups
- **Where does `await` fit?** — Code after `await` is queued as a microtask when the awaited promise settles.
- **How do you avoid blocking the loop?** — Chunk work with `setTimeout`/`scheduler.yield()`, or move it to a worker.

## Common Mistakes
- Saying JavaScript "has multiple threads" for async — the host does I/O, JS runs on one.
- Treating `setTimeout(fn, 0)` as immediate.
- Forgetting that microtasks run after each task, not only after the script.

## Tips
- Draw the stack, host APIs and two queues. A clear diagram carries this answer.
