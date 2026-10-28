---
title: "State, ref or plain variable: where should this value live?"
level: medium
type: concept
tags: [useState, useRef, state, rendering, mutable-values]
related: [react/use-ref-dom-vs-mutable, react/props-vs-state, react/state-batching, react/you-might-not-need-an-effect]
---

## Question
A component needs to track a click count, a timer id, the previous scroll position, and a filtered list derived from props. For each, should it be state, a ref, a plain variable, or derived during render? What principle decides?

## Interview Answer
The deciding question is whether changing the value must update the screen. If yes, and it is information the component remembers, it is state. If React doesn't need to know about it, such as a timer id, a DOM node, or the previous scroll position used only in handlers, it is a ref: mutable, persists across renders, changing it does not re-render. If it can be computed from props or other state, it should not be stored at all; compute it during render, and `useMemo` only if expensive. A plain local variable resets every render, so it is only for temporaries. The click count shown on screen is state; the timer id is a ref; the filtered list is derived.

## Explanation
### The decision

```txt
Does the UI show it / depend on it?
 ├─ no  -> does it need to survive re-renders?
 │          ├─ yes -> useRef     (timer ids, DOM nodes, previous values, flags)
 │          └─ no  -> local variable
 └─ yes -> can it be computed from existing props/state?
            ├─ yes -> derive during render (no state)
            └─ no  -> useState / useReducer
```

### The four examples

```tsx
function Panel({ items, query }: { items: Item[]; query: string }) {
  const [clicks, setClicks] = useState(0);          // displayed -> state
  const timerRef = useRef<number | null>(null);     // not displayed -> ref
  const lastY = useRef(0);                          // read in handlers only -> ref
  const visible = items.filter((i) => i.name.includes(query));   // derived -> no state

  function onClick() {
    setClicks((c) => c + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(save, 500);
  }

  return <button onClick={onClick}>{clicks} / {visible.length}</button>;
}
```

### Comparison

| | State | Ref | Local variable |
|---|---|---|---|
| Persists across renders | yes | yes | no |
| Change triggers re-render | yes | no | no |
| Mutate directly | no (use setter) | yes (`ref.current = x`) | yes |
| Read during render | yes | avoid (impure) | yes |
| Typical use | UI data | timers, DOM, instance values | temporaries |

### Pitfalls
- Storing derived values in state (`filtered`) creates duplication and sync bugs: "single source of truth".
- Writing to `ref.current` during render makes render impure; update refs in handlers or effects.
- Using a ref for something shown on screen leaves the UI stale because nothing re-renders.
- Using state for a timer id causes needless renders.
- Mutating state objects directly won't trigger a re-render and breaks memoisation.

### Another useful distinction
- State: snapshot per render, updates are scheduled.
- Ref: one mutable box shared across all renders, updates are immediate.

## Follow-ups
- **Can you force a re-render with a ref?** — No; you'd need state, and you probably should restructure instead.
- **What about values that must survive unmount?** — Neither; use the URL, storage, a store or the server.

## Common Mistakes
- Putting everything in state "just in case".
- Using refs to avoid re-renders for values that the UI does display.

## Tips
- Answer with the flowchart; it shows a principle rather than memorised rules.
