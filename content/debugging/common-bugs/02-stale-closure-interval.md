---
title: "Why is this counter stuck at 1? (stale closure)"
level: medium
type: debugging
tags: [stale-closure, useeffect, setinterval, closures]
related: [debugging/event-listener-fires-twice, debugging/memory-leak-uncleared-subscription, debugging/react-devtools-profiler]
---

## Question
This timer should count up every second. Instead it shows `1` and stays there. A second bug: the "Log" button always logs the count from when the timer started. Explain and fix both.

```tsx
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = () => console.log("count is", count);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <p>{count}</p>;
}
```

## Interview Answer
Both callbacks are stale closures. The effects run once because of `[]`, so the interval callback and the key handler close over `count` from the first render, where it is `0`. Every tick calls `setCount(0 + 1)`, so the state stays at `1`. For the interval I use a functional update, `setCount(c => c + 1)`, which reads the current state from React instead of from the closure, so the effect can keep empty deps. For the handler that needs to *read* the latest value, I either add `count` to the deps so it re-subscribes, or — better when re-subscribing is expensive — read it through `useEffectEvent` or a ref that always holds the latest value.

## Explanation
### Why the value freezes
Each render is a separate function call with its own `count` constant. A function created during render 1 sees render 1's `count` forever.

```txt
render 1: count = 0 → effect creates tick() that captured count = 0
tick:  setCount(0 + 1) → render 2: count = 1 (effect does not re-run, [] deps)
tick:  setCount(0 + 1) → 1 again → React bails out, nothing changes
```

### Fix 1 — functional update (when you only need to *update*)

```tsx
useEffect(() => {
  const id = setInterval(() => setCount((c) => c + 1), 1000);
  return () => clearInterval(id);
}, []);
```

The updater receives the latest state, so the closure doesn't need `count` at all.

### Fix 2 — add the dependency (simple, re-subscribes)

```tsx
useEffect(() => {
  const onKey = () => console.log("count is", count);
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [count]);
```

Correct, and fine for a cheap listener. For an interval this would reset the timer every second — usually not what you want.

### Fix 3 — Effect Event (read latest without re-subscribing)
`useEffectEvent` (stable since React 19.2) creates a function that always sees the latest props and state and is not a dependency:

```tsx
const logCount = useEffectEvent(() => console.log("count is", count));

useEffect(() => {
  const onKey = () => logCount();
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []); // Effect Events are not dependencies
```

Only call Effect Events from inside effects — not from render or as JSX event handlers.

### Fix 4 — latest-value ref (works in any React version)

```tsx
const countRef = useRef(count);
useEffect(() => {
  countRef.current = count;
});
// inside the listener: console.log(countRef.current)
```

### Where else stale closures appear
- `setTimeout` callbacks, debounced functions created once with `useMemo`.
- Subscriptions (WebSocket `onmessage`, store listeners).
- `useCallback` with missing deps.

The `react-hooks/exhaustive-deps` lint rule flags most of these — the original code would warn that `count` is missing.

## Follow-ups
- **Why does React bail out after the second tick?** — `setCount(1)` when state is already `1` is an `Object.is` match, so React skips re-rendering.
- **Is disabling the lint rule ever OK?** — Rarely; if you feel the need, the value is usually an event (use `useEffectEvent`) or should be derived differently.
- **How do you see a stale closure in DevTools?** — Pause inside the callback; the Scope pane's Closure section shows the captured `count` value.

## Common Mistakes
- Adding `count` to the interval's deps, which "works" but recreates the interval every tick and drifts.
- Thinking `useState` returns a live reference; it returns a snapshot per render.
- Silencing `exhaustive-deps` instead of understanding the warning.

## Tips
- One-liner: "a closure captures the render it was created in".
- Decision rule: update → functional updater; read latest → Effect Event or ref; really depends → add to deps.
