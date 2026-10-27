---
title: "Why does this component crash with 'Too many re-renders' or loop forever?"
level: medium
type: debugging
tags: [infinite-loop, useEffect, setState, render, debugging]
related: [react/use-effect-dependency-array, react/state-batching, react/you-might-not-need-an-effect]
---

## Question
Each snippet loops forever or throws. Explain why and fix each.

```tsx
// A
function A() {
  const [n, setN] = useState(0);
  return <button onClick={setN(n + 1)}>{n}</button>;
}

// B
function B({ items }: { items: Item[] }) {
  const [sorted, setSorted] = useState<Item[]>([]);
  setSorted([...items].sort(byName));
  return <List items={sorted} />;
}

// C
function C({ id }: { id: string }) {
  const [user, setUser] = useState<User | null>(null);
  const options = { id };
  useEffect(() => {
    fetchUser(options).then(setUser);
  }, [options]);
  return <p>{user?.name}</p>;
}

// D
function D() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(count + 1);
  }, [count]);
  return <p>{count}</p>;
}
```

## Interview Answer
A calls `setN(n + 1)` during render because it passes the result of the call, not a function, to `onClick`; it sets state on every render, triggering "Too many re-renders". Fix with `onClick={() => setN(n + 1)}`. B calls `setSorted` unconditionally in the render body, so each render schedules another; derive it instead with `const sorted = useMemo(() => [...items].sort(byName), [items])` or just compute inline. C has an object in the dependency array that is new on every render, so the effect re-runs, `setUser` re-renders, a new object appears, and it loops with repeated fetches; depend on the primitive `id` and build options inside the effect. D updates `count` inside an effect that depends on `count`, so each update triggers the effect again; use a condition, a functional update with a different trigger, or remove the effect if the state is derivable.

## Explanation
### Root causes by category

| Case | Cause | Fix |
|---|---|---|
| A | Calling the setter during render by invoking it in JSX | pass a function: `() => setN(n + 1)` |
| B | Unconditional `setState` in render body | derive during render (`useMemo`), no state |
| C | Unstable object dependency + state update in effect | depend on primitives; create objects inside the effect |
| D | Effect updates the state it depends on | remove the effect, add a stop condition, or change trigger |

### Why A fails
`onClick={setN(n + 1)}` evaluates `setN(n + 1)` while rendering. React throws "Too many re-renders. React limits the number of renders to prevent an infinite loop."

### Why B should not use state
`sorted` is derived from `items`. Storing it duplicates the source of truth, requires an effect or render-phase update to sync it, and can lag by one render. Compute it:

```tsx
const sorted = useMemo(() => [...items].sort(byName), [items]);
```

(or just compute inline if the list is small). Note `sort` mutates, so copy first.

React does allow calling `setState` during render of the *same* component when guarded by a condition (to adjust state on prop change), but derived values are almost always better.

### Why C loops and fetches endlessly
`options` is a new object on every render. `[options]` always differs by `Object.is`, so the effect runs after every render; `setUser` triggers a render; repeat. Each cycle sends a request.

```tsx
useEffect(() => {
  let ignore = false;
  fetchUser({ id }).then((u) => { if (!ignore) setUser(u); });
  return () => { ignore = true; };
}, [id]);
```

### Why D loops
Each `setCount(count + 1)` changes `count`, re-running the effect. If you truly need a one-time initial adjustment, use `useState(initial)`, or guard with a condition:

```tsx
useEffect(() => {
  if (count < 10) setCount((c) => c + 1);
}, [count]);          // terminates, but ask whether it should be an effect at all
```

### Debugging approach
1. Read the error: "Too many re-renders" means setState during render; an effect loop usually doesn't throw but hammers the CPU/network.
2. Add `console.log` in the effect, or use the Profiler / "Highlight updates".
3. Log which dependency changed (`usePrevious` per dep).
4. Ask: can this state be derived, or can this effect become an event handler?

## Follow-ups
- **Does React stop effect loops?** — Not generally; it only guards render-phase updates (limit 25 nested updates) and warns about "Maximum update depth exceeded" for layout/passive effect cascades.
- **How would the React Compiler help?** — It can memoise `options`, but fixing the logic is still correct.

## Common Mistakes
- Passing `setX(value)` instead of `() => setX(value)`.
- Storing derived data in state and syncing it with effects.
- Objects/arrays/functions in dependency arrays.

## Tips
- Classify the loop: render-phase update vs effect-dependency cycle.
