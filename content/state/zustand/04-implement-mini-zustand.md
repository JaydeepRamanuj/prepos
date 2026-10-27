---
title: "Implement a mini Zustand: createStore and a React hook with useSyncExternalStore"
level: hard
type: implement
tags: [zustand, useSyncExternalStore, store, selectors, closures, implement]
related: [state/zustand-store-basics, state/zustand-selectors-useshallow, react/use-sync-external-store, javascript/closure-private-state-store]
---

## Question
Implement a tiny version of Zustand: `createStore(initializer)` returning `{ getState, setState, subscribe, getInitialState }`, and `create(initializer)` returning a React hook `useStore(selector?)` that re-renders only when the selected value changes. Support functional `setState`, partial merging, and `replace`.

```ts
const useCounter = create<{ count: number; inc: () => void }>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));
const count = useCounter((s) => s.count);
```

## Clues
- The store lives in a closure; React subscribes with `useSyncExternalStore`.
- A selector result must be referentially stable between calls when state hasn't changed.
- `setState` should skip notifying when `Object.is(nextState, state)`.

## Interview Answer
The vanilla store is a closure holding `state` and a `Set` of listeners. The initializer receives `set`, `get` and the api, and returns the initial state including actions. `setState(partial, replace)` computes the next value (calling it if it's a function), and if it differs by `Object.is` it merges into a new state object (or replaces) and notifies listeners with `(state, prevState)`. `subscribe` adds a listener and returns an unsubscribe function. The React hook calls `useSyncExternalStore(api.subscribe, () => selector(api.getState()), () => selector(api.getInitialState()))`, which re-renders only if the selector's result changes by `Object.is`; selectors returning fresh objects would loop or re-render every time, which is why Zustand v5 requires `useShallow` or stable selectors for object results. Actions are ordinary functions in the state that call `set`.

## Explanation
### Implementation

```ts
import { useSyncExternalStore } from "react";

type Listener<T> = (state: T, prev: T) => void;
type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean
) => void;

export interface StoreApi<T> {
  getState: () => T;
  getInitialState: () => T;
  setState: SetState<T>;
  subscribe: (listener: Listener<T>) => () => void;
}

export function createStore<T>(
  initializer: (set: SetState<T>, get: () => T, api: StoreApi<T>) => T
): StoreApi<T> {
  let state: T;
  const listeners = new Set<Listener<T>>();

  const setState: SetState<T> = (partial, replace) => {
    const next = typeof partial === "function" ? (partial as (s: T) => T | Partial<T>)(state) : partial;
    if (Object.is(next, state)) return;                         // nothing changed
    const prev = state;
    state =
      replace || typeof next !== "object" || next === null
        ? (next as T)                                           // replace the whole state
        : Object.assign({}, state, next);                       // shallow merge into a NEW object
    listeners.forEach((l) => l(state, prev));
  };

  const getState = () => state;
  const subscribe = (listener: Listener<T>) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };

  const api: StoreApi<T> = { getState, setState, subscribe, getInitialState: () => initialState };
  const initialState = (state = initializer(setState, getState, api));
  return api;
}
```

```ts
export function create<T>(initializer: Parameters<typeof createStore<T>>[0]) {
  const api = createStore(initializer);

  function useStore(): T;
  function useStore<U>(selector: (state: T) => U): U;
  function useStore<U>(selector: (state: T) => U = (s) => s as unknown as U) {
    return useSyncExternalStore(
      api.subscribe,
      () => selector(api.getState()),
      () => selector(api.getInitialState())          // server snapshot
    );
  }

  return Object.assign(useStore, api);              // useStore.getState(), useStore.setState(), …
}
```

### Why each piece exists
- **Closure state**: private; accessed only via the API.
- **New object on update**: React relies on reference changes; mutation would break selectors and memoisation.
- **`Object.is` bail-out**: avoids pointless notifications.
- **`useSyncExternalStore`**: correct for concurrent rendering (no tearing), handles subscribe/unsubscribe lifecycle; the snapshot function runs on every render and on every store change, so it must return a stable value when nothing changed.
- **Selector**: components subscribe to a slice; they re-render only when `Object.is(prevSlice, nextSlice)` is false.
- **Server snapshot**: lets SSR render with initial state (and avoids hydration mismatch).

### Usage and the selector pitfall

```tsx
const useCounter = create<{ count: number; inc: () => void }>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));

function Count() { return <p>{useCounter((s) => s.count)}</p>; }          // re-renders when count changes
function Button() { const inc = useCounter((s) => s.inc); return <button onClick={inc}>+</button>; }   // actions are stable: never re-renders

// Pitfall: new object each call → different snapshot every time
const { count, inc } = useCounter((s) => ({ count: s.count, inc: s.inc }));      // ✗ infinite loop / rerender every change
```

Fixes: select primitives separately, or use an equality-aware hook:

```ts
// useShallow-like helper
import { useRef } from "react";
function useShallow<S, U extends object>(selector: (s: S) => U) {
  const prev = useRef<U>(undefined as never);
  return (state: S) => {
    const next = selector(state);
    return prev.current && shallowEqual(prev.current, next) ? prev.current : (prev.current = next);
  };
}
```

### Extra features (how real Zustand adds them)
- **Middleware**: functions wrapping the initializer `(set, get, api) => …` (persist, devtools, immer, subscribeWithSelector).
- **`subscribeWithSelector`**: subscribe to slices with an equality function.
- **`createStore` vs `create`**: vanilla store for non-React usage or per-request stores in Next.js.
- **Bound `useStore.getState()`** for reading state outside components (event handlers, utilities).

### Differences from Redux
No reducers/actions types required, no provider, selectors are the subscription mechanism; trade-off is less enforced structure.

### Testing
Reset between tests via `useStore.setState(useStore.getInitialState(), true)`.

## Follow-ups
- **Why `getInitialState`?** — For SSR hydration consistency and test resets.
- **What does Zustand do about batching?** — React batches renders; the store calls listeners synchronously.

## Common Mistakes
- Returning new objects from selectors.
- Mutating `state` in actions.
- Forgetting to unsubscribe.

## Tips
- Walk through `setState → listeners → useSyncExternalStore → selector → rerender`.
