---
title: "Build a tiny store with closures: createStore with subscribe"
level: hard
type: implement
tags: [closures, private-state, pub-sub, store, zustand]
related: [javascript/closure, javascript/iife-module-pattern, state/zustand-create-store]
---

## Question
Using only closures (no classes), implement `createStore(initialState)` returning `getState`, `setState(partial)` and `subscribe(listener)`. `subscribe` returns an unsubscribe function, listeners run after every change, and state must not be mutable from outside.

```js
const store = createStore({ count: 0 });
const off = store.subscribe((s) => console.log(s.count));
store.setState({ count: 1 });   // logs 1
off();
store.setState({ count: 2 });   // nothing
```

## Clues
- Where do `state` and the list of listeners live so that nobody outside can touch them?
- `setState` should create a new state object rather than mutate the old one.
- Iterate over a copy of the listeners so unsubscribing during a notification is safe.

## Interview Answer
The factory function holds `state` and a `Set` of listeners in its own scope and returns an object of three functions that close over them, so the only way to read or change the data is through that API. `setState` merges the partial into a new object, skips the notification when nothing changed, and then calls each listener with the new and previous state. `subscribe` adds the listener and returns a function that removes it. This is essentially how Zustand and Redux stores work, and it is also the shape `useSyncExternalStore` expects.

## Explanation
### Implementation

```js
function createStore(initialState) {
  let state = initialState;            // private
  const listeners = new Set();         // private

  const getState = () => state;

  const setState = (partial) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    const merged = { ...state, ...next };          // new reference, no mutation
    if (shallowEqual(state, merged)) return;       // nothing changed
    const prev = state;
    state = merged;
    [...listeners].forEach((l) => l(state, prev)); // copy: safe if a listener unsubscribes
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { getState, setState, subscribe };
}

function shallowEqual(a, b) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.is(a[k], b[k]));
}
```

### Why it is private
`state` and `listeners` are variables in `createStore`'s scope. The returned functions keep that scope alive, but nothing else can reach it. `getState()` returns the current object, so treat it as read-only (or `Object.freeze` it in development).

### Usage with React

```tsx
import { useSyncExternalStore } from "react";

function useStore(store, selector) {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState())
  );
}
```

The selector result must be stable between calls (primitives or the same reference), otherwise React warns about infinite loops.

### Edge cases
- A listener that calls `setState` triggers a nested notification; guard against it or document it.
- Errors in one listener should not prevent others from running; wrap in `try/catch` if needed.
- Each store is independent: two calls to `createStore` do not share state.

### Complexity
`setState` is O(keys + listeners); `subscribe` is O(1).

## Follow-ups
- **How do selectors avoid re-renders?** — Subscribers compare the selected slice and only update when it changes.
- **How would you add middleware or persistence?** — Wrap `setState` or subscribe to changes and write to storage.

## Common Mistakes
- Mutating `state` in place so listeners and React cannot detect change.
- Iterating the live `Set` while listeners unsubscribe.

## Tips
- Mention that this is Zustand's core in about 15 lines; it connects closures to a tool you use.
