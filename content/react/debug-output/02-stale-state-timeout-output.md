---
title: "Predict the output: alerts, setTimeout and stale state"
level: hard
type: output
tags: [stale-state, setTimeout, closures, snapshots, output]
related: [react/stale-closures-in-effects, react/use-state-functional-updates, react/state-batching]
---

## Question
The count starts at 0. A user clicks "Go" once. What does the console show and what does the screen show at the end?

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log("A", count);

    setTimeout(() => {
      console.log("B", count);
      setCount(count + 5);
    }, 1000);

    setCount((c) => c + 10);
    console.log("C", count);
  }

  return <button onClick={handleClick}>Go ({count})</button>;
}
```

## Clues
- State is a snapshot per render; `count` inside this handler never changes.
- Updates are queued and applied in order after the handler finishes.
- The timeout callback also closes over the same `count`.

## Interview Answer
The console shows `A 0`, `C 0`, and a second later `B 0`. The screen first shows 11 after the click, because the queue is `count + 1` (which sets 1), then the updater `c => c + 10` runs on 1 and gives 11. Then a second later the timeout runs `setCount(count + 5)` using the old snapshot `count = 0`, so it sets 5 and the button shows 5. So the final screen is `Go (5)`. The key points: `count` is `0` in every log of this render's closure, `setCount(value)` replaces state with a value computed from the stale snapshot, and an updater function receives the latest queued state.

## Explanation
### Step by step

| Moment | Action | Result |
|---|---|---|
| click | `setCount(0 + 1)` | queue: replace with `1` |
| click | `console.log("A", count)` | prints `A 0` |
| click | `setTimeout(...)` | callback scheduled (closes over `count = 0`) |
| click | `setCount((c) => c + 10)` | queue: `1`, then `c => c + 10` |
| click | `console.log("C", count)` | prints `C 0` |
| re-render | process queue: 1, then 1 + 10 | `count = 11`, screen shows `Go (11)` |
| after 1 s | `console.log("B", count)` | closure still has `0`: prints `B 0` |
| after 1 s | `setCount(0 + 5)` | replaces state with `5`, screen shows `Go (5)` |

```txt
A 0
C 0
(screen: Go (11))
B 0        (after 1s)
(screen: Go (5))
```

### Rules illustrated
1. **Snapshot:** each render's handlers and timeouts see that render's `count`. Calling `setCount` doesn't change the local variable.
2. **Queue:** value updates replace; functional updates compute from the latest queued state.
3. **Timeouts keep the old closure:** the timeout fires after a re-render, but the function body still reads the `count` from the render in which it was created.

### Fix for the timeout
```tsx
setTimeout(() => {
  setCount((c) => c + 5);        // based on the latest state: 11 + 5 = 16
}, 1000);
```
To log the current value, read it from a ref (updated in an effect) or use `useEffectEvent`.

### Alerts and async
The classic example `alert(count)` after `setTimeout` shows the value at click time, not the latest. That's a feature: handlers behave consistently with what the user saw when they clicked.

## Follow-ups
- **What if the timeout used `setCount(c => c + 5)`?** — Final would be 16.
- **Why doesn't React update `count` in place?** — State is immutable per render; updates schedule a new render.

## Common Mistakes
- Expecting `console.log("A", count)` to print 1.
- Forgetting the timeout closure is stale.
- Assuming both value updates add up (`+1` then `+5` doesn't give 6; the last value wins).

## Tips
- Track "queue" and "closure" separately; it avoids the common mix-ups.
