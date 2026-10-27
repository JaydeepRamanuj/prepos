---
title: "You wrapped a component in React.memo but it still re-renders. Why?"
level: hard
type: debugging
tags: [react-memo, memoization, referential-equality, usecallback, usememo]
related: [react/why-component-rerenders, react/memoization-cost-benefit, react/react-compiler, react/use-callback]
---

## Question
`Row` is wrapped in `React.memo`, yet the Profiler shows every row re-rendering when you type in the search box. Find every reason, then fix it.

```tsx
const Row = memo(function Row({ item, style, onSelect }: RowProps) {
  console.log("render", item.id);
  return <li style={style} onClick={() => onSelect(item.id)}>{item.name}</li>;
});

function List({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            style={{ padding: 8 }}
            onSelect={(id) => setSelected(id)}
          />
        ))}
      </ul>
    </>
  );
}
```

## Clues
- `memo` compares each prop with `Object.is`. What is `{} === {}`?
- Two props are recreated on every render of `List`.
- One of them never changes, so it can live outside the component. The other one needs a stable identity.

## Interview Answer
`React.memo` only skips a render when every prop is `Object.is`-equal to its previous value. Here, two props are new on every render of `List`: the inline `style` object and the inline `onSelect` arrow. Each keystroke re-renders `List`, so every `Row` receives a "different" object and function, and the memo comparison fails every time. To fix it, I hoist the constant style out of the component and wrap `onSelect` in `useCallback` with an empty dependency array, since `setSelected` is stable. Now typing only re-renders `List` and the input. If the project uses the React Compiler, it inserts this memoization automatically.

## Explanation
### How `memo` decides
`memo(Component)` stores the previous props and, before rendering, runs a shallow comparison:

```ts
// roughly what React does by default
function shallowEqual(prev: object, next: object) {
  const keys = Object.keys(next);
  if (keys.length !== Object.keys(prev).length) return false;
  return keys.every((k) => Object.is(prev[k], next[k]));
}
```

For primitives this is a value comparison. For objects, arrays and functions it is a **reference** comparison, so a literal written in JSX always counts as a change.

### The props that break memo here

| Prop | Same every render? | Why |
|---|---|---|
| `item` | Yes | It comes from the `items` array, and the references are unchanged |
| `style={{ padding: 8 }}` | **No** | A new object literal on each render |
| `onSelect={(id) => ...}` | **No** | A new function on each render |

### Fixed version

```tsx
const rowStyle = { padding: 8 }; // module scope: created once

function List({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // setSelected is guaranteed stable, so this can have empty deps
  const handleSelect = useCallback((id: string) => setSelected(id), []);

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {items.map((item) => (
          <Row key={item.id} item={item} style={rowStyle} onSelect={handleSelect} />
        ))}
      </ul>
    </>
  );
}
```

`Row` creates an inline `onClick` internally. That is fine, because the arrow is created inside the memoized component and only runs when `Row` actually renders.

### Other ways memo silently fails
- **`children` is a prop.** `<Memo><span /></Memo>` passes a new element object on each render, so memo never skips.
- **The parent passes freshly derived data**, such as `items={all.filter(...)}`. Wrap the derivation in `useMemo`.
- **The component reads a context** that changed. `memo` does not block context updates.
- **The component has its own state updates.** `memo` only skips renders caused by the parent.

### A custom comparator
`memo(Row, (prev, next) => prev.item.id === next.item.id)` works, but it is fragile. If you forget a prop, the component shows stale data. Stable references are the better fix.

## Follow-ups
- **Why is `setSelected` safe to omit from deps?** React guarantees that state setters keep the same identity for the lifetime of the component.
- **What does the React Compiler change here?** It memoizes the JSX, the style object and the callback for you, so `memo` + `useCallback` mostly become unnecessary.
- **Would `useMemo` on the whole `<Row>` element work?** Yes. React skips re-rendering an element that is reference-equal to the previous one, but this is less readable than `memo`.

## Common Mistakes
- Adding `useCallback` to the handler but forgetting the inline object (or vice versa). A single unstable prop defeats memo.
- Using `useCallback` everywhere without `memo` on the child, so nothing actually compares the stable reference.
- Writing a deep-equal comparator. It is often slower than just re-rendering.

## Tips
- Say: "memo is a shallow `Object.is` check on every prop. One new reference breaks it." Then list the usual suspects: objects, arrays, functions and children.
- Mention that the React Compiler is the modern answer, but you can still explain the manual fix.
