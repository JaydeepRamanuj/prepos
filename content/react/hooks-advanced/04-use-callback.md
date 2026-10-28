---
title: "What does useCallback do, and when does it actually help?"
level: medium
type: concept
tags: [useCallback, memoization, referential-equality, React.memo]
related: [react/use-memo, react/react-memo-new-props, react/memoization-cost-benefit, react/use-effect-dependency-array]
---

## Question
What does `useCallback` return? Show a case where it prevents re-renders, and a case where it does nothing.

## Interview Answer
`useCallback(fn, deps)` returns the same function instance between renders until a dependency changes; it is equivalent to `useMemo(() => fn, deps)`. It doesn't make the function faster or stop it from being created each render. Its value is referential stability: it helps when the function is passed to a child wrapped in `React.memo`, so the child's props are equal and it skips rendering, or when the function is a dependency of an effect or another hook. If the child isn't memoised, or the dependencies change every render, `useCallback` accomplishes nothing and only adds overhead. With the React Compiler, much of this is automated.

## Explanation
### Where it helps

```tsx
const Row = memo(function Row({ item, onSelect }: RowProps) {
  console.log("render row", item.id);
  return <li onClick={() => onSelect(item.id)}>{item.name}</li>;
});

function List({ items }: { items: Item[] }) {
  const [selected, setSelected] = useState<number | null>(null);

  // stable across renders -> Row can skip rendering when its other props are unchanged
  const handleSelect = useCallback((id: number) => setSelected(id), []);

  return <ul>{items.map((i) => <Row key={i.id} item={i} onSelect={handleSelect} />)}</ul>;
}
```

Without `useCallback`, `onSelect` is a new function on every render, so `memo` sees changed props and re-renders every row.

### Where it does nothing

```tsx
// Child not memoised: it re-renders whenever the parent does, regardless of props
<Row onSelect={useCallback(...)} />           // hook rules aside, no benefit

// Dependencies change every render, so a new function is created every render
const fn = useCallback(() => save(draft), [draft]);   // new on every keystroke
```

### As an effect dependency

```tsx
const load = useCallback(() => fetchUser(id), [id]);
useEffect(() => { load(); }, [load]);          // reruns only when id changes
```

Often simpler to move the function inside the effect and depend on `id`.

### Functional updates reduce dependencies

```tsx
const add = useCallback((todo: Todo) => setTodos((t) => [...t, todo]), []);   // no `todos` dep
```

### Rules
- Include every reactive value used inside in the deps.
- It must be paired with something that checks equality (`memo`, effect deps).
- Don't add it by default; profile.

### With the React Compiler
The compiler memoises inline functions inside components automatically, so `useCallback` is mostly needed only for interop with code the compiler skips, or for explicit control.

### `useCallback` vs `useMemo`
`useCallback(fn, deps)` caches the function; `useMemo(() => fn, deps)` is identical. `useMemo` is for caching the return value of calling something.

## Follow-ups
- **Does `useCallback` prevent the function from being recreated?** — The inline function is still created each render; React just returns the earlier one.
- **What's the cost?** — Memory for the cache and a dependency comparison per render.

## Common Mistakes
- Wrapping every handler in `useCallback`.
- Combining it with an unmemoised child.
- Forgetting dependencies and creating stale closures.

## Tips
- Say "referential equality" and explain it needs a consumer that compares.
