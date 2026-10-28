---
title: "What are unhandled promise rejections and how do you avoid them?"
level: hard
type: debugging
tags: [promises, unhandled-rejection, error-handling, async-await]
related: [javascript/promise-chaining-error-handling, javascript/async-await-under-the-hood, javascript/sequential-vs-parallel-await]
---

## Question
What is an unhandled promise rejection? Why does it happen in code like the snippet below, what does the runtime do about it, and how do you prevent it?

```js
async function save() {
  throw new Error("failed");
}

function onClick() {
  save();
}

button.addEventListener("click", onClick);
```

## Clues
- What does `save()` return when it throws?
- Who is responsible for handling a rejection if nobody attaches a handler?
- Browsers and Node expose a global event for this.

## Interview Answer
An unhandled rejection occurs when a promise rejects and no `.catch` or rejection handler is attached by the time the runtime checks. In the snippet, `save()` returns a rejected promise that `onClick` ignores, so nobody handles it. Browsers log it to the console and fire a `unhandledrejection` event on `window`; Node 15 and later terminates the process by default with `--unhandled-rejections=throw`. I prevent it by awaiting or returning every promise and handling errors at a boundary: `try/catch` in async handlers, a `.catch` on fire-and-forget calls, and `Promise.allSettled` when failures are expected. A global `unhandledrejection` listener is for reporting to monitoring, not for control flow.

## Explanation
### Why a throw does not reach the caller
An `async` function converts a throw into a rejected promise, so `try { save() } catch {}` around a non-awaited call catches nothing.

```js
function onClick() {
  try {
    save();               // returns rejected promise; catch never runs
  } catch (e) {}
}
```

### Fixes

```js
async function onClick() {
  try {
    await save();
  } catch (e) {
    showError(e);
  }
}

// fire-and-forget on purpose
save().catch(report);
```

### Global safety net

```js
// Browser
window.addEventListener("unhandledrejection", (e) => {
  reportToMonitoring(e.reason);
});

// Node
process.on("unhandledRejection", (reason) => { /* log, then exit */ });
```

### Other sources of unhandled rejections
- Forgetting to `return` an inner promise in `.then`.
- Creating promises you never use: `const p = doThing();` then failing.
- `Promise.all` with several rejecting promises: only the first rejection is reported; the rest are handled internally.
- `async` callbacks in `forEach`, event handlers or `setTimeout`.

### Late handlers
Attaching a handler after the engine's check triggers `unhandledrejection`, and later a `rejectionhandled` event. Attach handlers in the same tick as creating the promise.

### React note
Event handlers and effects are not covered by error boundaries for async errors; catch them yourself and put the error in state.

## Follow-ups
- **Does an error boundary catch rejected promises?** — No, only errors thrown during render, in lifecycle code and effects' synchronous throws.
- **Why does Node crash?** — Silent failures leave the app in an unknown state; crashing and restarting is safer.

## Common Mistakes
- Wrapping a non-awaited async call in `try/catch`.
- Using the global listener to hide errors.

## Tips
- Say "every promise needs an owner": either awaited, returned, or explicitly caught.
