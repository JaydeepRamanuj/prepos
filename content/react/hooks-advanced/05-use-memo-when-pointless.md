---
title: "Spot the pointless (and the missing) memoization in this component"
level: hard
type: debugging
tags: [useMemo, useCallback, React.memo, performance, review]
related: [react/use-memo, react/use-callback, react/memoization-cost-benefit, react/react-compiler]
---

## Question
A teammate "optimised" this component and asked you to review it. Which memoisation does nothing, which is harmful, and where is the actual performance problem?

```tsx
function Dashboard({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState("");

  const total = useMemo(() => orders.length + 1, [orders]);

  const title = useMemo(() => `Orders (${orders.length})`, [orders.length]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  }, []);

  const rows = orders
    .filter((o) => o.customer.includes(filter))
    .map((o) => <OrderRow key={o.id} order={o} onOpen={() => open(o.id)} />);

  const Summary = useMemo(() => () => <p>{total}</p>, [total]);

  return (
    <>
      <h1>{title}</h1>
      <input value={filter} onChange={handleChange} />
      <Summary />
      <ul>{rows}</ul>
    </>
  );
}

const OrderRow = memo(function OrderRow({ order, onOpen }: RowProps) { /* ... */ });
```

## Clues
- A memo only helps if computing the value costs more than comparing the dependencies, or if a consumer compares references.
- Look at which prop of `OrderRow` changes on every render.
- A component created inside `useMemo` has identity implications.

## Interview Answer
`total` and `title` are trivial calculations, so `useMemo` costs more than it saves. `handleChange` with `useCallback` is harmless but pointless, because it's passed to a native `<input>`, which doesn't compare props. The memoised `Summary` is actually harmful: creating a component inside `useMemo` means a new component type whenever `total` changes, which makes React unmount and remount it, losing its state and DOM; define components outside, or just render `<p>{total}</p>`. The real problem is `OrderRow`: it is wrapped in `memo`, but `onOpen={() => open(o.id)}` is a new function every render, so memo never skips; also each keystroke filters the whole list. Fix by passing a stable `onOpen` plus the id, and by deferring or virtualising the list if it is large.

## Explanation
### Review table

| Code | Verdict | Why |
|---|---|---|
| `total` with `useMemo` | pointless | O(1) work; dependency check is as costly as the calculation |
| `title` with `useMemo` | pointless | string interpolation is cheap |
| `handleChange` with `useCallback` | harmless, unneeded | host elements do not compare handlers |
| `Summary` created in `useMemo` | harmful | new component identity on dep change remounts it; defining components in render is an anti-pattern |
| `onOpen={() => open(o.id)}` | defeats `memo` | new function per render |
| filter on every render | maybe | fine for small lists; for large ones memoise or defer |

### Fixed version

```tsx
function Dashboard({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);     // keep typing responsive for big lists

  const visible = useMemo(
    () => orders.filter((o) => o.customer.includes(deferredFilter)),
    [orders, deferredFilter]                            // worth it only if the list is large
  );

  const handleOpen = useCallback((id: number) => open(id), []);

  return (
    <>
      <h1>Orders ({orders.length})</h1>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      <p>{orders.length + 1}</p>
      <ul>
        {visible.map((o) => (
          <OrderRow key={o.id} order={o} onOpen={handleOpen} />   // row calls onOpen(order.id)
        ))}
      </ul>
    </>
  );
}
```

`OrderRow` now receives `order` and a stable `onOpen`, calling `onOpen(order.id)` internally, so `memo` can skip unchanged rows while typing.

### Principles
1. Measure with the Profiler before optimising.
2. Memoisation needs a comparing consumer (`memo`, effect deps, context value).
3. Never create components inside components.
4. Let the React Compiler handle routine memoisation where adopted.

## Follow-ups
- **How would you confirm the fix?** — Profiler: rows should not appear in the commit when only `filter` changes.
- **When is filtering worth memoising?** — When the list is large or the predicate costly, and unrelated state changes cause re-renders.

## Common Mistakes
- Sprinkling `useMemo` on cheap values.
- Defining components inside render.
- Passing inline arrow functions to memoised children.

## Tips
- Name each piece's cost and benefit; reviewers want reasoning, not rules.
