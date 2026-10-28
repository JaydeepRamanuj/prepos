---
title: "Implement an EventEmitter (on, off, once, emit)"
level: medium
type: implement
tags: [event-emitter, pub-sub, observer, closures, polyfill]
related: [javascript/closure-private-state-store, javascript/higher-order-functions, javascript/once-function]
---

## Question
Implement a small `EventEmitter` class with `on(event, listener)`, `off(event, listener)`, `once(event, listener)` and `emit(event, ...args)`. `on` should return an unsubscribe function, listeners run in registration order, and removing a listener during `emit` must not break iteration.

```js
const bus = new EventEmitter();
const off = bus.on("msg", (t) => console.log("got", t));
bus.emit("msg", "hi");   // got hi
off();
bus.emit("msg", "again"); // nothing
```

## Interview Answer
I keep a `Map` from event name to a `Set` of listeners. `on` adds the listener and returns a function that calls `off`. `off` removes it and deletes the set when empty. `once` wraps the listener in a function that unsubscribes itself before calling the original, and stores a reference to the original so `off(event, original)` still works. `emit` copies the listeners into an array before iterating so adding or removing during the loop is safe, and returns whether anyone was listening. This is the observer pattern, the same shape as DOM events and Node's `EventEmitter`.

## Explanation
### Implementation

```js
class EventEmitter {
  #events = new Map();     // name -> Set<listener>

  on(event, listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    if (!this.#events.has(event)) this.#events.set(event, new Set());
    this.#events.get(event).add(listener);
    return () => this.off(event, listener);            // unsubscribe handle
  }

  off(event, listener) {
    const set = this.#events.get(event);
    if (!set) return this;
    for (const l of set) {
      // match the listener itself, or the once-wrapper that holds it
      if (l === listener || l.original === listener) set.delete(l);
    }
    if (set.size === 0) this.#events.delete(event);
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      listener(...args);
    };
    wrapper.original = listener;
    return this.on(event, wrapper);
  }

  emit(event, ...args) {
    const set = this.#events.get(event);
    if (!set) return false;
    for (const l of [...set]) l(...args);              // snapshot: safe against mutation
    return true;
  }
}
```

### Why the snapshot
If a listener calls `off` for itself (as `once` does) while the `Set` is being iterated, JS `Set` iteration handles deletes but a listener added during emit would run in the same emit. Copying first gives predictable semantics: listeners registered during `emit` run on the next emit.

### Usage

```js
const bus = new EventEmitter();
bus.once("ready", () => console.log("ready once"));
bus.emit("ready");   // logs
bus.emit("ready");   // nothing
```

### Extensions
- `this` binding: call with `l.apply(this, args)` if listeners should receive the emitter.
- Error isolation: wrap each call in `try/catch` so one failing listener does not stop others.
- Wildcard events, `prependListener`, max-listener warnings (Node warns at 10 to catch leaks).
- Async emit: `await Promise.all(listeners.map(...))`.

### Leaks
Forgetting to unsubscribe keeps listeners (and their closures) alive; in React, subscribe in `useEffect` and return the unsubscribe function.

### Complexity
`on` O(1), `off` O(listeners for that event) because of once-wrapper matching, `emit` O(listeners).

## Follow-ups
- **Why use a Set rather than an array?** — O(1) add/delete and no duplicate registrations.
- **How would you allow the same function twice?** — Use an array and remove one occurrence.

## Common Mistakes
- Iterating the live collection while listeners unsubscribe.
- Making `off` unable to remove `once` listeners.

## Tips
- Mention returning an unsubscribe function; it is the pattern React hooks rely on.
