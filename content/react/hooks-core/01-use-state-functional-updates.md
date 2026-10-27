---
title: "Predict the count: setCount(count + 1) three times vs functional updates"
level: medium
type: output
tags: [useState, functional-updates, snapshots, batching]
related: [react/state-batching, react/stale-closures-in-effects, react/props-vs-state]
---

## Question
What does the button show after **one** click in each version, and why?

```tsx
function A() {
  const [count, setCount] = useState(0);
  function handleClick() {
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
    console.log(count);
  }
  return <button onClick={handleClick}>{count}</button>;
}

function B() {
  const [count, setCount] = useState(0);
  function handleClick() {
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
  }
  return <button onClick={handleClick}>{count}</button>;
}

function C() {
  const [count, setCount] = useState(0);
  function handleClick() {
    setCount(count + 5);
    setCount((c) => c + 1);
  }
  return <button onClick={handleClick}>{count}</button>;
}
```

## Interview Answer
`A` shows **1** and logs **0**; `B` shows **3**; `C` shows **6**. State is a snapshot: within one render `count` is a constant, so in `A` all three calls are `setCount(0 + 1)` — they replace the value with 1 three times — and the log prints the old snapshot, 0, because setting state doesn't change the variable, it requests a new render. In `B` each updater function is queued and React applies them in order during the next render, passing each one the result of the previous: 0→1→2→3. In `C` the queue is "replace with 5", then "add 1", so 6. I use the functional form whenever the next state depends on the previous one.

## Explanation
### State as a snapshot
When React calls your component, `useState` hands back the value for *that* render. Event handlers created in that render close over that value. `setCount` doesn't mutate `count`; it enqueues an update and schedules a re-render.

```txt
Render #1: count = 0
  click → setCount(0+1), setCount(0+1), setCount(0+1)   // A
  queue: [replace 1, replace 1, replace 1] → result 1
```

### The update queue
React processes queued updates in order when it next renders:

| Queued item | Meaning | `A` | `B` | `C` |
|---|---|---|---|---|
| value `n` | replace with `n` | 1, 1, 1 | — | 5 |
| function `c => …` | compute from previous | — | 1, 2, 3 | 6 |

So a plain value ignores whatever came before; an updater builds on it.

### When to use the functional form
- The new state depends on the old one (`c => c + 1`, `items => [...items, x]`).
- You're inside a closure that may be stale — `setInterval`, a subscription, an async callback. The updater always receives the latest state, so you can even drop `count` from an effect's dependencies.

```tsx
useEffect(() => {
  const id = setInterval(() => setCount((c) => c + 1), 1000); // no stale count
  return () => clearInterval(id);
}, []);
```

### Updaters must be pure
In StrictMode, React calls updater functions twice to catch side effects. Don't push to arrays, call APIs, or log analytics inside them.

### Naming convention
Use the first letter of the state (`c`, `prev`, `items`) for the updater argument — it makes it obvious it's the pending value, not the snapshot.

## Follow-ups
- **Does `console.log(count)` after `await` show the new value?** — No. The handler's `count` is still the old snapshot forever; the new value appears only in the next render.
- **Does React bail out if I set the same value?** — Yes, if `Object.is(next, current)` is true React skips re-rendering children (it may still call the component once before bailing).

## Common Mistakes
- Expecting `count` to update immediately after `setCount`.
- Using `setCount(count + 1)` in an interval with `[]` deps — it's stuck at 1.
- Side effects inside the updater function.

## Tips
- Say "state is a snapshot; setters queue updates" — then draw the queue table. It explains every variant interviewers throw at you.
