---
title: "What is a stale closure in React, and how do you fix it?"
level: hard
type: debugging
tags: [stale-closure, useEffect, setInterval, functional-updates, useRef]
related: [react/use-effect-dependency-array, react/use-effect-event, react/use-state-functional-updates, react/use-ref-dom-vs-mutable]
---

## Question
This counter should tick up every second, and the button should log the latest count. Instead it gets stuck at 1 and the log is always 0 after the first render. Explain why and give three ways to fix it.

```tsx
function Ticker() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1);
      console.log("count is", count);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <h1>{count}</h1>;
}
```

## Clues
- Each render has its own `count`. Which render's `count` does the interval callback see?
- The effect runs once because the dependency array is empty.
- You can avoid depending on the value by not reading it, or by reading it through a ref or an effect event.

## Interview Answer
Every render creates new functions that close over that render's state. The effect ran after the first render, so the interval callback captured `count = 0` and, with an empty dependency array, is never replaced. Every tick runs `setCount(0 + 1)`, so the value sticks at 1 and the log always prints 0. The idiomatic fix is a functional update, `setCount(c => c + 1)`, which does not read the closed-over value. If I need the latest value for something else, I can list `count` in the dependencies and let the effect re-subscribe, store it in a ref, or read it through `useEffectEvent`. The root cause is the dependency array lying about what the effect uses.

## Explanation
### Why it happens
Renders are snapshots. `count` inside the callback is a constant from the render in which the effect was created:

```txt
render 1: count = 0 -> effect creates interval -> callback closes over count = 0
render 2: count = 1 -> effect does NOT rerun (deps []) -> interval still holds count = 0
```

### Fix 1: functional update (best for state updates)

```tsx
useEffect(() => {
  const id = setInterval(() => setCount((c) => c + 1), 1000);
  return () => clearInterval(id);
}, []);
```

The updater receives the latest state, so the effect does not need `count`.

### Fix 2: include the dependency

```tsx
useEffect(() => {
  const id = setInterval(() => {
    setCount(count + 1);
    console.log("count is", count);
  }, 1000);
  return () => clearInterval(id);
}, [count]);       // restarts the interval after each tick
```

Correct, but the timer resets every tick, so it drifts and is wasteful.

### Fix 3: read the latest value without re-subscribing

```tsx
import { useEffectEvent } from "react";   // stable in React 19.2

const onTick = useEffectEvent(() => {
  console.log("count is", count);          // always the latest
});

useEffect(() => {
  const id = setInterval(() => {
    setCount((c) => c + 1);
    onTick();
  }, 1000);
  return () => clearInterval(id);
}, []);                                    // onTick is not a dependency
```

Before `useEffectEvent`, the equivalent was a ref updated each render (`latest.current = count`, in an effect or layout effect).

### Don't silence the linter
Adding `// eslint-disable-next-line react-hooks/exhaustive-deps` hides the bug. The rule exists because of exactly this problem.

### Other places stale closures appear
- Event handlers passed to long-lived subscriptions (WebSocket, `addEventListener`) in `[]` effects.
- `setTimeout` callbacks reading state after an `await`.
- Memoised callbacks with missing dependencies.

## Follow-ups
- **Does a stale closure happen in event handlers?** — Not in the usual case; a handler is recreated every render, so it sees fresh state. It happens when the handler is registered once and kept.
- **Why is the ref approach discouraged for rendering?** — Refs don't trigger re-renders and updating them during render breaks purity.

## Common Mistakes
- Adding `count` to deps and not noticing the interval restarts every tick.
- Disabling the exhaustive-deps lint rule.
- Believing setState closure bugs mean React is "async"; they come from closures.

## Tips
- Say "renders are snapshots, effects close over them" and give the functional-update fix first.
