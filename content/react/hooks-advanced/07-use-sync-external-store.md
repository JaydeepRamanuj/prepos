---
title: "What is useSyncExternalStore and why does it exist?"
level: advanced
type: concept
tags: [useSyncExternalStore, external-store, tearing, concurrent-rendering, zustand]
related: [react/use-context-rerenders, react/state-colocation, javascript/closure-private-state-store]
---

## Question
What problem does `useSyncExternalStore` solve? Show how to subscribe to a browser API such as online status with it, and explain why a `useEffect` + `useState` subscription is not enough in concurrent React.

## Clues
- Concurrent rendering can pause and resume a render; the external data may change in between.
- The hook needs two functions: how to subscribe and how to read a snapshot.
- Server rendering needs a third argument.

## Interview Answer
`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` is the official way to read data that lives outside React, such as Redux, Zustand, `window.matchMedia`, `navigator.onLine` or `localStorage`. It exists because with concurrent rendering a render can be interrupted, and with a naive `useEffect` subscription different components might render using different versions of the external data in the same pass, which is called tearing. This hook makes React read a consistent snapshot, re-render on change, and force a synchronous update if the store changes during rendering. `getSnapshot` must return a cached, referentially stable value when nothing has changed, otherwise it loops; `getServerSnapshot` supplies the value for server rendering and hydration.

## Explanation
### Example: online status

```tsx
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;           // required for SSR

function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function Status() {
  return <span>{useOnlineStatus() ? "Online" : "Offline"}</span>;
}
```

### Why `useEffect` + `useState` falls short
```tsx
const [online, setOnline] = useState(navigator.onLine);   // hydration mismatch + tearing risk
useEffect(() => { /* subscribe, setOnline */ }, []);
```
- The first render may use a stale value until the effect runs (flash of wrong content).
- With time-sliced rendering, one component may read store state A and another state B in the same render.
- On the server, `navigator` doesn't exist.

### Snapshot rules
- `getSnapshot` must return the same value (by `Object.is`) when the store has not changed. Returning a new object every call triggers an infinite loop:

```tsx
const getSnapshot = () => ({ width: window.innerWidth });   // wrong: new object each call
const getSnapshot = () => window.innerWidth;                // correct: primitive
```

For object snapshots, cache them in the store and return the cached reference until a change occurs.
- `subscribe` should be a stable function (defined outside the component, or memoised), otherwise React resubscribes every render.
- Selecting derived values: `useSyncExternalStore(store.subscribe, () => selector(store.getState()))` works only if the selector returns stable results; libraries add equality checks.

### Where it's used
Redux (`react-redux` v8+), Zustand, Jotai, TanStack Store, React Router and many hooks libraries are built on it. In your own code, use it for any subscribable source that React doesn't own, rather than manual effects.

### Tradeoffs
Updates triggered by an external store are synchronous and can't be marked as transitions, so they can't be deferred with `startTransition`.

## Follow-ups
- **Why does it need `getServerSnapshot`?** — The server has no browser state, and the client must hydrate with the same value to avoid mismatch.
- **How would you build a mini-store with it?** — Keep state and listeners in a closure; `subscribe` adds a listener; `getSnapshot` returns state.

## Common Mistakes
- Returning a fresh object from `getSnapshot`.
- Defining `subscribe` inline.
- Omitting `getServerSnapshot` in an SSR app.

## Tips
- Use the words "tearing" and "consistent snapshot"; they show you know why the hook exists.
