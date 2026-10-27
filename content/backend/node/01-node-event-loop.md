---
title: "How does the Node.js event loop work, and how is it different from the browser's?"
level: hard
type: concept
tags: [node, event-loop, libuv, microtasks, setImmediate, nextTick]
related: [backend/streams-backpressure, backend/error-handling-graceful-shutdown]
---

## Question
Explain the phases of the Node.js event loop. Where do `setTimeout`, `setImmediate`, `process.nextTick` and promise callbacks run, and how does this differ from the event loop in a browser? What does this print?

```js
const fs = require("node:fs");

fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
  process.nextTick(() => console.log("nextTick"));
  Promise.resolve().then(() => console.log("promise"));
});
```

## Clues
- Node's loop is implemented by libuv and runs in fixed phases. Which phase comes right after the poll (I/O) phase?
- `process.nextTick` and promise callbacks don't belong to any phase. They drain after every callback, and `nextTick` goes first.
- The browser loop has no phases like this: one task, then all microtasks, then maybe a render.

## Interview Answer
Node runs JavaScript on one thread, and libuv drives an event loop with fixed phases: timers (`setTimeout`/`setInterval`), pending callbacks, poll (where most I/O callbacks run and where the loop waits for I/O), check (`setImmediate`), and close callbacks. `process.nextTick` and promise callbacks aren't phases. After each callback, Node first drains the `nextTick` queue, then the promise microtask queue, before moving on. So the snippet prints `nextTick`, `promise`, `immediate`, `timeout`. We're inside an I/O callback in the poll phase, so the next phase is check, and `setImmediate` always runs before the timer. The browser has a simpler model: run one task, drain all microtasks, then possibly render. There's no `setImmediate` or `nextTick`, and rendering (`requestAnimationFrame`, paint) is part of the loop.

## Explanation
### The phases

```txt
   ┌───────────────────────────┐
┌─>│ timers                    │  setTimeout / setInterval callbacks whose time is up
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
│  │ pending callbacks         │  some deferred system I/O callbacks (e.g. TCP errors)
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
│  │ idle, prepare             │  internal
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
│  │ poll                      │  run I/O callbacks; block here waiting for I/O
│  └────────────┬──────────────┘   if nothing else is scheduled
│  ┌────────────┴──────────────┐
│  │ check                     │  setImmediate callbacks
│  └────────────┬──────────────┘
│  ┌────────────┴──────────────┐
└──┤ close callbacks           │  e.g. socket.on("close")
   └───────────────────────────┘

after EVERY callback: drain process.nextTick queue → drain promise microtasks
```

The loop exits when nothing is left to do: no pending timers, I/O or handles.

### Walking through the snippet
1. `readFile` completes, and its callback runs in the **poll** phase.
2. Inside it we schedule a timer, an immediate, a nextTick and a promise.
3. The callback finishes, so Node drains **nextTick** → prints `nextTick`, then **microtasks** → `promise`.
4. The loop moves on from poll to **check** → `immediate`.
5. It wraps around to **timers** → `timeout`.

Output: `nextTick`, `promise`, `immediate`, `timeout`.

### The famous non-determinism
At the top level of the main module, the order of these two is **not guaranteed**:

```js
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));
```

`setTimeout(fn, 0)` is really at least 1 ms. Whether 1 ms has passed by the time the loop first checks the timers phase depends on process performance, so either can print first. Inside an I/O callback, `immediate` always wins, as shown above.

### nextTick vs promises
```js
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("tick"));
// tick, promise
```
`nextTick` has its own queue that is drained before the promise queue. Both are drained completely, so a recursive `nextTick` can **starve** the loop: I/O never gets a turn. That's why Node's docs recommend `setImmediate` for "do this later" in most cases. In ES modules, the top-level code itself runs as part of a promise job, so ordering at the very top of a `.mjs` file can differ from CommonJS. Avoid relying on nextTick-vs-promise ordering in real code.

### Node vs browser

| | Node | Browser |
|---|---|---|
| Loop provided by | libuv | the browser (HTML spec) |
| Structure | fixed phases (timers → poll → check → close) | pick a task → drain microtasks → maybe render |
| Extra queues | `process.nextTick` (before promises), `setImmediate` | `requestAnimationFrame`, `queueMicrotask` (also in Node) |
| Rendering | none | style/layout/paint between tasks, ~every frame |
| Microtask timing | after each callback (since Node 11, also between individual timers) | after each task |

Before Node 11, all expired timers in a phase ran before microtasks drained, which differed from browsers. Since Node 11, microtasks drain between each `setTimeout` callback, so the common cases now match browser behaviour.

### Why it matters for backend code
- **CPU-heavy work blocks everything.** A 200 ms synchronous JSON parse or crypto loop means no request gets served for 200 ms. Move it to `worker_threads`, chunk it, or use streaming.
- **libuv's thread pool** (default size 4) handles fs, DNS lookup, some crypto and zlib. Network I/O uses the OS's async mechanisms (epoll/kqueue/IOCP) and doesn't use the pool.

## Follow-ups
- **Is Node single-threaded?** — Your JavaScript runs on one thread, but libuv uses a thread pool for fs/DNS/crypto/zlib, and you can create more threads with `worker_threads`.
- **How do you detect event loop blocking?** — `perf_hooks.monitorEventLoopDelay()`, APM tools, or `--cpu-prof` to find the long synchronous function.
- **When would you use `setImmediate` over `nextTick`?** — Almost always. `setImmediate` lets I/O run first; `nextTick` is for "after this function but before anything else", such as emitting an event after the constructor returns.

## Common Mistakes
- Saying `setTimeout(fn, 0)` always runs before `setImmediate`. It depends on context.
- Treating `nextTick` as a phase. It runs between every callback, not once per loop iteration.
- Claiming Node is "multi-threaded so CPU work is fine". A heavy sync function still blocks all requests.

## Tips
- Draw the six phases and write "nextTick → microtasks after every callback" next to them. That one diagram answers most variants of this question.
- Mention starvation and `worker_threads`. It shows you think about production impact, not just ordering puzzles.
